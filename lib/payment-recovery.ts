import { createAdminClient } from "./supabase/admin";
import { postToModChannel } from "./discord-kick";
import { sendDiscordDm } from "./discord-dm";
import { WHOP_API_VERSION_DATE, rowOwner, rowProduct } from "../app/api/whop/whop-membership";

// Payment-recovery drip. Runs hourly (app/api/cron/payment-recovery).
//
// Every run: list Real Venture memberships Whop has as past_due, find the
// failed renewal payment behind each one, and follow Whop's own retry
// schedule instead of a fixed number of days:
//   - a membership stays in the drip while Whop shows it past_due, up to
//     MAX_DAY (14) America/Chicago calendar days after failed_at (day 1 =
//     the calendar day of the failure). Not past_due any more (paid,
//     canceled, anything) or day > 14 stops the sequence.
//   - the FIRST message goes out on the first hourly run that finds the
//     membership, whatever the hour.
//   - after that at most one message per Chicago calendar day, sent by the
//     run at FOLLOWUP_HOUR (10:00 Chicago; a later run the same day catches
//     up if the 10:00 run failed, the per-day dedupe keeps it to one).
//
// Copy is chosen by MESSAGE NUMBER (messages already sent in this failure
// sequence + 1), not by calendar day, and names Whop's next retry: {when} is
// next_payment_attempt_at in Chicago as "today", "tomorrow" or the weekday
// name. With no usable next attempt (null, unparsable, or already in the
// past) the retry sentence is dropped.
//
// Three channels: email through the GHL inbound webhook
// (GHL_RECOVERY_WEBHOOK_URL), SMS through a second GHL webhook
// (GHL_RECOVERY_SMS_WEBHOOK_URL) when we have a phone, and a Discord DM
// through our bot when the member has a discord_connections row.
// GHL routing: with a phone we POST {first_name, phone, sms_text, day,
// message_number} to the SMS webhook and the email payload to the email
// webhook with skip_sms "yes". Without a phone only the email webhook is
// posted, with skip_sms "" so GHL may text a phone it already has on the
// contact. Each POST is recorded as its own payment_recovery_sends row
// (channel ghl / ghl_sms / discord_dm) so one failing never blocks the other.
//
// Before EVERY send the membership is re-read live from Whop; anything other
// than past_due stops that sequence (payment_recovery.stopped_at) and sends
// nothing. Also before every send: the same Whop user's OTHER memberships are
// read (singular user_id, owner-checked, every product); if any is active,
// trialing, completed or paused the member is NOT messaged (outcome
// has_other_live_membership, the past_due one is a duplicate) and, once per
// failure sequence (payment_recovery.other_live_flagged_at), one line goes to
// the mod channel asking to cancel the extra one in Whop. Dedupe: payment_recovery_sends is unique on (membership_id,
// failed_at, day, channel) where day is the Chicago calendar day index (1 to
// 14, migration 030); message_number is recorded on every row and the next
// message number is the count of distinct days already claimed + 1.
//
// Repeat failures: a NEW failed renewal (newer failed_at than the stored
// payment_recovery.failed_at) resets the row (started_at now, last_day_sent
// 0, stopped_at / stop_reason null) and the sequence starts again at message
// 1. The sends dedupe key carries failed_at, so the new sequence starts clean.
//
// Test mode (runRecoveryTest): message N's real copy (1 to 5) on all three
// channels to the owner only (RECOVERY_TEST_PHONE, RECOVERY_TEST_EMAIL, the
// owner's Discord id below). Any RECOVERY_MODE, no Whop reads, no table
// writes. {when} is "tomorrow" in the test.
//
// Mode: RECOVERY_MODE === "live" sends and writes the two tables. Anything
// else is shadow: no sends, no table writes (reads only), one summary to the
// mod channel (usernames only) on the 10:00 Chicago run or when asked
// (?post=1).
//
// Verified 2026-10-26 against the live API: a failed renewal is a payment
// with status "open", substatus "past_due", billing_reason
// "subscription_cycle"; GET /payments?account_id&membership_id honors the
// filter; payments carry next_payment_attempt_at; GET /members/{member_id}
// carries the email; membership rows carry manage_url.

const WHOP_API = "https://api.whop.com/api/v1";
const TZ = "America/Chicago";
const PAGE_LIMIT = 100;
const MAX_PAGES = 20;
// Last Chicago calendar day (counted from failed_at = day 1) the drip may message.
export const MAX_DAY = 14;
// Highest message number with its own copy; test mode accepts 1 to this.
export const MAX_MESSAGE = 5;
export const FALLBACK_LINK = "https://whop.com/@me/settings/memberships";
const GHL_TIMEOUT_MS = 5000;
// Guild member "keeganburke" (looked up 2026-10-26 via guild member search). Test sends go here only.
export const OWNER_DISCORD_USER_ID = "1251247376031551577";

// Chicago hour (0-23) from which a follow-up message (message 2+) may go out.
const FOLLOWUP_HOUR = 10;
const SUMMARY_HOUR = 10;

const ULTRA_PLANS: ReadonlySet<string> = new Set(["plan_mjpuBNS3KJqmw", "plan_MVEXluUMjBlxL", "plan_8CGnZkflAnXOe"]);
const PLAN_NAMES: Record<string, string> = {
  plan_2NqC2WJzV87QY: "Base",
  plan_SGscR3JhdTtKh: "Base",
  plan_J8vFpCWME75W3: "Pro",
  plan_9nyRNbuhQF0pk: "Pro",
  plan_tfYMBwmuOwuB0: "Pro",
  plan_SIYHeHyFp1dbR: "Pro",
  plan_mjpuBNS3KJqmw: "Ultra",
  plan_MVEXluUMjBlxL: "Ultra",
  plan_8CGnZkflAnXOe: "Ultra",
};

type Row = Record<string, unknown>;

export type RecoveryMode = "shadow" | "live";
export function recoveryMode(): RecoveryMode {
  return process.env.RECOVERY_MODE === "live" ? "live" : "shadow";
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}
function idOf(v: unknown): string | null {
  if (typeof v === "string" && v.length > 0) return v;
  if (v && typeof v === "object") return str((v as Row).id);
  return null;
}
function parseMs(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const ms = Date.parse(v);
  return Number.isNaN(ms) ? null : ms;
}

// ---------------------------------------------------------------------------
// Copy, by message number. No em or en dashes anywhere in this file.
// `when` is "today" / "tomorrow" / a weekday name, or null (retry sentence
// dropped; messages 1 and 3 keep a short card line so the link survives).
// ---------------------------------------------------------------------------

type MessageCopy = { text: (first: string, link: string, when: string | null) => string; subject: string };
const COPY: Record<number, MessageCopy> = {
  1: {
    text: (f, l, w) =>
      `Hey ${f}, William from Real Venture. We couldn't process your payment, usually just a card thing. ` +
      (w ? `We'll try it again ${w}, so make sure it's covered or update your card here: ${l}` : `Make sure it's covered or update your card here: ${l}`),
    subject: "We couldn't process your payment",
  },
  2: {
    text: (f, l, w) =>
      `Yo ${f}, we're still having trouble processing your payment. ${w ? `Next try is ${w}. ` : ""}Update your card here and nothing changes: ${l}`,
    subject: "Update your payment info to keep your access",
  },
  3: {
    text: (_f, l, w) =>
      `Your Real Venture access is still on. ` +
      (w ? `We'll run your card again ${w}, just make sure it's covered: ${l}` : `Just make sure your card's covered or update it here: ${l}`),
    subject: "Your access is still on",
  },
  4: {
    text: (f, l, w) =>
      `Heads up ${f}, the next try on your card${w ? ` (${w})` : ""} could be the last one before your access ends. Update it here: ${l}`,
    subject: "Your access ends soon",
  },
  5: {
    text: (f, l, w) => `${f}, your spot's still open. ${w ? `We'll try your card again ${w}. ` : ""}Update it here to keep it: ${l}`,
    subject: "Your spot's still open",
  },
};
const SMS_SUFFIX = " Reply STOP to opt out";

// Message 5's copy repeats for every later message.
export function copyFor(messageNumber: number): MessageCopy {
  const c = COPY[Math.min(Math.max(Math.floor(messageNumber), 1), MAX_MESSAGE)];
  if (!c) throw new Error(`no copy for message ${messageNumber}`);
  return c;
}

export function firstNameOf(name: string | null): string {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : "there";
}

// Email webhook payload. skip_sms "yes" when the SMS webhook handles the
// text (we have a phone), "" when GHL may text a phone it already has.
// day = Chicago calendar day of the failure sequence (1 to 14);
// message_number = which message of the sequence this is (1, 2, 3 ...).
export type GhlPayload = {
  first_name: string;
  email: string;
  phone: string;
  sms_text: string;
  email_subject: string;
  email_body: string;
  day: number;
  message_number: number;
  plan_name: string;
  skip_sms: "yes" | "";
};

// SMS webhook payload. Only built when we have a phone.
export type GhlSmsPayload = {
  first_name: string;
  phone: string;
  sms_text: string;
  day: number;
  message_number: number;
};

export type MessageInput = { day: number; messageNumber: number; firstName: string; link: string; when: string | null };

export function buildMessages(input: MessageInput): { text: string; subject: string; emailBody: string; sms: string } {
  const c = copyFor(input.messageNumber);
  const text = c.text(input.firstName, input.link, input.when);
  return { text, subject: c.subject, emailBody: `${text}<br><br>William`, sms: text + SMS_SUFFIX };
}

export function buildGhlPayload(input: MessageInput & { email: string; phone: string; planName: string }): GhlPayload {
  const m = buildMessages(input);
  return {
    first_name: input.firstName,
    email: input.email,
    phone: input.phone,
    // Always the SMS copy (with the STOP suffix), even with no phone; GHL
    // decides what to do with it. phone is "" when we have none.
    sms_text: m.sms,
    email_subject: m.subject,
    email_body: m.emailBody,
    day: input.day,
    message_number: input.messageNumber,
    plan_name: input.planName,
    skip_sms: input.phone ? "yes" : "",
  };
}

export function buildGhlSmsPayload(input: MessageInput & { phone: string }): GhlSmsPayload {
  const m = buildMessages(input);
  return { first_name: input.firstName, phone: input.phone, sms_text: m.sms, day: input.day, message_number: input.messageNumber };
}

// ---------------------------------------------------------------------------
// Time (America/Chicago)
// ---------------------------------------------------------------------------

function chicago(ms: number): { dayIndex: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
  }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const dayIndex = Math.round(Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day"))) / 86400000);
  return { dayIndex, hour: Number(get("hour")) % 24 };
}

// Whole Chicago calendar days since the failure, starting at 1.
export function recoveryDay(failedAtMs: number, nowMs: number): number {
  return chicago(nowMs).dayIndex - chicago(failedAtMs).dayIndex + 1;
}

// Message 1 goes any hour; later messages from FOLLOWUP_HOUR Chicago.
export function windowOpen(messageNumber: number, nowMs: number): boolean {
  if (messageNumber <= 1) return true;
  return chicago(nowMs).hour >= FOLLOWUP_HOUR;
}

// Whop's next retry, named in Chicago: "today", "tomorrow", or the weekday
// name. null when unknown, unparsable, or already behind us (Whop has not
// refreshed it yet), so the copy drops the retry sentence rather than naming
// a day that already passed.
export function whenLabel(nextAttemptMs: number | null, nowMs: number): string | null {
  if (nextAttemptMs === null) return null;
  const diff = chicago(nextAttemptMs).dayIndex - chicago(nowMs).dayIndex;
  if (diff < 0) return null;
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long" }).format(new Date(nextAttemptMs));
}

// ---------------------------------------------------------------------------
// Phone normalization: E.164 or "".
// ---------------------------------------------------------------------------

export function toE164(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (trimmed.startsWith("+") && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return "";
}

// ---------------------------------------------------------------------------
// Whop reads (GET only)
// ---------------------------------------------------------------------------

function whopHeaders(): Record<string, string> {
  const key = process.env.WHOP_API_KEY;
  if (!key) throw new Error("WHOP_API_KEY unset");
  return { Authorization: `Bearer ${key}`, Accept: "application/json", "Api-Version-Date": WHOP_API_VERSION_DATE };
}

async function whopGet(path: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${WHOP_API}/${path}`, { headers: whopHeaders(), cache: "no-store" });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function listPastDue(): Promise<{ ok: true; rows: Row[] } | { ok: false; error: string }> {
  const companyId = process.env.WHOP_COMPANY_ID;
  const productId = process.env.WHOP_PRODUCT_ID;
  if (!companyId || !productId) return { ok: false, error: "WHOP_COMPANY_ID or WHOP_PRODUCT_ID unset" };
  const rows: Row[] = [];
  let after: string | null = null;
  for (let pages = 0; pages < MAX_PAGES; pages++) {
    const params = new URLSearchParams({ company_id: companyId, product_id: productId, status: "past_due", first: String(PAGE_LIMIT) });
    if (after) params.set("after", after);
    const { status, body } = await whopGet(`memberships?${params.toString()}`);
    if (status !== 200) return { ok: false, error: `past_due list HTTP ${status}` };
    const page = body as { data?: unknown[]; page_info?: { has_next_page?: boolean; end_cursor?: string | null } } | null;
    const data = (Array.isArray(page?.data) ? page.data : []).filter((m): m is Row => !!m && typeof m === "object");
    for (const m of data) {
      const product = rowProduct(m);
      if (product !== null && product !== productId) return { ok: false, error: "foreign product in past_due list (filter ignored)" };
      if (m.status !== "past_due") return { ok: false, error: "non past_due row in past_due list (filter ignored)" };
      if (rowOwner(m) === null || typeof m.id !== "string") return { ok: false, error: "past_due row without owner or id" };
      rows.push(m);
    }
    const hasNext = page?.page_info?.has_next_page === true;
    const next = page?.page_info?.end_cursor ?? null;
    if (!hasNext || data.length === 0) return { ok: true, rows };
    if (!next || next === after) return { ok: false, error: "past_due list cursor did not advance" };
    after = next;
  }
  return { ok: false, error: `past_due list exceeded ${MAX_PAGES} pages` };
}

// Newest renewal payment that is not paid: that is the failed renewal. Its
// created_at is the failure moment (last_payment_attempt_at moves with
// Whop's own retries and would reset the day counter). Its
// next_payment_attempt_at is Whop's next retry, used for {when}.
async function findFailedRenewal(
  membershipId: string
): Promise<{ ok: true; failedAtMs: number | null; nextAttemptMs: number | null } | { ok: false; error: string }> {
  const companyId = process.env.WHOP_COMPANY_ID;
  if (!companyId) return { ok: false, error: "WHOP_COMPANY_ID unset" };
  const params = new URLSearchParams({ account_id: companyId, membership_id: membershipId, first: "50" });
  const { status, body } = await whopGet(`payments?${params.toString()}`);
  if (status !== 200) return { ok: false, error: `payments HTTP ${status}` };
  const data = (body as { data?: unknown[] } | null)?.data;
  const rows = (Array.isArray(data) ? data : []).filter((p): p is Row => !!p && typeof p === "object");
  let newest: number | null = null;
  let nextAttemptMs: number | null = null;
  for (const p of rows) {
    if (idOf(p.membership_id) !== membershipId) continue; // filter ignored: never trust
    const reason = str(p.billing_reason);
    if (reason !== "subscription_cycle" && reason !== "subscription_update") continue;
    if (p.status === "paid") continue;
    const ms = parseMs(p.created_at);
    if (ms !== null && (newest === null || ms > newest)) {
      newest = ms;
      nextAttemptMs = parseMs(p.next_payment_attempt_at);
    }
  }
  return { ok: true, failedAtMs: newest, nextAttemptMs };
}

const OTHER_LIVE_STATUSES: ReadonlySet<string> = new Set(["active", "trialing", "completed", "paused"]);

// The same user's OTHER memberships, any product: singular user_id filter,
// owner-checked. Returns the first one that is still live (so the past_due
// one is a duplicate the member is not paying for), or null.
async function findOtherLiveMembership(
  whopUserId: string,
  membershipId: string
): Promise<{ ok: true; other: { id: string; planName: string; status: string } | null } | { ok: false; error: string }> {
  const companyId = process.env.WHOP_COMPANY_ID;
  if (!companyId) return { ok: false, error: "WHOP_COMPANY_ID unset" };
  const params = new URLSearchParams({ company_id: companyId, user_id: whopUserId, first: String(PAGE_LIMIT) });
  const { status, body } = await whopGet(`memberships?${params.toString()}`);
  if (status !== 200) return { ok: false, error: `user memberships HTTP ${status}` };
  const data = (body as { data?: unknown[] } | null)?.data;
  const rows = (Array.isArray(data) ? data : []).filter((m): m is Row => !!m && typeof m === "object");
  for (const m of rows) {
    const owner = rowOwner(m);
    if (owner !== null && owner !== whopUserId) return { ok: false, error: "foreign user in memberships read (user_id filter ignored)" };
  }
  for (const m of rows) {
    const id = str(m.id);
    if (!id || id === membershipId) continue;
    const st = str(m.status) ?? "unknown";
    if (!OTHER_LIVE_STATUSES.has(st)) continue;
    const planId = idOf(m.plan_id) ?? idOf(m.plan);
    const product = rowProduct(m);
    const planName = (planId && PLAN_NAMES[planId]) || planId || product || "unknown plan";
    return { ok: true, other: { id, planName, status: st } };
  }
  return { ok: true, other: null };
}

async function readMembership(membershipId: string): Promise<{ ok: true; status: string; manageUrl: string | null } | { ok: false; error: string }> {
  const { status, body } = await whopGet(`memberships/${membershipId}`);
  if (status !== 200 || !body || typeof body !== "object") return { ok: false, error: `membership read HTTP ${status}` };
  const m = body as Row;
  if (m.id !== membershipId) return { ok: false, error: "membership read returned another id" };
  return { ok: true, status: str(m.status) ?? "unknown", manageUrl: str(m.manage_url) };
}

async function readUser(userId: string): Promise<{ username: string | null; name: string | null }> {
  const { status, body } = await whopGet(`users/${userId}`);
  if (status !== 200 || !body || typeof body !== "object") return { username: null, name: null };
  const u = body as Row;
  return { username: str(u.username), name: str(u.name) };
}

async function readMemberEmail(memberId: string | null): Promise<string> {
  if (!memberId) return "";
  const { status, body } = await whopGet(`members/${memberId}`);
  if (status !== 200 || !body || typeof body !== "object") return "";
  return str((body as Row).email) ?? "";
}

// ---------------------------------------------------------------------------
// Supabase reads
// ---------------------------------------------------------------------------

// member_profiles.whop_phone, then profiles.phone, then member_profiles.phone.
async function readPhone(whopUserId: string): Promise<string> {
  const supabase = createAdminClient();
  const mp = await supabase.from("member_profiles").select("whop_phone, phone").eq("whop_user_id", whopUserId).maybeSingle();
  if (mp.error) console.error("[payment-recovery] member_profiles read failed", mp.error.message);
  const fromWhopPhone = toE164(mp.data?.whop_phone);
  if (fromWhopPhone) return fromWhopPhone;
  const pr = await supabase.from("profiles").select("phone").eq("whop_user_id", whopUserId).limit(1).maybeSingle();
  if (pr.error) console.error("[payment-recovery] profiles read failed", pr.error.message);
  const fromProfiles = toE164(pr.data?.phone);
  if (fromProfiles) return fromProfiles;
  return toE164(mp.data?.phone);
}

async function readDiscord(whopUserId: string): Promise<{ discordUserId: string | null; discordUsername: string | null }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("discord_connections")
    .select("discord_user_id, discord_username")
    .eq("whop_user_id", whopUserId)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[payment-recovery] discord_connections read failed", error.message);
    return { discordUserId: null, discordUsername: null };
  }
  return { discordUserId: str(data?.discord_user_id), discordUsername: str(data?.discord_username) };
}

type RecoveryRecord = {
  membership_id: string;
  failed_at: string | null;
  stopped_at: string | null;
  last_day_sent: number;
  other_live_flagged_at: string | null;
};

async function loadRecords(ids: string[]): Promise<{ ok: true; byId: Map<string, RecoveryRecord> } | { ok: false; error: string }> {
  const byId = new Map<string, RecoveryRecord>();
  if (ids.length === 0) return { ok: true, byId };
  const supabase = createAdminClient();
  // select * so a column added by a later migration (030:
  // other_live_flagged_at) never aborts the drip before that migration runs;
  // a missing column just reads as null.
  const { data, error } = await supabase.from("payment_recovery").select("*").in("membership_id", ids);
  if (error) return { ok: false, error: `payment_recovery read failed: ${error.message}` };
  for (const r of data ?? []) {
    if (typeof r.membership_id === "string") {
      byId.set(r.membership_id, {
        membership_id: r.membership_id,
        failed_at: str(r.failed_at),
        stopped_at: str(r.stopped_at),
        last_day_sent: Number(r.last_day_sent ?? 0),
        other_live_flagged_at: str(r.other_live_flagged_at),
      });
    }
  }
  return { ok: true, byId };
}

// Calendar days already claimed for this failure sequence (any channel, any
// status). Its size is the number of messages already sent, so the next
// message number is size + 1; membership of today's day is the per-day dedupe.
async function loadSentDays(membershipId: string, failedAt: string): Promise<Set<number> | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("payment_recovery_sends")
    .select("day")
    .eq("membership_id", membershipId)
    .eq("failed_at", failedAt);
  if (error) {
    console.error("[payment-recovery] sends read failed", error.message);
    return null;
  }
  const days = new Set<number>();
  for (const r of data ?? []) {
    const d = Number(r.day);
    if (Number.isInteger(d)) days.add(d);
  }
  return days;
}

// ---------------------------------------------------------------------------
// Supabase writes (live mode only)
// ---------------------------------------------------------------------------

type SendStatus = "pending" | "sent" | "failed" | "skipped";
// ghl = email webhook, ghl_sms = SMS webhook, discord_dm = bot DM.
type SendChannel = "ghl" | "ghl_sms" | "discord_dm";

// Claims (membership_id, failed_at, day, channel). "duplicate" means another
// run got there first and this run must send nothing for that day.
async function claimSend(
  membershipId: string,
  failedAt: string,
  day: number,
  messageNumber: number,
  channel: SendChannel
): Promise<"claimed" | "duplicate" | "error"> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("payment_recovery_sends")
    .insert({ membership_id: membershipId, failed_at: failedAt, day, message_number: messageNumber, channel, status: "pending" });
  if (!error) return "claimed";
  if (error.code === "23505") return "duplicate";
  console.error("[payment-recovery] sends insert failed", error.message);
  return "error";
}

async function finishSend(membershipId: string, failedAt: string, day: number, channel: SendChannel, status: SendStatus): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("payment_recovery_sends")
    .update({ status, sent_at: new Date().toISOString() })
    .eq("membership_id", membershipId)
    .eq("failed_at", failedAt)
    .eq("day", day)
    .eq("channel", channel);
  if (error) console.error("[payment-recovery] sends update failed", error.message);
}

async function upsertRecord(fields: {
  membershipId: string;
  whopUserId: string;
  planId: string | null;
  failedAt: string;
  lastDaySent?: number;
  stopReason?: string;
  reset?: boolean;
  otherLiveFlagged?: boolean;
}): Promise<void> {
  const supabase = createAdminClient();
  const row: Record<string, unknown> = {
    membership_id: fields.membershipId,
    whop_user_id: fields.whopUserId,
    plan_id: fields.planId,
    failed_at: fields.failedAt,
  };
  if (fields.reset) {
    row.started_at = new Date().toISOString();
    row.last_day_sent = 0;
    row.stopped_at = null;
    row.stop_reason = null;
    row.other_live_flagged_at = null;
  }
  if (fields.lastDaySent !== undefined) row.last_day_sent = fields.lastDaySent;
  if (fields.otherLiveFlagged) row.other_live_flagged_at = new Date().toISOString();
  if (fields.stopReason !== undefined) {
    row.stopped_at = new Date().toISOString();
    row.stop_reason = fields.stopReason;
  }
  const { error } = await supabase.from("payment_recovery").upsert(row, { onConflict: "membership_id" });
  if (error) console.error("[payment-recovery] payment_recovery upsert failed", error.message);
}

// ---------------------------------------------------------------------------
// GHL: one JSON POST per webhook, 5 s timeout, one retry.
// ---------------------------------------------------------------------------

type GhlTarget = "email" | "sms";
const GHL_URL_ENV: Record<GhlTarget, string> = { email: "GHL_RECOVERY_WEBHOOK_URL", sms: "GHL_RECOVERY_SMS_WEBHOOK_URL" };

async function postGhl(target: GhlTarget, payload: GhlPayload | GhlSmsPayload): Promise<{ ok: boolean; error: string | null }> {
  const envName = GHL_URL_ENV[target];
  const url = process.env[envName];
  if (!url) return { ok: false, error: `${envName} unset` };
  let last: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(GHL_TIMEOUT_MS),
      });
      if (res.ok) return { ok: true, error: null };
      last = `HTTP ${res.status}`;
    } catch (err) {
      last = err instanceof Error ? err.message : "unknown";
    }
  }
  return { ok: false, error: last };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export type ChannelOutcome = "sent" | "failed" | "skipped" | "would_send";

export type RecoveryItem = {
  membershipId: string;
  username: string;
  planName: string;
  ultra: boolean;
  // Chicago calendar day of the failure sequence (1 = day of failed_at).
  day: number;
  // Message this run would send / sent (messages already sent + 1); 0 when
  // the item never got that far.
  messageNumber: number;
  // {when} as the copy would print it, null = retry sentence dropped.
  when: string | null;
  outcome:
    | "sent"
    | "would_send"
    | "not_due_yet"
    | "already_sent_today"
    | "stopped_now"
    | "stopped_previously"
    | "has_other_live_membership"
    | "done"
    | "no_failed_payment"
    | "error";
  detail: string | null;
  // ghl = email webhook, ghlSms = SMS webhook (null until we know the phone).
  ghl: ChannelOutcome | null;
  ghlSms: ChannelOutcome | null;
  discordDm: ChannelOutcome | null;
  hasEmail: boolean;
  hasPhone: boolean;
  hasDiscord: boolean;
};

export type RecoverySummary = {
  mode: RecoveryMode;
  pastDue: number;
  items: RecoveryItem[];
  counts: Record<RecoveryItem["outcome"], number>;
  posted: boolean;
  aborted: string | null;
};

function emptyCounts(): RecoverySummary["counts"] {
  return {
    sent: 0, would_send: 0, not_due_yet: 0, already_sent_today: 0, stopped_now: 0,
    stopped_previously: 0, has_other_live_membership: 0, done: 0, no_failed_payment: 0, error: 0,
  };
}

function formatSummary(s: RecoverySummary): string {
  const lines = [`**Payment recovery** | mode **${s.mode}** | past_due on Whop ${s.pastDue}`];
  if (s.aborted) lines.push(`ALERT: ${s.aborted}. Sent nothing.`);
  const perMessage = new Map<number, string[]>();
  for (const it of s.items) {
    if (it.outcome !== "sent" && it.outcome !== "would_send") continue;
    const ch = [
      it.ghl ? `email:${it.ghl}` : null,
      it.ghlSms ? `sms:${it.ghlSms}` : null,
      it.discordDm ? `dm:${it.discordDm}` : null,
    ].filter(Boolean).join(" ");
    const list = perMessage.get(it.messageNumber) ?? [];
    list.push(
      `${it.username}${it.ultra ? " (ULTRA)" : ""} [${it.planName}] day ${it.day} retry ${it.when ?? "unknown"} ${ch}${it.hasPhone ? "" : " no-phone"}${it.hasEmail ? "" : " no-email"}`
    );
    perMessage.set(it.messageNumber, list);
  }
  for (const n of Array.from(perMessage.keys()).sort((a, b) => a - b)) {
    const list = perMessage.get(n) ?? [];
    lines.push(`message ${n} (${list.length}): ${list.join("; ")}`);
  }
  const c = s.counts;
  lines.push(
    `sent ${c.sent} | would send ${c.would_send} | not due yet ${c.not_due_yet} | already today ${c.already_sent_today} | ` +
      `stopped now ${c.stopped_now} | stopped before ${c.stopped_previously} | other live membership ${c.has_other_live_membership} | ` +
      `done (day ${MAX_DAY + 1}+) ${c.done} | no failed payment ${c.no_failed_payment} | errors ${c.error}`
  );
  const stops = s.items.filter(
    (it) =>
      it.outcome === "stopped_now" ||
      it.outcome === "has_other_live_membership" ||
      it.outcome === "error" ||
      it.outcome === "no_failed_payment" ||
      (it.detail ?? "").startsWith("restarted")
  );
  for (const it of stops) lines.push(`${it.outcome}: ${it.username} (${it.membershipId}) ${it.detail ?? ""}`);
  return lines.join("\n");
}

export async function runPaymentRecovery(opts: { now?: number; forcePost?: boolean } = {}): Promise<RecoverySummary> {
  const now = opts.now ?? Date.now();
  const mode = recoveryMode();
  const summary: RecoverySummary = { mode, pastDue: 0, items: [], counts: emptyCounts(), posted: false, aborted: null };
  const push = (it: RecoveryItem) => {
    summary.items.push(it);
    summary.counts[it.outcome]++;
  };
  const maybePost = async (force: boolean) => {
    const shouldPost = force || (mode === "shadow" ? chicago(now).hour === SUMMARY_HOUR : summary.items.some((it) => it.outcome === "sent" || it.outcome === "stopped_now" || it.outcome === "error"));
    if (!shouldPost) return;
    await postToModChannel(formatSummary(summary));
    summary.posted = true;
  };

  try {
    const listed = await listPastDue();
    if (!listed.ok) {
      summary.aborted = `Whop past_due list failed: ${listed.error}`;
      await maybePost(true);
      return summary;
    }
    summary.pastDue = listed.rows.length;

    // Read in both modes (shadow then reports real message numbers); only
    // live writes.
    const loaded = await loadRecords(listed.rows.map((m) => String(m.id)));
    if (!loaded.ok) {
      summary.aborted = `Supabase read failed: ${loaded.error}`;
      await maybePost(true);
      return summary;
    }
    const records = loaded.byId;

    for (const m of listed.rows) {
      const membershipId = String(m.id);
      const whopUserId = rowOwner(m) ?? "";
      const planId = idOf(m.plan_id) ?? idOf(m.plan);
      const planName = (planId && PLAN_NAMES[planId]) || planId || "unknown";
      const ultra = planId !== null && ULTRA_PLANS.has(planId);
      const base: RecoveryItem = {
        membershipId, username: whopUserId, planName, ultra, day: 0, messageNumber: 0, when: null, outcome: "error", detail: null,
        ghl: null, ghlSms: null, discordDm: null, hasEmail: false, hasPhone: false, hasDiscord: false,
      };

      try {
        const failed = await findFailedRenewal(membershipId);
        if (!failed.ok) {
          push({ ...base, outcome: "error", detail: failed.error });
          continue;
        }
        if (failed.failedAtMs === null) {
          push({ ...base, outcome: "no_failed_payment", detail: "past_due but no unpaid renewal payment found" });
          continue;
        }
        const failedAtIso = new Date(failed.failedAtMs).toISOString();
        const day = recoveryDay(failed.failedAtMs, now);
        base.day = day;
        base.when = whenLabel(failed.nextAttemptMs, now);

        // Stored row vs this failure: a newer failed_at is a new sequence
        // (reset, start again at message 1); otherwise a stopped row stays stopped.
        const rec = records.get(membershipId);
        const storedFailedMs = rec?.failed_at ? parseMs(rec.failed_at) : null;
        const newFailure = rec !== undefined && (storedFailedMs === null || failed.failedAtMs > storedFailedMs);
        if (newFailure) {
          if (mode === "live") await upsertRecord({ membershipId, whopUserId, planId, failedAt: failedAtIso, reset: true });
          base.detail = `restarted (previous failure ${rec?.failed_at ?? "unknown"})`;
        } else if (rec?.stopped_at) {
          push({ ...base, outcome: "stopped_previously", detail: rec.stopped_at });
          continue;
        }

        if (day > MAX_DAY) {
          if (mode === "live") await upsertRecord({ membershipId, whopUserId, planId, failedAt: failedAtIso, stopReason: "window_expired" });
          push({ ...base, outcome: "done", detail: `day ${day}` });
          continue;
        }
        if (day < 1) {
          push({ ...base, outcome: "error", detail: `failure in the future (day ${day})` });
          continue;
        }

        // Messages already sent in this sequence decide the next message
        // number; today's day already claimed = nothing more today.
        const sentDays = await loadSentDays(membershipId, failedAtIso);
        if (sentDays === null) {
          push({ ...base, outcome: "error", detail: "sends read failed" });
          continue;
        }
        const messageNumber = sentDays.size + 1;
        base.messageNumber = messageNumber;
        if (sentDays.has(day)) {
          push({ ...base, outcome: "already_sent_today" });
          continue;
        }
        if (!windowOpen(messageNumber, now)) {
          push({ ...base, outcome: "not_due_yet", detail: `message ${messageNumber} not until ${FOLLOWUP_HOUR}:00 Chicago` });
          continue;
        }

        // Live re-read right before sending. Anything but past_due stops the
        // sequence for good.
        const live = await readMembership(membershipId);
        if (!live.ok) {
          push({ ...base, outcome: "error", detail: live.error });
          continue;
        }
        if (live.status !== "past_due") {
          if (mode === "live") await upsertRecord({ membershipId, whopUserId, planId, failedAt: failedAtIso, stopReason: `status:${live.status}` });
          push({ ...base, outcome: "stopped_now", detail: `whop status ${live.status}` });
          continue;
        }

        const user = await readUser(whopUserId);
        const username = user.username ?? whopUserId;
        const firstName = firstNameOf(user.name);

        // Duplicate guard: a live membership elsewhere on this user means the
        // past_due one is the extra, not a lapse. Never message; tell the mods
        // once per failure sequence.
        const other = await findOtherLiveMembership(whopUserId, membershipId);
        if (!other.ok) {
          push({ ...base, username, outcome: "error", detail: other.error });
          continue;
        }
        if (other.other) {
          const detail = `live ${other.other.planName} (${other.other.status}, ${other.other.id})`;
          if (mode === "live" && !rec?.other_live_flagged_at) {
            await postToModChannel(`Duplicate past_due: ${username} has a live ${other.other.planName} too, cancel the extra one in Whop.`);
            await upsertRecord({ membershipId, whopUserId, planId, failedAt: failedAtIso, otherLiveFlagged: true });
          }
          push({ ...base, username, outcome: "has_other_live_membership", detail });
          continue;
        }

        const email = await readMemberEmail(idOf(m.member_id));
        const phone = await readPhone(whopUserId);
        const discord = await readDiscord(whopUserId);
        const link = live.manageUrl ?? FALLBACK_LINK;
        const msgInput: MessageInput = { day, messageNumber, firstName, link, when: base.when };
        const payload = buildGhlPayload({ ...msgInput, email, phone, planName });
        const smsPayload = phone ? buildGhlSmsPayload({ ...msgInput, phone }) : null;
        const dmText = buildMessages(msgInput).text;
        const item: RecoveryItem = {
          ...base, username, hasEmail: email.length > 0, hasPhone: phone.length > 0, hasDiscord: discord.discordUserId !== null,
          ghl: email || phone ? "would_send" : "skipped",
          ghlSms: smsPayload ? "would_send" : "skipped",
          discordDm: discord.discordUserId ? "would_send" : "skipped",
          outcome: "would_send",
        };

        if (mode !== "live") {
          push(item);
          continue;
        }

        // Claim the day on the ghl (email) channel first: a duplicate claim
        // means another run already owns this day for this membership.
        const claim = await claimSend(membershipId, failedAtIso, day, messageNumber, "ghl");
        if (claim === "duplicate") {
          push({ ...item, outcome: "already_sent_today", ghl: null, ghlSms: null, discordDm: null });
          continue;
        }
        if (claim === "error") {
          push({ ...item, outcome: "error", detail: "could not claim send row", ghl: null, ghlSms: null, discordDm: null });
          continue;
        }
        if (item.ghl === "would_send") {
          const g = await postGhl("email", payload);
          item.ghl = g.ok ? "sent" : "failed";
          if (!g.ok) item.detail = [item.detail, `ghl email ${g.error}`].filter(Boolean).join("; ");
        }
        await finishSend(membershipId, failedAtIso, day, "ghl", item.ghl === "sent" ? "sent" : item.ghl === "failed" ? "failed" : "skipped");

        // SMS webhook: its own claim row, so an email failure never blocks
        // the text and vice versa.
        if (smsPayload) {
          const smsClaim = await claimSend(membershipId, failedAtIso, day, messageNumber, "ghl_sms");
          if (smsClaim === "claimed") {
            const s = await postGhl("sms", smsPayload);
            item.ghlSms = s.ok ? "sent" : "failed";
            if (!s.ok) item.detail = [item.detail, `ghl sms ${s.error}`].filter(Boolean).join("; ");
            await finishSend(membershipId, failedAtIso, day, "ghl_sms", s.ok ? "sent" : "failed");
          } else {
            item.ghlSms = "skipped";
            if (smsClaim === "error") item.detail = [item.detail, "could not claim sms send row"].filter(Boolean).join("; ");
          }
        }

        if (discord.discordUserId) {
          const dmClaim = await claimSend(membershipId, failedAtIso, day, messageNumber, "discord_dm");
          if (dmClaim === "claimed") {
            const ok = await sendDiscordDm(discord.discordUserId, dmText);
            item.discordDm = ok ? "sent" : "failed";
            await finishSend(membershipId, failedAtIso, day, "discord_dm", ok ? "sent" : "failed");
          } else {
            item.discordDm = "skipped";
          }
        }

        if (ultra && messageNumber === 1) {
          await postToModChannel(`Ultra payment issue: ${discord.discordUsername ?? username}. Henry, reach out personally.`);
        }

        await upsertRecord({ membershipId, whopUserId, planId, failedAt: failedAtIso, lastDaySent: day });
        push({ ...item, outcome: "sent" });
      } catch (err) {
        push({ ...base, outcome: "error", detail: err instanceof Error ? err.message : "unknown" });
      }
    }

    await maybePost(opts.forcePost === true);
    return summary;
  } catch (err) {
    summary.aborted = `threw: ${err instanceof Error ? err.message : "unknown"}`;
    await maybePost(true);
    return summary;
  }
}

// ---------------------------------------------------------------------------
// Test mode: message N's real copy on all three channels, to the owner only.
// Any RECOVERY_MODE. No Whop reads, no payment_recovery writes.
// ---------------------------------------------------------------------------

export type RecoveryTestResult =
  | {
      ok: true;
      messageNumber: number;
      ghl: "sent" | "failed";
      ghlError: string | null;
      ghlSms: "sent" | "failed";
      ghlSmsError: string | null;
      discordDm: "sent" | "failed";
      payloadKeys: string[];
      smsPayloadKeys: string[];
    }
  | { ok: false; status: 400; error: string };

export async function runRecoveryTest(messageNumber: number): Promise<RecoveryTestResult> {
  if (!Number.isInteger(messageNumber) || messageNumber < 1 || messageNumber > MAX_MESSAGE) {
    return { ok: false, status: 400, error: `test_day must be 1 to ${MAX_MESSAGE} (message number)` };
  }
  const rawPhone = process.env.RECOVERY_TEST_PHONE;
  const email = process.env.RECOVERY_TEST_EMAIL;
  const missing = [!rawPhone ? "RECOVERY_TEST_PHONE" : null, !email ? "RECOVERY_TEST_EMAIL" : null].filter((v): v is string => v !== null);
  if (missing.length > 0) return { ok: false, status: 400, error: `${missing.join(" and ")} unset` };
  const phone = toE164(rawPhone);
  if (!phone) return { ok: false, status: 400, error: "RECOVERY_TEST_PHONE is not a usable phone number" };
  const firstName = "Keegan";
  // Test has no real failure: day = message number, {when} = "tomorrow".
  const msgInput: MessageInput = { day: messageNumber, messageNumber, firstName, link: FALLBACK_LINK, when: "tomorrow" };
  // Test always has a phone, so this mirrors the live with-phone route:
  // SMS webhook gets the text, email webhook gets skip_sms "yes".
  const payload = buildGhlPayload({ ...msgInput, email: email as string, phone, planName: "Test" });
  const smsPayload = buildGhlSmsPayload({ ...msgInput, phone });
  const g = await postGhl("email", payload);
  const s = await postGhl("sms", smsPayload);
  const dm = await sendDiscordDm(OWNER_DISCORD_USER_ID, buildMessages(msgInput).text);
  return {
    ok: true,
    messageNumber,
    ghl: g.ok ? "sent" : "failed",
    ghlError: g.error,
    ghlSms: s.ok ? "sent" : "failed",
    ghlSmsError: s.error,
    discordDm: dm ? "sent" : "failed",
    payloadKeys: Object.keys(payload),
    smsPayloadKeys: Object.keys(smsPayload),
  };
}

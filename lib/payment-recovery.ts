import { randomBytes } from "crypto";
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
//   - quiet hours: nothing goes out before SEND_FROM_HOUR (10:00) or from
//     SEND_UNTIL_HOUR (19:00) Chicago on, any channel.
//   - the FIRST message goes out on the first hourly run inside that window
//     that finds the membership (at once if the run is already inside it).
//   - after that at most one message per Chicago calendar day, at a slot hour
//     that rotates by message number: message 2 at 10:00, 3 at 14:00, 4 at
//     18:00, 5 at 10:00, 6 at 14:00, and so on. The slot means "from this
//     hour on, same day": a missed run catches up at a later run that day,
//     but never at or after 19:00 (then it waits for the slot tomorrow). The
//     per-day dedupe (payment_recovery_sends day) keeps it to one.
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
// the mod channel asking to cancel the extra one in Whop.
//
// Dedupe: payment_recovery_sends is unique on (membership_id, failed_at, day,
// channel) where day is the Chicago calendar day index (1 to 14, migration
// 030); message_number is recorded on every row and the next message number
// is the count of distinct days already claimed + 1.
//
// Results tracking (migration 031, read by /dashboard/admin/recovery and the
// Monday weekly post, lib/payment-recovery-stats.ts):
//   - every {link} in a live send is https://realventure.io/r/<token>, one
//     random token per (membership, failure, message number, channel) in
//     payment_recovery_links; app/r/[token] logs the click and redirects to
//     the member's real manage_url. The membership id never appears in a URL.
//   - every past_due membership the live drip sees gets a payment_recovery
//     row at first sight (entered), with the Whop username.
//   - when a sequence stops, WHY and WHEN are recorded: outcome paid (plus
//     paid_at, paid_amount, paid_currency, paid_payment_id from the renewal
//     payment Whop marked paid), canceled, expired (Whop expired it, or day
//     14 passed still past_due) or other. Sequences that leave past_due
//     between runs are closed out at the end of every run (open rows not in
//     the past_due list are re-read live).
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

// Quiet hours: sends only at Chicago hours h with SEND_FROM_HOUR <= h < SEND_UNTIL_HOUR.
const SEND_FROM_HOUR = 10;
const SEND_UNTIL_HOUR = 19;
// Follow-up slot hours, cycling from message 2: 10, 14, 18, 10, 14, 18, ...
const SLOT_HOURS: readonly number[] = [10, 14, 18];
// Chicago hour of the daily shadow summary post.
const SUMMARY_HOUR = 10;

const ULTRA_PLANS: ReadonlySet<string> = new Set(["plan_mjpuBNS3KJqmw", "plan_MVEXluUMjBlxL", "plan_8CGnZkflAnXOe"]);
export const PLAN_NAMES: Record<string, string> = {
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
export function parseMs(v: unknown): number | null {
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

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Chicago calendar day index (days since epoch of the local date), hour
// (0-23) and weekday (0 = Sunday) of an instant.
export function chicago(ms: number): { dayIndex: number; hour: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    weekday: "short",
  }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const dayIndex = Math.round(Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day"))) / 86400000);
  return { dayIndex, hour: Number(get("hour")) % 24, weekday: Math.max(0, WEEKDAYS.indexOf(get("weekday"))) };
}

// Instant of Chicago midnight for a YYYY-MM-DD date (handles CST and CDT).
export function chicagoMidnightMs(date: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const guess = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 6);
  if (Number.isNaN(guess)) return null;
  return guess - chicago(guess).hour * 3600000;
}

// Whole Chicago calendar days since the failure, starting at 1.
export function recoveryDay(failedAtMs: number, nowMs: number): number {
  return chicago(nowMs).dayIndex - chicago(failedAtMs).dayIndex + 1;
}

// Chicago hour from which message N may go out on its day. Message 1: the
// start of the send window. Message 2+: the rotating slot (10, 14, 18).
export function slotHour(messageNumber: number): number {
  if (messageNumber <= 1) return SEND_FROM_HOUR;
  return SLOT_HOURS[(messageNumber - 2) % SLOT_HOURS.length];
}

// True when this run may send message N: inside the send window and at or
// after the message's slot hour (same Chicago day).
export function windowOpen(messageNumber: number, nowMs: number): boolean {
  const { hour } = chicago(nowMs);
  return hour >= SEND_FROM_HOUR && hour < SEND_UNTIL_HOUR && hour >= slotHour(messageNumber);
}

// A Chicago calendar day (dayIndex, as chicago() counts them) and hour as a
// label, e.g. "Sat, 11/01 10:00 CT". The date is rendered from the UTC
// midnight of that day index, so no offset math is needed.
function chicagoLabel(dayIndex: number, hour: number): string {
  const date = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "2-digit", day: "2-digit" }).format(
    new Date(dayIndex * 86400000)
  );
  return `${date} ${String(hour).padStart(2, "0")}:00 CT`;
}

// Exact Chicago time the next message (messageNumber) of a sequence goes out,
// seen from this run: "this run" when the window is open now; else today at
// the slot hour when that is still ahead and before quiet hours; else
// tomorrow at the slot hour. null when tomorrow would be past MAX_DAY.
export function nextSendLabel(messageNumber: number, day: number, sentToday: boolean, nowMs: number): string | null {
  const { dayIndex, hour } = chicago(nowMs);
  const slot = slotHour(messageNumber);
  if (!sentToday) {
    if (windowOpen(messageNumber, nowMs)) return "this run";
    if (hour < slot && slot < SEND_UNTIL_HOUR) return chicagoLabel(dayIndex, slot);
  }
  if (day + 1 > MAX_DAY) return null;
  return chicagoLabel(dayIndex + 1, slot);
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

export async function whopGet(path: string): Promise<{ status: number; body: unknown }> {
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

// The renewal payment Whop marked paid after the failure (the failed payment
// object itself flips to paid when a retry or the member's card update goes
// through). paid moment = last_payment_attempt_at (paid_at is set at creation
// on some rows and is not trusted alone). null when none found.
export type PaidRenewal = { paidAtMs: number; amount: number | null; currency: string | null; paymentId: string };
async function findPaidRenewal(membershipId: string, failedAtMs: number): Promise<{ ok: true; paid: PaidRenewal | null } | { ok: false; error: string }> {
  const companyId = process.env.WHOP_COMPANY_ID;
  if (!companyId) return { ok: false, error: "WHOP_COMPANY_ID unset" };
  const params = new URLSearchParams({ account_id: companyId, membership_id: membershipId, first: "50" });
  const { status, body } = await whopGet(`payments?${params.toString()}`);
  if (status !== 200) return { ok: false, error: `payments HTTP ${status}` };
  const data = (body as { data?: unknown[] } | null)?.data;
  const rows = (Array.isArray(data) ? data : []).filter((p): p is Row => !!p && typeof p === "object");
  let best: PaidRenewal | null = null;
  for (const p of rows) {
    if (idOf(p.membership_id) !== membershipId) continue;
    const reason = str(p.billing_reason);
    if (reason !== "subscription_cycle" && reason !== "subscription_update") continue;
    if (p.status !== "paid") continue;
    const paidAtMs = parseMs(p.last_payment_attempt_at) ?? parseMs(p.paid_at);
    const id = str(p.id);
    if (paidAtMs === null || !id || paidAtMs < failedAtMs - 60000) continue;
    if (best === null || paidAtMs > best.paidAtMs) {
      const total = p.total && typeof p.total === "object" ? (p.total as Row) : null;
      const amountNum = total ? Number(total.amount) : NaN;
      best = { paidAtMs, amount: Number.isFinite(amountNum) ? amountNum : null, currency: total ? str(total.currency) : null, paymentId: id };
    }
  }
  return { ok: true, paid: best };
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
  whop_user_id: string | null;
  plan_id: string | null;
  whop_username: string | null;
  failed_at: string | null;
  stopped_at: string | null;
  last_day_sent: number;
  other_live_flagged_at: string | null;
};

function toRecord(r: Row): RecoveryRecord | null {
  if (typeof r.membership_id !== "string") return null;
  return {
    membership_id: r.membership_id,
    whop_user_id: str(r.whop_user_id),
    plan_id: str(r.plan_id),
    whop_username: str(r.whop_username),
    failed_at: str(r.failed_at),
    stopped_at: str(r.stopped_at),
    last_day_sent: Number(r.last_day_sent ?? 0),
    other_live_flagged_at: str(r.other_live_flagged_at),
  };
}

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
    const rec = toRecord(r as Row);
    if (rec) byId.set(rec.membership_id, rec);
  }
  return { ok: true, byId };
}

// Every sequence not yet stopped (any membership), for the end-of-run close-out.
async function loadOpenRecords(): Promise<{ ok: true; rows: RecoveryRecord[] } | { ok: false; error: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("payment_recovery").select("*").is("stopped_at", null);
  if (error) return { ok: false, error: `payment_recovery open read failed: ${error.message}` };
  const rows: RecoveryRecord[] = [];
  for (const r of data ?? []) {
    const rec = toRecord(r as Row);
    if (rec) rows.push(rec);
  }
  return { ok: true, rows };
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
  username?: string;
  lastDaySent?: number;
  stopReason?: string;
  // Stop details (031): why and when the sequence ended.
  outcome?: StopOutcome;
  paid?: PaidRenewal | null;
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
  if (fields.username) row.whop_username = fields.username;
  if (fields.reset) {
    row.started_at = new Date().toISOString();
    row.last_day_sent = 0;
    row.stopped_at = null;
    row.stop_reason = null;
    row.other_live_flagged_at = null;
    row.outcome = null;
    row.paid_at = null;
    row.paid_amount = null;
    row.paid_currency = null;
    row.paid_payment_id = null;
  }
  if (fields.lastDaySent !== undefined) row.last_day_sent = fields.lastDaySent;
  if (fields.otherLiveFlagged) row.other_live_flagged_at = new Date().toISOString();
  if (fields.stopReason !== undefined) {
    row.stopped_at = new Date().toISOString();
    row.stop_reason = fields.stopReason;
  }
  if (fields.outcome !== undefined) row.outcome = fields.outcome;
  if (fields.paid) {
    row.paid_at = new Date(fields.paid.paidAtMs).toISOString();
    row.paid_amount = fields.paid.amount;
    row.paid_currency = fields.paid.currency;
    row.paid_payment_id = fields.paid.paymentId;
  }
  const { error } = await supabase.from("payment_recovery").upsert(row, { onConflict: "membership_id" });
  if (error) console.error("[payment-recovery] payment_recovery upsert failed", error.message);
}

// ---------------------------------------------------------------------------
// Stop outcome (031): why a sequence ended, with the paid payment when it paid.
// ---------------------------------------------------------------------------

export type StopOutcome = "paid" | "canceled" | "expired" | "other";
const PAID_STATUSES: ReadonlySet<string> = new Set(["active", "trialing", "completed"]);

// Whop membership status (or "window_expired") to an outcome.
export function outcomeForStatus(status: string): StopOutcome {
  if (PAID_STATUSES.has(status)) return "paid";
  if (status === "canceled") return "canceled";
  if (status === "expired" || status === "window_expired") return "expired";
  return "other";
}

// Stops a sequence: looks up the paid renewal when the outcome is paid, then
// writes stopped_at, stop_reason, outcome and the paid_* columns (live mode).
// Returns what it found so the summary can say it.
async function recordStop(fields: {
  mode: RecoveryMode;
  membershipId: string;
  whopUserId: string;
  planId: string | null;
  username?: string;
  failedAt: string;
  failedAtMs: number;
  status: string;
}): Promise<{ outcome: StopOutcome; paid: PaidRenewal | null; detail: string }> {
  const outcome = outcomeForStatus(fields.status);
  let paid: PaidRenewal | null = null;
  let detail = fields.status === "window_expired" ? `day ${MAX_DAY} passed, still past_due` : `whop status ${fields.status}`;
  if (outcome === "paid") {
    const found = await findPaidRenewal(fields.membershipId, fields.failedAtMs);
    if (!found.ok) detail += ` (paid payment lookup failed: ${found.error})`;
    else if (found.paid) {
      paid = found.paid;
      detail += ` paid ${paid.amount !== null ? `${paid.amount.toFixed(2)} ${(paid.currency ?? "").toUpperCase()}` : "unknown amount"} at ${new Date(paid.paidAtMs).toISOString()}`;
    } else detail += " (no paid renewal payment found yet)";
  }
  if (fields.mode === "live") {
    await upsertRecord({
      membershipId: fields.membershipId,
      whopUserId: fields.whopUserId,
      planId: fields.planId,
      username: fields.username,
      failedAt: fields.failedAt,
      stopReason: fields.status === "window_expired" ? "window_expired" : `status:${fields.status}`,
      outcome,
      paid,
    });
  }
  return { outcome, paid, detail };
}

// ---------------------------------------------------------------------------
// Tracked links (031): https://realventure.io/r/<token> per (membership,
// failure, message, channel). Falls back to the raw target on a write error
// so a tracking problem never blocks a send.
// ---------------------------------------------------------------------------

export const TRACKED_LINK_BASE = "https://realventure.io/r/";

async function createTrackedLink(membershipId: string, failedAt: string, messageNumber: number, channel: SendChannel, targetUrl: string): Promise<string> {
  const token = randomBytes(12).toString("base64url");
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("payment_recovery_links")
    .insert({ token, membership_id: membershipId, failed_at: failedAt, message_number: messageNumber, channel, target_url: targetUrl });
  if (error) {
    console.error("[payment-recovery] link insert failed, sending the raw link", error.message);
    return targetUrl;
  }
  return `${TRACKED_LINK_BASE}${token}`;
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
  // Exact Chicago time message `messageNumber` goes out ("this run" when it
  // is this one); null when the sequence has no day left or never got that far.
  nextSendAt: string | null;
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

// A sequence closed out at the end of the run: its membership left past_due
// between runs (paid, canceled, expired on Whop).
export type ClosedItem = { membershipId: string; username: string; outcome: StopOutcome; detail: string };

export type RecoverySummary = {
  mode: RecoveryMode;
  pastDue: number;
  items: RecoveryItem[];
  counts: Record<RecoveryItem["outcome"], number>;
  // Open sequences whose membership is no longer past_due, closed (live) or
  // would be closed (shadow) this run, with why.
  closed: ClosedItem[];
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
      `${it.username}${it.ultra ? " (ULTRA)" : ""} [${it.planName}] day ${it.day} at ${it.nextSendAt ?? "this run"} retry ${it.when ?? "unknown"} ${ch}${it.hasPhone ? "" : " no-phone"}${it.hasEmail ? "" : " no-email"}`
    );
    perMessage.set(it.messageNumber, list);
  }
  for (const n of Array.from(perMessage.keys()).sort((a, b) => a - b)) {
    const list = perMessage.get(n) ?? [];
    lines.push(`message ${n} (${list.length}): ${list.join("; ")}`);
  }
  // Members still in the drip but not sent this run: next message and the
  // exact Chicago time it goes.
  const waiting = s.items.filter((it) => it.outcome === "not_due_yet" || it.outcome === "already_sent_today");
  if (waiting.length > 0) {
    lines.push(
      `waiting (${waiting.length}): ` +
        waiting
          .map((it) => `${it.username} [${it.planName}] day ${it.day} next message ${it.messageNumber} at ${it.nextSendAt ?? "none (sequence ends)"}`)
          .join("; ")
    );
  }
  const c = s.counts;
  lines.push(
    `sent ${c.sent} | would send ${c.would_send} | not due yet ${c.not_due_yet} | already today ${c.already_sent_today} | ` +
      `stopped now ${c.stopped_now} | stopped before ${c.stopped_previously} | other live membership ${c.has_other_live_membership} | ` +
      `done (day ${MAX_DAY + 1}+) ${c.done} | no failed payment ${c.no_failed_payment} | errors ${c.error}`
  );
  for (const c of s.closed) {
    lines.push(`${s.mode === "live" ? "closed" : "would close"}: ${c.username} (${c.membershipId}) ${c.outcome}, ${c.detail}`);
  }
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
  const summary: RecoverySummary = { mode, pastDue: 0, items: [], counts: emptyCounts(), closed: [], posted: false, aborted: null };
  const push = (it: RecoveryItem) => {
    summary.items.push(it);
    summary.counts[it.outcome]++;
  };
  const maybePost = async (force: boolean) => {
    const shouldPost = force || (mode === "shadow" ? chicago(now).hour === SUMMARY_HOUR : summary.items.some((it) => it.outcome === "sent" || it.outcome === "stopped_now" || it.outcome === "error") || summary.closed.length > 0);
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
        membershipId, username: whopUserId, planName, ultra, day: 0, messageNumber: 0, when: null, nextSendAt: null, outcome: "error", detail: null,
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
          const stop = await recordStop({ mode, membershipId, whopUserId, planId, username: rec?.whop_username ?? undefined, failedAt: failedAtIso, failedAtMs: failed.failedAtMs, status: "window_expired" });
          push({ ...base, outcome: "done", detail: `day ${day}, ${stop.outcome}: ${stop.detail}` });
          continue;
        }
        if (day < 1) {
          push({ ...base, outcome: "error", detail: `failure in the future (day ${day})` });
          continue;
        }

        // Username first so waiting / skipped lines in the summary name the
        // member, not the Whop user id (one GET per past_due member per run).
        const user = await readUser(whopUserId);
        const username = user.username ?? whopUserId;
        const firstName = firstNameOf(user.name);
        base.username = username;

        // First sight of this failure sequence: record it (entered) so the
        // results page counts it even if it is never messaged.
        if (mode === "live" && rec === undefined) {
          await upsertRecord({ membershipId, whopUserId, planId, username, failedAt: failedAtIso, reset: true });
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
        base.nextSendAt = nextSendLabel(messageNumber, day, sentDays.has(day), now);
        const nextText = base.nextSendAt ? `message ${messageNumber} next at ${base.nextSendAt}` : `message ${messageNumber} never (day ${MAX_DAY} was the last)`;
        if (sentDays.has(day)) {
          push({ ...base, outcome: "already_sent_today", detail: nextText });
          continue;
        }
        if (!windowOpen(messageNumber, now)) {
          push({ ...base, outcome: "not_due_yet", detail: nextText });
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
          const stop = await recordStop({ mode, membershipId, whopUserId, planId, username, failedAt: failedAtIso, failedAtMs: failed.failedAtMs, status: live.status });
          push({ ...base, outcome: "stopped_now", detail: `${stop.outcome}: ${stop.detail}` });
          continue;
        }

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
            await upsertRecord({ membershipId, whopUserId, planId, username, failedAt: failedAtIso, otherLiveFlagged: true });
          }
          push({ ...base, username, outcome: "has_other_live_membership", detail });
          continue;
        }

        const email = await readMemberEmail(idOf(m.member_id));
        const phone = await readPhone(whopUserId);
        const discord = await readDiscord(whopUserId);
        const target = live.manageUrl ?? FALLBACK_LINK;
        // Live: one tracked link per channel (the email payload's sms_text
        // carries the email channel's link; GHL only texts from it when we
        // have no phone). Shadow: the raw target, nothing is sent or stored.
        const trackedLink = (channel: SendChannel) =>
          mode === "live" ? createTrackedLink(membershipId, failedAtIso, messageNumber, channel, target) : Promise.resolve(target);
        const emailInput: MessageInput = { day, messageNumber, firstName, link: await trackedLink("ghl"), when: base.when };
        const payload = buildGhlPayload({ ...emailInput, email, phone, planName });
        const smsPayload = phone ? buildGhlSmsPayload({ ...emailInput, link: await trackedLink("ghl_sms"), phone }) : null;
        const dmText = discord.discordUserId ? buildMessages({ ...emailInput, link: await trackedLink("discord_dm") }).text : "";
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

        await upsertRecord({ membershipId, whopUserId, planId, username, failedAt: failedAtIso, lastDaySent: day });
        push({ ...item, outcome: "sent" });
      } catch (err) {
        push({ ...base, outcome: "error", detail: err instanceof Error ? err.message : "unknown" });
      }
    }

    // Close-out: open sequences whose membership is no longer in the past_due
    // list left the drip between runs. Re-read each live and record why.
    const listedIds = new Set(listed.rows.map((m) => String(m.id)));
    const open = await loadOpenRecords();
    if (!open.ok) {
      console.error("[payment-recovery] close-out skipped:", open.error);
    } else {
      for (const rec of open.rows) {
        if (listedIds.has(rec.membership_id) || !rec.failed_at) continue;
        const failedAtMs = parseMs(rec.failed_at);
        if (failedAtMs === null) continue;
        const username = rec.whop_username ?? rec.whop_user_id ?? rec.membership_id;
        try {
          const live = await readMembership(rec.membership_id);
          if (!live.ok) {
            summary.closed.push({ membershipId: rec.membership_id, username, outcome: "other", detail: `not closed, ${live.error}` });
            continue;
          }
          if (live.status === "past_due") continue; // listing lag; still in the drip
          const stop = await recordStop({
            mode,
            membershipId: rec.membership_id,
            whopUserId: rec.whop_user_id ?? "",
            planId: rec.plan_id,
            username: rec.whop_username ?? undefined,
            failedAt: rec.failed_at,
            failedAtMs,
            status: live.status,
          });
          summary.closed.push({ membershipId: rec.membership_id, username, outcome: stop.outcome, detail: stop.detail });
        } catch (err) {
          summary.closed.push({ membershipId: rec.membership_id, username, outcome: "other", detail: `not closed, ${err instanceof Error ? err.message : "unknown"}` });
        }
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

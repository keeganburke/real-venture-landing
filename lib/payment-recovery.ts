import { createAdminClient } from "./supabase/admin";
import { postToModChannel } from "./discord-kick";
import { sendDiscordDm } from "./discord-dm";
import { WHOP_API_VERSION_DATE, rowOwner, rowProduct } from "../app/api/whop/whop-membership";

// Payment-recovery drip. Runs hourly (app/api/cron/payment-recovery).
//
// Every run: list Real Venture memberships Whop has as past_due, work out
// which drip day each is on (whole America/Chicago calendar days since the
// newest failed renewal payment, starting at 1), and for the ones whose day
// window has opened send the day's message on three channels: SMS + email
// through the GHL inbound webhook (one JSON POST), and a Discord DM through
// our bot when the member has a discord_connections row.
//
// Before EVERY send the membership is re-read live from Whop; anything other
// than past_due (paid, canceled, anything) stops that sequence
// (payment_recovery.stopped_at) and sends nothing. One send per membership
// per day, deduped on (membership_id, failed_at, day) in
// payment_recovery_sends. Day 6+ is marked done and never messaged.
//
// Repeat failures: a NEW failed renewal (newer failed_at than the stored
// payment_recovery.failed_at) resets the row (started_at now, last_day_sent
// 0, stopped_at / stop_reason null) and the 5 days run again. The sends
// dedupe key carries failed_at, so the new sequence starts clean.
//
// Test mode (runRecoveryTest): day N's real copy on all three channels to
// the owner only (RECOVERY_TEST_PHONE, RECOVERY_TEST_EMAIL, the owner's
// Discord id below). Any RECOVERY_MODE, no Whop reads, no table writes.
//
// Windows (America/Chicago): day 1 the first hourly run that finds them,
// day 2 10:00, day 3 13:00, day 4 19:00, day 5 10:00. A day whose window
// was missed is not caught up later; the member gets the next day's message.
//
// Mode: RECOVERY_MODE === "live" sends and writes the two tables. Anything
// else is shadow: no sends, no table writes, one summary to the mod channel
// (usernames only) on the 10:00 Chicago run or when asked (?post=1).
//
// Verified 2026-10-26 against the live API: a failed renewal is a payment
// with status "open", substatus "past_due", billing_reason
// "subscription_cycle"; GET /payments?account_id&membership_id honors the
// filter; GET /members/{member_id} carries the email; membership rows carry
// manage_url.

const WHOP_API = "https://api.whop.com/api/v1";
const TZ = "America/Chicago";
const PAGE_LIMIT = 100;
const MAX_PAGES = 20;
export const MAX_DAY = 5;
export const FALLBACK_LINK = "https://whop.com/@me/settings/memberships";
const GHL_TIMEOUT_MS = 5000;
// Guild member "keeganburke" (looked up 2026-10-26 via guild member search). Test sends go here only.
export const OWNER_DISCORD_USER_ID = "1251247376031551577";

// Hour (Chicago, 0-23) the day's window opens. Day 1 has no window.
const WINDOW_HOUR: Record<number, number | null> = { 1: null, 2: 10, 3: 13, 4: 19, 5: 10 };
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
// Copy. No em or en dashes anywhere in this file.
// ---------------------------------------------------------------------------

type DayCopy = { text: (first: string, link: string) => string; subject: string };
const COPY: Record<number, DayCopy> = {
  1: {
    text: (f, l) =>
      `Hey ${f}, William from Real Venture. We couldn't process your payment, usually just a card thing. Update your payment info here to keep your access: ${l}`,
    subject: "We couldn't process your payment",
  },
  2: {
    text: (f, l) =>
      `Yo ${f}, we're still having trouble processing your payment. Update your card here and nothing changes: ${l}`,
    subject: "Update your payment info to keep your access",
  },
  3: {
    text: (_f, l) =>
      `Your Real Venture access is still on, just need your payment info updated to keep it that way: ${l}`,
    subject: "Your access is still on (for now)",
  },
  4: {
    text: (f, l) => `Heads up ${f}, your access ends soon unless your payment info gets updated: ${l}`,
    subject: "Your access ends soon",
  },
  5: {
    text: (f, l) => `Last reminder ${f}, your access is about to end. Update your payment info here: ${l}`,
    subject: "Last reminder about your access",
  },
};
const SMS_SUFFIX = " Reply STOP to opt out";

export function firstNameOf(name: string | null): string {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : "there";
}

export type GhlPayload = {
  first_name: string;
  email: string;
  phone: string;
  sms_text: string;
  email_subject: string;
  email_body: string;
  day: number;
  plan_name: string;
};

export function buildMessages(day: number, firstName: string, link: string): { text: string; subject: string; emailBody: string; sms: string } {
  const c = COPY[day];
  if (!c) throw new Error(`no copy for day ${day}`);
  const text = c.text(firstName, link);
  return { text, subject: c.subject, emailBody: `${text}<br><br>William`, sms: text + SMS_SUFFIX };
}

export function buildGhlPayload(input: { day: number; firstName: string; email: string; phone: string; link: string; planName: string }): GhlPayload {
  const m = buildMessages(input.day, input.firstName, input.link);
  return {
    first_name: input.firstName,
    email: input.email,
    phone: input.phone,
    // Always the day's SMS copy (with the STOP suffix), even with no phone;
    // GHL decides what to do with it. phone is "" when we have none.
    sms_text: m.sms,
    email_subject: m.subject,
    email_body: m.emailBody,
    day: input.day,
    plan_name: input.planName,
  };
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

export function windowOpen(day: number, nowMs: number): boolean {
  const h = WINDOW_HOUR[day];
  if (h === undefined) return false;
  if (h === null) return true;
  return chicago(nowMs).hour >= h;
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
// Whop's own retries and would reset the day counter).
async function findFailedRenewal(membershipId: string): Promise<{ ok: true; failedAtMs: number | null } | { ok: false; error: string }> {
  const companyId = process.env.WHOP_COMPANY_ID;
  if (!companyId) return { ok: false, error: "WHOP_COMPANY_ID unset" };
  const params = new URLSearchParams({ account_id: companyId, membership_id: membershipId, first: "50" });
  const { status, body } = await whopGet(`payments?${params.toString()}`);
  if (status !== 200) return { ok: false, error: `payments HTTP ${status}` };
  const data = (body as { data?: unknown[] } | null)?.data;
  const rows = (Array.isArray(data) ? data : []).filter((p): p is Row => !!p && typeof p === "object");
  let newest: number | null = null;
  for (const p of rows) {
    if (idOf(p.membership_id) !== membershipId) continue; // filter ignored: never trust
    const reason = str(p.billing_reason);
    if (reason !== "subscription_cycle" && reason !== "subscription_update") continue;
    if (p.status === "paid") continue;
    const ms = parseMs(p.created_at);
    if (ms !== null && (newest === null || ms > newest)) newest = ms;
  }
  return { ok: true, failedAtMs: newest };
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

type RecoveryRecord = { membership_id: string; failed_at: string | null; stopped_at: string | null; last_day_sent: number };

async function loadRecords(ids: string[]): Promise<{ ok: true; byId: Map<string, RecoveryRecord> } | { ok: false; error: string }> {
  const byId = new Map<string, RecoveryRecord>();
  if (ids.length === 0) return { ok: true, byId };
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("payment_recovery").select("membership_id, failed_at, stopped_at, last_day_sent").in("membership_id", ids);
  if (error) return { ok: false, error: `payment_recovery read failed: ${error.message}` };
  for (const r of data ?? []) {
    if (typeof r.membership_id === "string") {
      byId.set(r.membership_id, {
        membership_id: r.membership_id,
        failed_at: str(r.failed_at),
        stopped_at: str(r.stopped_at),
        last_day_sent: Number(r.last_day_sent ?? 0),
      });
    }
  }
  return { ok: true, byId };
}

async function alreadySentToday(membershipId: string, failedAt: string, day: number): Promise<boolean | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("payment_recovery_sends")
    .select("channel")
    .eq("membership_id", membershipId)
    .eq("failed_at", failedAt)
    .eq("day", day)
    .limit(1);
  if (error) {
    console.error("[payment-recovery] sends read failed", error.message);
    return null;
  }
  return (data ?? []).length > 0;
}

// ---------------------------------------------------------------------------
// Supabase writes (live mode only)
// ---------------------------------------------------------------------------

type SendStatus = "pending" | "sent" | "failed" | "skipped";

// Claims (membership_id, failed_at, day, channel). "duplicate" means another
// run got there first and this run must send nothing for that day.
async function claimSend(membershipId: string, failedAt: string, day: number, channel: "ghl" | "discord_dm"): Promise<"claimed" | "duplicate" | "error"> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("payment_recovery_sends")
    .insert({ membership_id: membershipId, failed_at: failedAt, day, channel, status: "pending" });
  if (!error) return "claimed";
  if (error.code === "23505") return "duplicate";
  console.error("[payment-recovery] sends insert failed", error.message);
  return "error";
}

async function finishSend(membershipId: string, failedAt: string, day: number, channel: "ghl" | "discord_dm", status: SendStatus): Promise<void> {
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
  }
  if (fields.lastDaySent !== undefined) row.last_day_sent = fields.lastDaySent;
  if (fields.stopReason !== undefined) {
    row.stopped_at = new Date().toISOString();
    row.stop_reason = fields.stopReason;
  }
  const { error } = await supabase.from("payment_recovery").upsert(row, { onConflict: "membership_id" });
  if (error) console.error("[payment-recovery] payment_recovery upsert failed", error.message);
}

// ---------------------------------------------------------------------------
// GHL: one JSON POST, 5 s timeout, one retry.
// ---------------------------------------------------------------------------

async function postGhl(payload: GhlPayload): Promise<{ ok: boolean; error: string | null }> {
  const url = process.env.GHL_RECOVERY_WEBHOOK_URL;
  if (!url) return { ok: false, error: "GHL_RECOVERY_WEBHOOK_URL unset" };
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
  day: number;
  outcome:
    | "sent"
    | "would_send"
    | "not_due_yet"
    | "already_sent_today"
    | "stopped_now"
    | "stopped_previously"
    | "done"
    | "no_failed_payment"
    | "error";
  detail: string | null;
  ghl: ChannelOutcome | null;
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
    stopped_previously: 0, done: 0, no_failed_payment: 0, error: 0,
  };
}

function formatSummary(s: RecoverySummary): string {
  const lines = [`**Payment recovery** | mode **${s.mode}** | past_due on Whop ${s.pastDue}`];
  if (s.aborted) lines.push(`ALERT: ${s.aborted}. Sent nothing.`);
  const perDay = new Map<number, string[]>();
  for (const it of s.items) {
    if (it.outcome !== "sent" && it.outcome !== "would_send") continue;
    const ch = [it.ghl ? `ghl:${it.ghl}` : null, it.discordDm ? `dm:${it.discordDm}` : null].filter(Boolean).join(" ");
    const list = perDay.get(it.day) ?? [];
    list.push(`${it.username}${it.ultra ? " (ULTRA)" : ""} [${it.planName}] ${ch}${it.hasPhone ? "" : " no-phone"}${it.hasEmail ? "" : " no-email"}`);
    perDay.set(it.day, list);
  }
  for (const day of [1, 2, 3, 4, 5]) {
    const list = perDay.get(day);
    if (!list) continue;
    lines.push(`day ${day} (${list.length}): ${list.join("; ")}`);
  }
  const c = s.counts;
  lines.push(
    `sent ${c.sent} | would send ${c.would_send} | not due yet ${c.not_due_yet} | already today ${c.already_sent_today} | ` +
      `stopped now ${c.stopped_now} | stopped before ${c.stopped_previously} | done (day 6+) ${c.done} | no failed payment ${c.no_failed_payment} | errors ${c.error}`
  );
  const stops = s.items.filter(
    (it) => it.outcome === "stopped_now" || it.outcome === "error" || it.outcome === "no_failed_payment" || (it.detail ?? "").startsWith("restarted")
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

    let records = new Map<string, RecoveryRecord>();
    if (mode === "live") {
      const loaded = await loadRecords(listed.rows.map((m) => String(m.id)));
      if (!loaded.ok) {
        summary.aborted = `Supabase read failed: ${loaded.error}`;
        await maybePost(true);
        return summary;
      }
      records = loaded.byId;
    }

    for (const m of listed.rows) {
      const membershipId = String(m.id);
      const whopUserId = rowOwner(m) ?? "";
      const planId = idOf(m.plan_id) ?? idOf(m.plan);
      const planName = (planId && PLAN_NAMES[planId]) || planId || "unknown";
      const ultra = planId !== null && ULTRA_PLANS.has(planId);
      const base: RecoveryItem = {
        membershipId, username: whopUserId, planName, ultra, day: 0, outcome: "error", detail: null,
        ghl: null, discordDm: null, hasEmail: false, hasPhone: false, hasDiscord: false,
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

        // Stored row vs this failure: a newer failed_at is a new sequence
        // (reset, run the 5 days again); otherwise a stopped row stays stopped.
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
        if (!windowOpen(day, now)) {
          push({ ...base, outcome: "not_due_yet", detail: `window ${WINDOW_HOUR[day]}:00 Chicago` });
          continue;
        }
        if (mode === "live") {
          const sentToday = await alreadySentToday(membershipId, failedAtIso, day);
          if (sentToday === null) {
            push({ ...base, outcome: "error", detail: "sends read failed" });
            continue;
          }
          if (sentToday) {
            push({ ...base, outcome: "already_sent_today" });
            continue;
          }
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
        const email = await readMemberEmail(idOf(m.member_id));
        const phone = await readPhone(whopUserId);
        const discord = await readDiscord(whopUserId);
        const link = live.manageUrl ?? FALLBACK_LINK;
        const payload = buildGhlPayload({ day, firstName, email, phone, link, planName });
        const dmText = buildMessages(day, firstName, link).text;
        const item: RecoveryItem = {
          ...base, username, hasEmail: email.length > 0, hasPhone: phone.length > 0, hasDiscord: discord.discordUserId !== null,
          ghl: email || phone ? "would_send" : "skipped",
          discordDm: discord.discordUserId ? "would_send" : "skipped",
          outcome: "would_send",
        };

        if (mode !== "live") {
          push(item);
          continue;
        }

        // Claim the day on the ghl channel first: a duplicate claim means
        // another run already owns this day for this membership.
        const claim = await claimSend(membershipId, failedAtIso, day, "ghl");
        if (claim === "duplicate") {
          push({ ...item, outcome: "already_sent_today", ghl: null, discordDm: null });
          continue;
        }
        if (claim === "error") {
          push({ ...item, outcome: "error", detail: "could not claim send row", ghl: null, discordDm: null });
          continue;
        }
        if (item.ghl === "would_send") {
          const g = await postGhl(payload);
          item.ghl = g.ok ? "sent" : "failed";
          if (!g.ok) item.detail = [item.detail, `ghl ${g.error}`].filter(Boolean).join("; ");
        }
        await finishSend(membershipId, failedAtIso, day, "ghl", item.ghl === "sent" ? "sent" : item.ghl === "failed" ? "failed" : "skipped");

        if (discord.discordUserId) {
          const dmClaim = await claimSend(membershipId, failedAtIso, day, "discord_dm");
          if (dmClaim === "claimed") {
            const ok = await sendDiscordDm(discord.discordUserId, dmText);
            item.discordDm = ok ? "sent" : "failed";
            await finishSend(membershipId, failedAtIso, day, "discord_dm", ok ? "sent" : "failed");
          } else {
            item.discordDm = "skipped";
          }
        }

        if (ultra && day === 1) {
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
// Test mode: day N's real copy on all three channels, to the owner only.
// Any RECOVERY_MODE. No Whop reads, no payment_recovery writes.
// ---------------------------------------------------------------------------

export type RecoveryTestResult =
  | { ok: true; day: number; ghl: "sent" | "failed"; ghlError: string | null; discordDm: "sent" | "failed"; payloadKeys: string[] }
  | { ok: false; status: 400; error: string };

export async function runRecoveryTest(day: number): Promise<RecoveryTestResult> {
  if (!Number.isInteger(day) || day < 1 || day > MAX_DAY) return { ok: false, status: 400, error: `test_day must be 1 to ${MAX_DAY}` };
  const rawPhone = process.env.RECOVERY_TEST_PHONE;
  const email = process.env.RECOVERY_TEST_EMAIL;
  const missing = [!rawPhone ? "RECOVERY_TEST_PHONE" : null, !email ? "RECOVERY_TEST_EMAIL" : null].filter((v): v is string => v !== null);
  if (missing.length > 0) return { ok: false, status: 400, error: `${missing.join(" and ")} unset` };
  const phone = toE164(rawPhone);
  if (!phone) return { ok: false, status: 400, error: "RECOVERY_TEST_PHONE is not a usable phone number" };
  const firstName = "Keegan";
  const payload = buildGhlPayload({ day, firstName, email: email as string, phone, link: FALLBACK_LINK, planName: "Test" });
  const g = await postGhl(payload);
  const dm = await sendDiscordDm(OWNER_DISCORD_USER_ID, buildMessages(day, firstName, FALLBACK_LINK).text);
  return {
    ok: true,
    day,
    ghl: g.ok ? "sent" : "failed",
    ghlError: g.error,
    discordDm: dm ? "sent" : "failed",
    payloadKeys: Object.keys(payload),
  };
}

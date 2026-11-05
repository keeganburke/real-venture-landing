import { createAdminClient } from "./supabase/admin";
import { RECOVERY_GOLD, postRecoveryEmbed, type RecoveryEmbed } from "./discord-recovery-webhook";
import { MAX_DAY, SUMMARY_HOUR, chicago, chicagoMidnightMs, formatAmount, type ClosedItem, type RecoveryItem, type RecoverySummary } from "./payment-recovery";
import type { Baseline, RecoveryStats } from "./payment-recovery-stats";

// Readable Discord posts for the payment-recovery drip. Formatting and
// posting only: nothing here decides who is messaged, when, or what they get.
//
//   hourlyEmbed    one gold embed per hourly run, only when something
//                  happened: a recovery (sequence closed paid), a loss (closed
//                  canceled or expired), a new DM reply, or an error. Footer:
//                  how many are still past due and the money at risk (the
//                  failed renewal amounts of every membership Whop still lists
//                  as past_due, minus the ones that left past_due this run).
//                  Shadow mode keeps its old rule (the 10:00 Chicago run or
//                  ?post=1) so an unclosed "would close" row is not repeated
//                  every hour.
//   digestEmbed    "Morning recovery report", posted once per Chicago day on
//                  the first hourly run at or after DIGEST_HOUR (9:00). Dedupe
//                  row in payment_recovery_posts (migration 033): the insert
//                  comes first, so two runs never both post; until that table
//                  exists the digest is skipped and the route says why.
//   replyEmbed     one embed per captured DM reply, posted the moment the
//                  reply is read (lib/payment-recovery-replies.ts).
//   weeklyEmbed    the Monday post, same data as before in the same style.
//
// Names: Whop username, else member_profiles.display_name, else "unknown
// member". Never an email, phone, membership id or Whop user id.

export const DIGEST_HOUR = 9;
export const DIGEST_MAX_ROWS = 25;
export const REPLY_TEXT_MAX = 500;
const ERROR_REASON_MAX = 100;
const ERROR_REASONS_SHOWN = 3;

type Row = Record<string, unknown>;

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

// A username the drip could not resolve is the Whop user id (or, on a closed
// row with neither, the membership id). Those never reach a post.
export function looksLikeId(v: string | null): boolean {
  return v === null || /^(user|mem)_/.test(v);
}

export function memberName(username: string | null, displayName: string | null): string {
  if (username && !looksLikeId(username)) return username;
  const dn = displayName?.trim();
  if (dn) return dn;
  return "unknown member";
}

export function money(amount: number | null, currency: string | null): string {
  return amount === null ? "amount unknown" : formatAmount(amount, currency);
}

// YYYY-MM-DD of an instant in Chicago.
export function chicagoDate(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
}

function dateOfDayIndex(dayIndex: number): string {
  return new Date(dayIndex * 86400000).toISOString().slice(0, 10);
}

// membership id -> name. Items and closed rows whose username is unresolved
// get member_profiles.display_name by Whop user id (one SELECT), else
// "unknown member".
export async function resolveNames(summary: RecoverySummary): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const needUser = new Map<string, string[]>();
  const consider = (membershipId: string, username: string | null, whopUserId: string | null) => {
    if (!looksLikeId(username)) {
      names.set(membershipId, username as string);
      return;
    }
    names.set(membershipId, "unknown member");
    if (whopUserId) needUser.set(whopUserId, [...(needUser.get(whopUserId) ?? []), membershipId]);
  };
  for (const it of summary.items) consider(it.membershipId, it.username, it.whopUserId);
  for (const c of summary.closed) consider(c.membershipId, c.username, c.whopUserId);
  if (needUser.size === 0) return names;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("member_profiles").select("whop_user_id, display_name").in("whop_user_id", Array.from(needUser.keys()));
    if (error) {
      console.error("[payment-recovery] display_name read failed", error.message);
      return names;
    }
    for (const r of (data ?? []) as Row[]) {
      const u = str(r.whop_user_id);
      const dn = str(r.display_name)?.trim();
      if (!u || !dn) continue;
      for (const m of needUser.get(u) ?? []) names.set(m, dn);
    }
  } catch (err) {
    console.error("[payment-recovery] display_name read threw", err instanceof Error ? err.message : "unknown");
  }
  return names;
}

// ---------------------------------------------------------------------------
// Hourly
// ---------------------------------------------------------------------------

export type HourlyInput = {
  summary: RecoverySummary;
  names: Map<string, string>;
  now: number;
  // DM replies captured this run, and the capture's errors.
  replies: number;
  replyErrors: string[];
  force: boolean;
};

// Memberships Whop still lists as past_due after this run: every item except
// the ones whose live re-read showed they left past_due (stopped this run).
export function stillPastDue(items: RecoveryItem[]): RecoveryItem[] {
  return items.filter((it) => it.stop === null || it.stop.status === "window_expired");
}

export function atRisk(items: RecoveryItem[]): { count: number; total: number } {
  let total = 0;
  for (const it of items) if (it.amountValue !== null) total += it.amountValue;
  return { count: items.length, total };
}

function short(v: string): string {
  return v.length > ERROR_REASON_MAX ? `${v.slice(0, ERROR_REASON_MAX - 3)}...` : v;
}

export function hourlyEmbed(input: HourlyInput): RecoveryEmbed | null {
  const { summary: s, names } = input;
  const nameOf = (membershipId: string, username: string) => names.get(membershipId) ?? memberName(username, null);
  const recovered: string[] = [];
  const lost: string[] = [];
  const left: string[] = [];
  const errorReasons: string[] = [];
  let errors = 0;

  const stopLine = (membershipId: string, username: string, outcome: ClosedItem["outcome"], amount: number | null, currency: string | null, reason: string) => {
    const name = nameOf(membershipId, username);
    if (outcome === "paid") recovered.push(`✅ Recovered: ${name} paid ${money(amount, currency)}`);
    else if (outcome === "canceled" || outcome === "expired") lost.push(`❌ Lost: ${name} (${reason})`);
    else left.push(`ℹ️ Left the drip: ${name} (${reason})`);
  };
  for (const it of s.items) {
    if (it.stop) stopLine(it.membershipId, it.username, it.stop.outcome, it.stop.amount, it.stop.currency, it.stop.reason);
    if (it.outcome === "error") {
      errors++;
      errorReasons.push(`${nameOf(it.membershipId, it.username)}: ${it.detail ?? "unknown"}`);
    }
  }
  for (const c of s.closed) {
    if (c.notClosed) {
      errors++;
      errorReasons.push(`${nameOf(c.membershipId, c.username)}: ${c.detail}`);
      continue;
    }
    stopLine(c.membershipId, c.username, c.outcome, c.amount, c.currency, c.reason);
  }
  if (s.aborted) {
    errors++;
    errorReasons.unshift(s.aborted);
  }
  for (const e of input.replyErrors) {
    errors++;
    errorReasons.push(`reply capture: ${e}`);
  }

  const sent = s.items.filter((it) => it.outcome === "sent");
  const texts = sent.filter((it) => it.ghlSms === "sent").length;
  const emails = sent.filter((it) => it.ghl === "sent").length;
  const dms = sent.filter((it) => it.discordDm === "sent").length;

  const live = s.mode === "live";
  const happened = recovered.length > 0 || lost.length > 0 || left.length > 0 || input.replies > 0 || errors > 0;
  const should = input.force || (live ? happened : chicago(input.now).hour === SUMMARY_HOUR);
  if (!should) return null;

  const lines: string[] = [];
  if (!live) lines.push("Shadow mode: nothing sent, nothing written. Closes below are what live mode would record.");
  lines.push(...recovered, ...lost, ...left);
  if (sent.length > 0) lines.push(`📨 Sent this hour: ${sent.length} (texts ${texts}, emails ${emails}, DMs ${dms})`);
  if (errors > 0) {
    const shown = Array.from(new Set(errorReasons.map(short))).slice(0, ERROR_REASONS_SHOWN);
    lines.push(`⚠️ Errors: ${errors} (${shown.join("; ")}${errorReasons.length > ERROR_REASONS_SHOWN ? "; ..." : ""})`);
  }
  const risk = atRisk(stillPastDue(s.items));
  return {
    title: live ? "Payment recovery" : "Payment recovery (shadow)",
    color: RECOVERY_GOLD,
    description: lines.join("\n"),
    footer: { text: `${risk.count} still past due, ${formatAmount(risk.total, "usd")} at risk` },
  };
}

// ---------------------------------------------------------------------------
// Morning digest
// ---------------------------------------------------------------------------

export type DigestRow = { name: string; tier: string; amount: number | null; currency: string | null; day: number };
export type DigestInput = {
  rows: DigestRow[];
  yesterday: { recovered: number; recoveredAmount: number; lost: number; replies: number };
};

type Stage = { label: string; from: number; to: number };
const STAGES: Stage[] = [
  { label: "Day 1 to 3", from: 1, to: 3 },
  { label: "Day 4 to 7", from: 4, to: 7 },
  { label: `Day 8 to ${MAX_DAY}`, from: 8, to: MAX_DAY },
  { label: `Past day ${MAX_DAY}`, from: MAX_DAY + 1, to: Infinity },
];

export function digestEmbed(input: DigestInput): RecoveryEmbed {
  const all = input.rows;
  const total = all.reduce((acc, r) => acc + (r.amount ?? 0), 0);
  const sorted = [...all].sort((a, b) => (b.amount ?? -1) - (a.amount ?? -1) || a.day - b.day || a.name.localeCompare(b.name));
  const shown = sorted.slice(0, DIGEST_MAX_ROWS);
  const y = input.yesterday;
  const lines = [
    `Past due: ${all.length} ${all.length === 1 ? "person" : "people"}, ${formatAmount(total, "usd")} at risk`,
    `Yesterday: ${y.recovered} recovered (${formatAmount(y.recoveredAmount, "usd")}), ${y.lost} lost`,
  ];
  for (const stage of STAGES) {
    const rows = shown.filter((r) => r.day >= stage.from && r.day <= stage.to);
    if (rows.length === 0) continue;
    lines.push("", `**${stage.label}**`);
    for (const r of rows) {
      const dayText = r.day > MAX_DAY ? `day ${r.day}` : `day ${r.day} of ${MAX_DAY}`;
      lines.push(`${r.name} · ${r.tier} · ${money(r.amount, r.currency)} · ${dayText}`);
    }
  }
  const unplaced = shown.filter((r) => r.day < 1);
  if (unplaced.length > 0) {
    lines.push("", "**Day unknown**");
    for (const r of unplaced) lines.push(`${r.name} · ${r.tier} · ${money(r.amount, r.currency)}`);
  }
  if (all.length > shown.length) lines.push("", `Showing ${shown.length} of ${all.length} by amount.`);
  lines.push("", `Replies yesterday: ${y.replies}`);
  return { title: "Morning recovery report", color: RECOVERY_GOLD, description: lines.join("\n") };
}

export type DigestResult = { posted: boolean; reason: string | null };

// Yesterday's closes and replies, Chicago calendar day. SELECT only.
export async function loadYesterday(now: number): Promise<{ ok: true; data: DigestInput["yesterday"] } | { ok: false; error: string }> {
  const today = chicago(now).dayIndex;
  const fromMs = chicagoMidnightMs(dateOfDayIndex(today - 1));
  const toMs = chicagoMidnightMs(dateOfDayIndex(today));
  if (fromMs === null || toMs === null) return { ok: false, error: "could not place Chicago midnight" };
  const supabase = createAdminClient();
  const closes = await supabase
    .from("payment_recovery")
    .select("outcome, paid_amount")
    .gte("stopped_at", new Date(fromMs).toISOString())
    .lt("stopped_at", new Date(toMs).toISOString());
  if (closes.error) return { ok: false, error: `payment_recovery read failed: ${closes.error.message}` };
  const replies = await supabase
    .from("payment_recovery_replies")
    .select("id", { count: "exact", head: true })
    .gte("received_at", new Date(fromMs).toISOString())
    .lt("received_at", new Date(toMs).toISOString());
  if (replies.error) return { ok: false, error: `payment_recovery_replies read failed: ${replies.error.message}` };
  const data = { recovered: 0, recoveredAmount: 0, lost: 0, replies: replies.count ?? 0 };
  for (const r of (closes.data ?? []) as Row[]) {
    const outcome = str(r.outcome);
    if (outcome === "paid") {
      data.recovered++;
      const n = Number(r.paid_amount);
      if (Number.isFinite(n)) data.recoveredAmount += n;
    } else if (outcome === "canceled" || outcome === "expired") data.lost++;
  }
  return { ok: true, data };
}

export function digestRows(summary: RecoverySummary, names: Map<string, string>): DigestRow[] {
  return stillPastDue(summary.items).map((it) => ({
    name: names.get(it.membershipId) ?? memberName(it.username, null),
    tier: it.planName,
    amount: it.amountValue,
    currency: it.amountCurrency,
    day: it.day,
  }));
}

// Posts the digest once per Chicago day, on the first run at or after
// DIGEST_HOUR. The dedupe insert comes before the post. A run that aborted
// (no past_due list) does not spend the day's slot.
export async function postMorningDigest(summary: RecoverySummary, names: Map<string, string>, now: number): Promise<DigestResult> {
  if (chicago(now).hour < DIGEST_HOUR) return { posted: false, reason: `before ${DIGEST_HOUR}:00 Chicago` };
  if (summary.aborted) return { posted: false, reason: "run aborted, no past_due list" };
  const date = chicagoDate(now);
  const supabase = createAdminClient();
  const claim = await supabase.from("payment_recovery_posts").insert({ kind: "morning_digest", chicago_date: date });
  if (claim.error) {
    if (claim.error.code === "23505") return { posted: false, reason: "already posted today" };
    console.error("[payment-recovery] digest dedupe write failed", claim.error.message);
    return { posted: false, reason: `dedupe write failed: ${claim.error.message}` };
  }
  const yesterday = await loadYesterday(now);
  const embed = digestEmbed({
    rows: digestRows(summary, names),
    yesterday: yesterday.ok ? yesterday.data : { recovered: 0, recoveredAmount: 0, lost: 0, replies: 0 },
  });
  if (!yesterday.ok) embed.description = `${embed.description}\n\n⚠️ Yesterday's numbers unavailable: ${yesterday.error}`;
  const posted = await postRecoveryEmbed(embed);
  return { posted, reason: posted ? null : "webhook post failed or unset" };
}

// ---------------------------------------------------------------------------
// Replies
// ---------------------------------------------------------------------------

export function replyEmbed(input: { name: string; tier: string; day: number | null; text: string }): RecoveryEmbed {
  const raw = input.text.trim();
  const cut = raw.length > REPLY_TEXT_MAX ? `${raw.slice(0, REPLY_TEXT_MAX - 3)}...` : raw;
  const quoted = cut.split("\n").map((l) => `> ${l}`).join("\n");
  const day = input.day === null ? "day unknown" : `day ${input.day}`;
  return {
    color: RECOVERY_GOLD,
    description: `💬 ${input.name} (${input.tier}, ${day}) replied:\n${quoted}`,
  };
}

// ---------------------------------------------------------------------------
// Weekly
// ---------------------------------------------------------------------------

export function weeklyEmbed(stats: RecoveryStats, baseline: Baseline, fromMs: number, toMs: number): RecoveryEmbed {
  const fmt = (ms: number) => new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric" }).format(new Date(ms));
  const pctOf = (v: number | null) => (v === null ? "n/a" : `${(v * 100).toFixed(1)}%`);
  const lines = [
    `${fmt(fromMs)} to ${fmt(toMs)} (Chicago)`,
    `Entered the drip: ${stats.entered} (${stats.messaged} messaged)`,
    `✅ Recovered: ${stats.recovered} (${formatAmount(stats.recoveredAmount, "usd")})`,
    `❌ Lost: ${stats.lost}`,
    `Still open: ${stats.open}`,
    baseline.ok
      ? `Recovery rate: ${pctOf(stats.rate)} vs ${pctOf(baseline.rate)} before the drip (${baseline.paid} of ${baseline.failedRenewals} failed renewals paid in the 90 days before ${baseline.launched ? "launch" : "today"})`
      : `Recovery rate: ${pctOf(stats.rate)} (baseline unavailable: ${baseline.error ?? "unknown"})`,
  ];
  if (stats.errors.length) lines.push(`⚠️ Errors: ${stats.errors.length} (${stats.errors.map(short).slice(0, ERROR_REASONS_SHOWN).join("; ")})`);
  return { title: "Payment recovery, weekly", color: RECOVERY_GOLD, description: lines.join("\n") };
}

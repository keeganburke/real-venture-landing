import { createAdminClient } from "./supabase/admin";
import { postRecoveryEmbed, recoveryWebhookUrl, type RecoveryEmbed } from "./discord-recovery-webhook";
import { weeklyEmbed } from "./payment-recovery-post";
import { PLAN_NAMES, chicago, parseMs, whopGet, type StopOutcome } from "./payment-recovery";

// Payment-recovery results (migration 031). Read by /dashboard/admin/recovery
// and by the Monday 10:00 Chicago weekly post (app/api/cron/payment-recovery).
//
// Definitions (all dates America/Chicago):
//   entered    payment_recovery rows whose started_at is in the range (the
//              drip first saw the failure sequence then).
//   messaged   entered rows with at least one payment_recovery_sends row with
//              status sent for that failure (failed_at match).
//   recovered  entered rows with outcome paid (paid_at, paid_amount from Whop).
//   lost       outcome canceled or expired. other = any other stop. open =
//              stopped_at null.
//   rate       recovered / entered.
//   baseline   from Whop, not hardcoded: renewal payments (billing_reason
//              subscription_cycle) on the Real Venture product created in the
//              90 days before launch that had at least one failed attempt
//              (payments_failed > 0); share of those now paid. Launch = the
//              first live send (earliest payment_recovery_sends.sent_at with
//              status sent); before launch the window is the last 90 days.
//   clicks     payment_recovery_links.click_count per (sequence, message,
//              channel); "clicked" = links with at least one click.
//   replies    payment_recovery_replies rows (migration 032) per sequence:
//              Discord DM replies the cron captured. Email and SMS replies
//              are not captured here (they live in GHL), so those channels
//              read null = "see GHL".
//   send slot  Chicago hour of sent_at: 10 to 13 = 10am, 14 to 17 = 2pm,
//              18 = 6pm, anything else = other.
// Reads only. SELECT on Supabase, GET on Whop.

type Row = Record<string, unknown>;
export type SendChannel = "ghl" | "ghl_sms" | "discord_dm";
export const CHANNEL_LABELS: Record<SendChannel, string> = { ghl: "Email", ghl_sms: "SMS", discord_dm: "Discord DM" };
export type Slot = "10am" | "2pm" | "6pm" | "other";
const SLOTS: Slot[] = ["10am", "2pm", "6pm", "other"];
const BASELINE_DAYS = 90;
const BASELINE_MAX_PAGES = 40;

export type SequenceRow = {
  membershipId: string;
  username: string;
  plan: string;
  enteredAt: string;
  failedAt: string | null;
  messagesSent: number;
  clicks: number;
  clicked: boolean;
  // Discord DM replies captured for this sequence (032).
  replies: number;
  outcome: StopOutcome | "open";
  stopReason: string | null;
  paidAt: string | null;
  amount: number | null;
  currency: string | null;
};

export type RecoveryStats = {
  fromMs: number;
  toMs: number;
  entered: number;
  messaged: number;
  recovered: number;
  lost: number;
  other: number;
  open: number;
  rate: number | null;
  recoveredAmount: number;
  perMonth: { month: string; amount: number; count: number }[];
  paidAfterMessage: { message: number; count: number }[];
  hoursToPaid: { n: number; median: number | null; average: number | null };
  // replies: captured count for discord_dm, null for the GHL channels (see GHL).
  perChannel: { channel: SendChannel; label: string; sent: number; failed: number; clicks: number; clicked: number; clickRate: number | null; replies: number | null }[];
  perSlot: { slot: Slot; sends: number; clicks: number; payments: number }[];
  sequences: SequenceRow[];
  errors: string[];
};

export type Baseline = {
  ok: boolean;
  error: string | null;
  launched: boolean;
  launchAt: string | null;
  windowFrom: string;
  windowTo: string;
  renewals: number;
  failedRenewals: number;
  paid: number;
  rate: number | null;
  warnings: string[];
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}
function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function slotOf(sentAtMs: number): Slot {
  const h = chicago(sentAtMs).hour;
  if (h >= 10 && h < 14) return "10am";
  if (h >= 14 && h < 18) return "2pm";
  if (h === 18) return "6pm";
  return "other";
}

export function monthLabel(ms: number): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "short" }).format(new Date(ms));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Supabase .in() with many ids: chunked so the URL stays short.
async function selectIn(table: string, columns: string, ids: string[]): Promise<{ rows: Row[]; error: string | null }> {
  const supabase = createAdminClient();
  const rows: Row[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase.from(table).select(columns).in("membership_id", ids.slice(i, i + 100));
    if (error) return { rows, error: `${table} read failed: ${error.message}` };
    for (const r of data ?? []) rows.push(r as unknown as Row);
  }
  return { rows, error: null };
}

export async function loadRecoveryStats(fromMs: number, toMs: number): Promise<RecoveryStats> {
  const errors: string[] = [];
  const supabase = createAdminClient();
  const stats: RecoveryStats = {
    fromMs, toMs, entered: 0, messaged: 0, recovered: 0, lost: 0, other: 0, open: 0, rate: null, recoveredAmount: 0,
    perMonth: [], paidAfterMessage: [], hoursToPaid: { n: 0, median: null, average: null },
    perChannel: (["ghl", "ghl_sms", "discord_dm"] as SendChannel[]).map((c) => ({ channel: c, label: CHANNEL_LABELS[c], sent: 0, failed: 0, clicks: 0, clicked: 0, clickRate: null, replies: c === "discord_dm" ? 0 : null })),
    perSlot: SLOTS.map((slot) => ({ slot, sends: 0, clicks: 0, payments: 0 })),
    sequences: [], errors,
  };

  const recRes = await supabase
    .from("payment_recovery")
    .select("*")
    .gte("started_at", new Date(fromMs).toISOString())
    .lt("started_at", new Date(toMs).toISOString())
    .order("started_at", { ascending: false });
  if (recRes.error) {
    errors.push(`payment_recovery read failed: ${recRes.error.message}`);
    return stats;
  }
  const recs = (recRes.data ?? []) as unknown as Row[];
  const ids = recs.map((r) => str(r.membership_id)).filter((v): v is string => v !== null);
  const [sends, links, replies] = await Promise.all([
    selectIn("payment_recovery_sends", "membership_id, failed_at, day, message_number, channel, status, sent_at", ids),
    selectIn("payment_recovery_links", "token, membership_id, failed_at, message_number, channel, click_count, first_clicked_at", ids),
    selectIn("payment_recovery_replies", "membership_id, channel, received_at", ids),
  ]);
  if (sends.error) errors.push(sends.error);
  if (links.error) errors.push(links.error);
  if (replies.error) errors.push(replies.error);
  // Replies per sequence: by membership and received after the failure (a
  // reply to an older failure sequence of the same membership stays with it).
  const repliesByMembership = new Map<string, number[]>();
  for (const r of replies.rows) {
    const m = str(r.membership_id);
    const ms = parseMs(r.received_at);
    if (!m || ms === null) continue;
    repliesByMembership.set(m, [...(repliesByMembership.get(m) ?? []), ms]);
  }

  const key = (m: string | null, f: string | null) => `${m}|${f ? parseMs(f) : "x"}`;
  const sendsBySeq = new Map<string, Row[]>();
  for (const s of sends.rows) {
    const k = key(str(s.membership_id), str(s.failed_at));
    sendsBySeq.set(k, [...(sendsBySeq.get(k) ?? []), s]);
  }
  const linksBySeq = new Map<string, Row[]>();
  for (const l of links.rows) {
    const k = key(str(l.membership_id), str(l.failed_at));
    linksBySeq.set(k, [...(linksBySeq.get(k) ?? []), l]);
  }

  const perMonth = new Map<string, { ms: number; amount: number; count: number }>();
  const paidAfter = new Map<number, number>();
  const hours: number[] = [];
  const channelIdx = (c: string) => stats.perChannel.findIndex((p) => p.channel === c);
  const slotIdx = (s: Slot) => stats.perSlot.findIndex((p) => p.slot === s);

  for (const r of recs) {
    const membershipId = str(r.membership_id) ?? "";
    const failedAt = str(r.failed_at);
    const k = key(membershipId, failedAt);
    const seqSends = sendsBySeq.get(k) ?? [];
    const seqLinks = linksBySeq.get(k) ?? [];
    const sent = seqSends.filter((s) => s.status === "sent");
    const messagesSent = new Set(sent.map((s) => num(s.message_number) ?? num(s.day) ?? 0)).size;
    const clicks = seqLinks.reduce((acc, l) => acc + (num(l.click_count) ?? 0), 0);
    const failedAtMs = failedAt ? parseMs(failedAt) : null;
    const seqReplies = (repliesByMembership.get(membershipId) ?? []).filter((ms) => failedAtMs === null || ms >= failedAtMs).length;
    const stoppedAt = str(r.stopped_at);
    const rawOutcome = str(r.outcome);
    const outcome: SequenceRow["outcome"] = !stoppedAt
      ? "open"
      : rawOutcome === "paid" || rawOutcome === "canceled" || rawOutcome === "expired"
        ? rawOutcome
        : "other";
    const amount = num(r.paid_amount);
    const paidAt = str(r.paid_at);
    const paidAtMs = paidAt ? parseMs(paidAt) : null;
    const planId = str(r.plan_id);

    stats.entered++;
    if (messagesSent > 0) stats.messaged++;
    if (outcome === "paid") stats.recovered++;
    else if (outcome === "canceled" || outcome === "expired") stats.lost++;
    else if (outcome === "other") stats.other++;
    else stats.open++;

    // Channel: sends and clicks.
    for (const s of seqSends) {
      const ci = channelIdx(String(s.channel));
      if (ci < 0) continue;
      if (s.status === "sent") stats.perChannel[ci].sent++;
      if (s.status === "failed") stats.perChannel[ci].failed++;
    }
    const dmIdx = channelIdx("discord_dm");
    if (dmIdx >= 0) stats.perChannel[dmIdx].replies = (stats.perChannel[dmIdx].replies ?? 0) + seqReplies;
    for (const l of seqLinks) {
      const ci = channelIdx(String(l.channel));
      const c = num(l.click_count) ?? 0;
      if (ci >= 0) {
        stats.perChannel[ci].clicks += c;
        if (c > 0) stats.perChannel[ci].clicked++;
      }
    }
    // Slot: each sent send counts once; its link's clicks go to its slot.
    for (const s of sent) {
      const sentAtMs = parseMs(s.sent_at);
      if (sentAtMs === null) continue;
      const si = slotIdx(slotOf(sentAtMs));
      stats.perSlot[si].sends++;
      const link = seqLinks.find((l) => String(l.channel) === String(s.channel) && (num(l.message_number) ?? -1) === (num(s.message_number) ?? -2));
      if (link) stats.perSlot[si].clicks += num(link.click_count) ?? 0;
    }

    if (outcome === "paid") {
      if (amount !== null) stats.recoveredAmount += amount;
      if (paidAtMs !== null) {
        const label = monthLabel(paidAtMs);
        const cur = perMonth.get(label) ?? { ms: paidAtMs, amount: 0, count: 0 };
        cur.amount += amount ?? 0;
        cur.count++;
        perMonth.set(label, cur);
        // Which message they paid after: distinct messages sent before paid_at.
        const before = sent.filter((s) => (parseMs(s.sent_at) ?? Infinity) <= paidAtMs);
        const n = new Set(before.map((s) => num(s.message_number) ?? num(s.day) ?? 0)).size;
        paidAfter.set(n, (paidAfter.get(n) ?? 0) + 1);
        const firstSent = Math.min(...sent.map((s) => parseMs(s.sent_at) ?? Infinity));
        if (Number.isFinite(firstSent) && paidAtMs >= firstSent) hours.push((paidAtMs - firstSent) / 3600000);
        // Payment credited to the slot of the last message before paid_at.
        const last = before.sort((a, b) => (parseMs(b.sent_at) ?? 0) - (parseMs(a.sent_at) ?? 0))[0];
        const lastMs = last ? parseMs(last.sent_at) : null;
        if (lastMs !== null) stats.perSlot[slotIdx(slotOf(lastMs))].payments++;
      }
    }

    stats.sequences.push({
      membershipId,
      username: str(r.whop_username) ?? str(r.whop_user_id) ?? membershipId,
      plan: (planId && PLAN_NAMES[planId]) || planId || "unknown",
      enteredAt: str(r.started_at) ?? "",
      failedAt,
      messagesSent,
      clicks,
      clicked: clicks > 0,
      replies: seqReplies,
      outcome,
      stopReason: str(r.stop_reason),
      paidAt,
      amount,
      currency: str(r.paid_currency),
    });
  }

  stats.rate = stats.entered > 0 ? stats.recovered / stats.entered : null;
  stats.perMonth = Array.from(perMonth.entries())
    .sort((a, b) => a[1].ms - b[1].ms)
    .map(([month, v]) => ({ month, amount: v.amount, count: v.count }));
  stats.paidAfterMessage = Array.from(paidAfter.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([message, count]) => ({ message, count }));
  stats.hoursToPaid = {
    n: hours.length,
    median: median(hours),
    average: hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : null,
  };
  for (const c of stats.perChannel) c.clickRate = c.sent > 0 ? c.clicked / c.sent : null;
  return stats;
}

// Launch = first live send. null before launch.
export async function launchAtMs(): Promise<number | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("payment_recovery_sends")
    .select("sent_at")
    .eq("status", "sent")
    .order("sent_at", { ascending: true })
    .limit(1);
  if (error) {
    console.error("[recovery-stats] launch read failed", error.message);
    return null;
  }
  const first = data?.[0];
  return first ? parseMs((first as Row).sent_at) : null;
}

// Baseline from Whop: failed renewals in the 90 days before launch and how
// many of them are paid now. Singular filters, every row re-checked locally.
export async function computeBaseline(nowMs: number = Date.now()): Promise<Baseline> {
  const warnings: string[] = [];
  const launch = await launchAtMs();
  const launched = launch !== null;
  const hiMs = launch ?? nowMs;
  const loMs = hiMs - BASELINE_DAYS * 86400000;
  const base: Baseline = {
    ok: false, error: null, launched, launchAt: launch !== null ? new Date(launch).toISOString() : null,
    windowFrom: new Date(loMs).toISOString(), windowTo: new Date(hiMs).toISOString(),
    renewals: 0, failedRenewals: 0, paid: 0, rate: null, warnings,
  };
  const companyId = process.env.WHOP_COMPANY_ID;
  const productId = process.env.WHOP_PRODUCT_ID;
  if (!companyId || !productId) return { ...base, error: "WHOP_COMPANY_ID or WHOP_PRODUCT_ID unset" };
  let after: string | null = null;
  let skipped = 0;
  for (let page = 0; page < BASELINE_MAX_PAGES; page++) {
    const params = new URLSearchParams({
      account_id: companyId,
      product_id: productId,
      billing_reason: "subscription_cycle",
      created_after: new Date(loMs).toISOString(),
      created_before: new Date(hiMs).toISOString(),
      first: "100",
    });
    if (after) params.set("after", after);
    const { status, body } = await whopGet(`payments?${params.toString()}`);
    if (status !== 200) return { ...base, error: `Whop payments HTTP ${status} on page ${page + 1}` };
    const pageBody = body as { data?: unknown[]; page_info?: { has_next_page?: boolean; end_cursor?: string | null } } | null;
    const data = (Array.isArray(pageBody?.data) ? pageBody.data : []).filter((p): p is Row => !!p && typeof p === "object");
    for (const p of data) {
      const created = parseMs(p.created_at);
      const inWindow = created !== null && created >= loMs && created < hiMs;
      const product = str(p.product_id) ?? (p.product && typeof p.product === "object" ? str((p.product as Row).id) : null);
      if (!inWindow || product !== productId || p.billing_reason !== "subscription_cycle") {
        skipped++;
        continue;
      }
      base.renewals++;
      if ((num(p.payments_failed) ?? 0) > 0) {
        base.failedRenewals++;
        if (p.status === "paid") base.paid++;
      }
    }
    const hasNext = pageBody?.page_info?.has_next_page === true;
    const next = pageBody?.page_info?.end_cursor ?? null;
    if (!hasNext || data.length === 0) break;
    if (!next || next === after) return { ...base, error: "Whop payments cursor did not advance" };
    after = next;
    if (page === BASELINE_MAX_PAGES - 1) warnings.push(`stopped after ${BASELINE_MAX_PAGES} pages, baseline is partial`);
  }
  if (skipped > 0) warnings.push(`${skipped} payment rows outside the requested filters were ignored (Whop filter not honored)`);
  base.rate = base.failedRenewals > 0 ? base.paid / base.failedRenewals : null;
  return { ...base, ok: true };
}

export function pct(v: number | null): string {
  return v === null ? "n/a" : `${(v * 100).toFixed(1)}%`;
}
export function usd(v: number): string {
  return `$${v.toFixed(2)}`;
}

// Weekly post: the last 7 days against the baseline, as one embed
// (lib/payment-recovery-post.ts weeklyEmbed).
export async function weeklySummary(nowMs: number = Date.now()): Promise<RecoveryEmbed> {
  const fromMs = nowMs - 7 * 86400000;
  const [stats, baseline] = await Promise.all([loadRecoveryStats(fromMs, nowMs), computeBaseline(nowMs)]);
  return weeklyEmbed(stats, baseline, fromMs, nowMs);
}

export async function postWeeklySummary(nowMs: number = Date.now()): Promise<{ posted: boolean; text: string }> {
  const embed = await weeklySummary(nowMs);
  // postRecoveryEmbed logs to the console when no webhook env is set.
  const posted = (await postRecoveryEmbed(embed)) && !!recoveryWebhookUrl();
  return { posted, text: embed.description ?? "" };
}

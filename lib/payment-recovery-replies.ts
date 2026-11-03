import { createAdminClient } from "./supabase/admin";
import { postToModChannel } from "./discord-kick";
import { openDmChannel } from "./discord-dm";
import { PLAN_NAMES, parseMs } from "./payment-recovery";

// Payment-recovery Discord DM reply capture (migration 032). Runs at the end
// of the hourly payment-recovery cron, after the sends, live mode only.
//
//   1. backfill: members the drip has already DMed (payment_recovery_sends
//      channel discord_dm, status sent) with no payment_recovery_dm_channels
//      row yet get one: POST /users/@me/channels opens (or returns) the bot's
//      DM channel with them; last_seen_message_id starts at a snowflake built
//      from their first drip DM time, so only replies since then count.
//      (The drip itself records the channel on every DM it sends from now on.)
//   2. poll: up to CHANNEL_CAP channels per run, least recently checked
//      first. GET /channels/{id}/messages?after=<last_seen>&limit=100, REST
//      only, no gateway. Every message not written by the bot is a reply:
//      saved to payment_recovery_replies (discord_message_id unique, so a
//      re-read never duplicates) and posted to the mod channel as
//      "DM reply from {discord username} ({plan}, recovery message {n},
//      {time ago}): {text}". last_seen moves to the newest id read, bot
//      messages included, so each message is looked at once.
//   429: one retry after retry_after; a second 429 ends the poll for this run
//   (the rest wait for the next hour). A deadline (ms) stops the poll early so
//   the cron never overruns on a heavy send hour.
//
// Bots read their own DM channels over REST without the message-content
// intent (the intent gates guild messages); an empty content on a reply is
// reported as such so a missing permission shows up in the mod channel.

const DISCORD_API = "https://discord.com/api/v10";
const DISCORD_EPOCH_MS = 1420070400000;
export const CHANNEL_CAP = 50;
const BACKFILL_CAP = 25;
const MOD_TEXT_MAX = 1200;

type Row = Record<string, unknown>;
type DiscordMessage = {
  id?: string;
  content?: string;
  timestamp?: string;
  author?: { id?: string; username?: string; bot?: boolean };
  attachments?: unknown[];
  sticker_items?: unknown[];
  embeds?: unknown[];
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

// Discord snowflake whose timestamp is `ms`: usable as an `after` cursor.
export function snowflakeFromMs(ms: number): string {
  return (BigInt(Math.max(0, Math.floor(ms - DISCORD_EPOCH_MS))) << BigInt(22)).toString();
}

export function timeAgo(fromMs: number, nowMs: number): string {
  const s = Math.max(0, Math.round((nowMs - fromMs) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// GET with one retry on 429. Returns "rate_limited" when the retry is 429 too.
async function discordGet(path: string): Promise<{ status: number; body: unknown } | "rate_limited"> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN unset");
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${DISCORD_API}${path}`, { headers: { Authorization: `Bot ${token}` }, cache: "no-store" });
    if (res.status === 429) {
      if (attempt === 1) return "rate_limited";
      const body = (await res.json().catch(() => ({}))) as { retry_after?: number };
      await sleep(Math.min(10000, Math.ceil((Number(body.retry_after) || 1) * 1000) + 250));
      continue;
    }
    return { status: res.status, body: await res.json().catch(() => null) };
  }
  return "rate_limited";
}

export type ReplyCaptureSummary = {
  backfilled: number;
  backfillErrors: number;
  channelsChecked: number;
  replies: number;
  rateLimited: boolean;
  stoppedAtDeadline: boolean;
  errors: string[];
};

type DmChannelRow = { discord_user_id: string; channel_id: string; whop_user_id: string | null; last_seen_message_id: string | null };

// Members already DMed by the drip that have no channel row yet.
async function backfillChannels(summary: ReplyCaptureSummary, deadlineMs: number): Promise<void> {
  const supabase = createAdminClient();
  const sends = await supabase
    .from("payment_recovery_sends")
    .select("membership_id, sent_at")
    .eq("channel", "discord_dm")
    .eq("status", "sent")
    .order("sent_at", { ascending: true })
    .limit(1000);
  if (sends.error) {
    summary.errors.push(`backfill sends read failed: ${sends.error.message}`);
    return;
  }
  const firstDmByMembership = new Map<string, number>();
  for (const s of (sends.data ?? []) as Row[]) {
    const id = str(s.membership_id);
    const ms = parseMs(s.sent_at);
    if (id && ms !== null && !firstDmByMembership.has(id)) firstDmByMembership.set(id, ms);
  }
  if (firstDmByMembership.size === 0) return;
  const recs = await supabase.from("payment_recovery").select("membership_id, whop_user_id").in("membership_id", Array.from(firstDmByMembership.keys()));
  if (recs.error) {
    summary.errors.push(`backfill payment_recovery read failed: ${recs.error.message}`);
    return;
  }
  const firstDmByUser = new Map<string, number>();
  for (const r of (recs.data ?? []) as Row[]) {
    const user = str(r.whop_user_id);
    const ms = firstDmByMembership.get(str(r.membership_id) ?? "");
    if (!user || ms === undefined) continue;
    const prev = firstDmByUser.get(user);
    if (prev === undefined || ms < prev) firstDmByUser.set(user, ms);
  }
  const users = Array.from(firstDmByUser.keys());
  if (users.length === 0) return;
  const links = await supabase.from("discord_connections").select("whop_user_id, discord_user_id").in("whop_user_id", users);
  if (links.error) {
    summary.errors.push(`backfill discord_connections read failed: ${links.error.message}`);
    return;
  }
  const discordByUser = new Map<string, string>();
  for (const l of (links.data ?? []) as Row[]) {
    const u = str(l.whop_user_id);
    const d = str(l.discord_user_id);
    if (u && d) discordByUser.set(u, d);
  }
  const discordIds = Array.from(discordByUser.values());
  if (discordIds.length === 0) return;
  const have = await supabase.from("payment_recovery_dm_channels").select("discord_user_id").in("discord_user_id", discordIds);
  if (have.error) {
    summary.errors.push(`backfill dm_channels read failed: ${have.error.message}`);
    return;
  }
  const known = new Set(((have.data ?? []) as Row[]).map((r) => str(r.discord_user_id)));
  let opened = 0;
  for (const [whopUserId, discordUserId] of discordByUser) {
    if (known.has(discordUserId)) continue;
    if (opened >= BACKFILL_CAP || Date.now() > deadlineMs) break;
    opened++;
    const channelId = await openDmChannel(discordUserId);
    if (!channelId) {
      summary.backfillErrors++;
      continue;
    }
    const firstDm = firstDmByUser.get(whopUserId) ?? Date.now();
    const { error } = await supabase.from("payment_recovery_dm_channels").upsert(
      { discord_user_id: discordUserId, channel_id: channelId, whop_user_id: whopUserId, last_seen_message_id: snowflakeFromMs(firstDm - 60000), updated_at: new Date().toISOString() },
      { onConflict: "discord_user_id" }
    );
    if (error) {
      summary.backfillErrors++;
      summary.errors.push(`dm_channels upsert failed: ${error.message}`);
    } else summary.backfilled++;
  }
}

// The member's current sequence (newest payment_recovery row for the Whop
// user) and the latest message number sent to them by `atMs`.
async function sequenceFor(whopUserId: string | null, atMs: number): Promise<{ membershipId: string | null; plan: string; messageNumber: number }> {
  if (!whopUserId) return { membershipId: null, plan: "unknown", messageNumber: 0 };
  const supabase = createAdminClient();
  const rec = await supabase
    .from("payment_recovery")
    .select("membership_id, plan_id, failed_at")
    .eq("whop_user_id", whopUserId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const membershipId = str(rec.data?.membership_id);
  if (rec.error || !membershipId) return { membershipId: null, plan: "unknown", messageNumber: 0 };
  const planId = str(rec.data?.plan_id);
  const plan = (planId && PLAN_NAMES[planId]) || planId || "unknown";
  let q = supabase.from("payment_recovery_sends").select("message_number, sent_at").eq("membership_id", membershipId).lte("sent_at", new Date(atMs).toISOString());
  const failedAt = str(rec.data?.failed_at);
  if (failedAt) q = q.eq("failed_at", failedAt);
  const sends = await q;
  let messageNumber = 0;
  for (const s of (sends.data ?? []) as Row[]) {
    const n = Number(s.message_number);
    if (Number.isInteger(n) && n > messageNumber) messageNumber = n;
  }
  return { membershipId, plan, messageNumber };
}

function replyText(m: DiscordMessage): string {
  const content = (m.content ?? "").trim();
  const extras: string[] = [];
  if ((m.attachments?.length ?? 0) > 0) extras.push(`${m.attachments?.length} attachment(s)`);
  if ((m.sticker_items?.length ?? 0) > 0) extras.push("sticker");
  if ((m.embeds?.length ?? 0) > 0 && !content) extras.push("embed");
  if (content) return extras.length ? `${content} [${extras.join(", ")}]` : content;
  if (extras.length) return `[${extras.join(", ")}]`;
  return "[empty content: check the bot's message content access]";
}

export async function captureDmReplies(opts: { now?: number; deadlineMs?: number; cap?: number } = {}): Promise<ReplyCaptureSummary> {
  const now = opts.now ?? Date.now();
  const deadline = opts.deadlineMs ?? now + 40000;
  const cap = opts.cap ?? CHANNEL_CAP;
  const summary: ReplyCaptureSummary = { backfilled: 0, backfillErrors: 0, channelsChecked: 0, replies: 0, rateLimited: false, stoppedAtDeadline: false, errors: [] };
  try {
    await backfillChannels(summary, deadline);

    const me = await discordGet("/users/@me");
    if (me === "rate_limited") {
      summary.rateLimited = true;
      return summary;
    }
    const botId = me.status === 200 ? str((me.body as Row | null)?.id) : null;
    if (!botId) {
      summary.errors.push(`GET /users/@me HTTP ${me.status}`);
      return summary;
    }

    const supabase = createAdminClient();
    const chans = await supabase
      .from("payment_recovery_dm_channels")
      .select("discord_user_id, channel_id, whop_user_id, last_seen_message_id")
      .order("updated_at", { ascending: true })
      .limit(cap);
    if (chans.error) {
      summary.errors.push(`dm_channels read failed: ${chans.error.message}`);
      return summary;
    }
    const rows = (chans.data ?? []) as DmChannelRow[];
    const usernames = new Map<string, string>();
    if (rows.length > 0) {
      const names = await supabase.from("discord_connections").select("discord_user_id, discord_username").in("discord_user_id", rows.map((r) => r.discord_user_id));
      for (const n of (names.data ?? []) as Row[]) {
        const id = str(n.discord_user_id);
        const name = str(n.discord_username);
        if (id && name) usernames.set(id, name);
      }
    }

    for (const row of rows) {
      if (Date.now() > deadline) {
        summary.stoppedAtDeadline = true;
        break;
      }
      const params = new URLSearchParams({ limit: "100" });
      if (row.last_seen_message_id) params.set("after", row.last_seen_message_id);
      const res = await discordGet(`/channels/${row.channel_id}/messages?${params.toString()}`);
      if (res === "rate_limited") {
        summary.rateLimited = true;
        break;
      }
      summary.channelsChecked++;
      if (res.status !== 200 || !Array.isArray(res.body)) {
        summary.errors.push(`channel ${row.channel_id} messages HTTP ${res.status}`);
        await supabase.from("payment_recovery_dm_channels").update({ updated_at: new Date().toISOString() }).eq("discord_user_id", row.discord_user_id);
        continue;
      }
      const messages = (res.body as DiscordMessage[])
        .filter((m) => typeof m?.id === "string")
        .sort((a, b) => (BigInt(a.id as string) < BigInt(b.id as string) ? -1 : 1));
      let newest = row.last_seen_message_id;
      for (const m of messages) {
        const id = m.id as string;
        if (newest === null || BigInt(id) > BigInt(newest)) newest = id;
        if (m.author?.id === botId || m.author?.bot === true) continue;
        const receivedMs = parseMs(m.timestamp) ?? Number((BigInt(id) >> BigInt(22)) + BigInt(DISCORD_EPOCH_MS));
        const seq = await sequenceFor(row.whop_user_id, receivedMs);
        const text = replyText(m);
        const insert = await supabase.from("payment_recovery_replies").insert({
          membership_id: seq.membershipId ?? `discord:${row.discord_user_id}`,
          channel: "discord_dm",
          text,
          received_at: new Date(receivedMs).toISOString(),
          discord_user_id: row.discord_user_id,
          discord_message_id: id,
          message_number: seq.messageNumber || null,
        });
        if (insert.error) {
          if (insert.error.code === "23505") continue; // already recorded
          summary.errors.push(`replies insert failed: ${insert.error.message}`);
          continue;
        }
        summary.replies++;
        const who = usernames.get(row.discord_user_id) ?? m.author?.username ?? row.discord_user_id;
        const shown = text.length > MOD_TEXT_MAX ? `${text.slice(0, MOD_TEXT_MAX)}...` : text;
        await postToModChannel(`💬 DM reply from ${who} (${seq.plan}, recovery message ${seq.messageNumber}, ${timeAgo(receivedMs, now)}): ${shown}`);
      }
      const { error } = await supabase
        .from("payment_recovery_dm_channels")
        .update({ last_seen_message_id: newest, updated_at: new Date().toISOString() })
        .eq("discord_user_id", row.discord_user_id);
      if (error) summary.errors.push(`dm_channels update failed: ${error.message}`);
    }
    return summary;
  } catch (err) {
    summary.errors.push(`threw: ${err instanceof Error ? err.message : "unknown"}`);
    return summary;
  }
}

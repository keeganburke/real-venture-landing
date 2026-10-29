import { createAdminClient } from "./supabase/admin";
import { listPausedMemberships } from "./whop-paused";
import { sendDiscordDm } from "./discord-dm";
import { WHOP_API_VERSION_DATE } from "../app/api/whop/whop-membership";

// Discord auto-kick, shared by the nightly sweep (app/api/cron/discord-sweep)
// and the Whop webhook (membership.deactivated / membership.went_invalid).
//
// Decision rules (decideKick, pure):
//   kick ONLY if the member holds a member role (Base / Pro / Ultra) AND has a
//   discord_connections link AND none of the linked Whop users holds a live
//   membership on ANY product of the company (Real Venture, Real Venture 1-1,
//   Deposit, anything added later). A membership is live if its status is not
//   ended (anything but canceled / expired / drafted: active, trialing,
//   past_due, completed, paused). An ended membership still counts, as
//   paid_time_left, ONLY when the member canceled it themselves
//   (cancel_at_period_end === true) and current_period_end (or
//   renewal_period_end) is still in the future. A canceled membership with
//   cancel_at_period_end false is Whop's dunning cancel after a failed renewal:
//   its current_period_end sits 30 days out but nothing was paid for it, so it
//   is ended. A paused membership is live, logged with its own reason "paused":
//   Whop keeps status active/trialing on it, so paused = listed by
//   GET /memberships?status=paused (primary) OR most_recent_action ===
//   "paused_at" (second signal); either one counts.
//   never kick: bots, the guild owner, allowlisted ids, protected roles (Owner,
//   Founder, Group Coach, Real Venture Underwriter, Moderator, Guest, plus
//   anything DISCORD_PROTECTED_ROLE_IDS adds) or any role carrying kick / ban /
//   admin / manage-guild / manage-roles bits, members with no member role (New
//   Member only, Guest only, boosters, none), members with no link, and anyone
//   who joined the server in the last 7 days.
// Mode: DISCORD_KICK_MODE === "live" AND VERCEL_ENV === "production" removes
// people; anything else (unset, preview, local) is shadow: log + mod post, no
// DELETE. Every sweep posts one summary to DISCORD_MOD_WEBHOOK_URL, and in
// live mode one line per kick; without the URL, console only.
// Before each live kick the member gets a bot DM (KICK_DM); a DM failure never
// blocks the kick.
// Safety: one sweep at a time (discord_sweep_runs lease, 10 minutes, migration
// 028; the webhook kick path skips while a sweep holds it, and both fail
// CLOSED when the table cannot be read); a live user count below 90% of the
// last successful sweep means the Whop read is suspect and the sweep acts on
// no one; more than 25 candidates in one sweep (cap override: ?cap=N, max 60,
// on a manual authorized call only) means act on none; a Whop read that fails
// or looks wrong means act on none; in live mode the first 403 from Discord
// stops the run.

// ---------------------------------------------------------------------------
// Constants (env first, snapshot literals as fallbacks)
// ---------------------------------------------------------------------------

const DISCORD_API = "https://discord.com/api/v10";
const WHOP_API = "https://api.whop.com/api/v1";

export const SWEEP_CAP = 25;
export const SWEEP_CAP_MAX = 60;
export const RECENT_JOIN_DAYS = 7;
const RECENT_JOIN_MS = RECENT_JOIN_DAYS * 24 * 60 * 60 * 1000;
const WHOP_PAGE_LIMIT = 100;
const WHOP_MAX_PAGES = 80;
const MAX_CONSECUTIVE_FAILURES = 5;
const KICK_PAUSE_MS = 1100;
const AUDIT_REASON = "Membership ended (auto sweep)";
const SWEEP_LEASE_MS = 10 * 60 * 1000;
// A live user count below this share of the last successful sweep's aborts the run.
const LIVE_DROP_RATIO = 0.9;
export const KICK_DM =
  "Your Real Venture membership ended, so you've been removed from the Discord. Want back in? https://realventure.io/pricing";

// Statuses that mean the membership is over. Everything else counts as live
// (same set the webhook's membership_ended check uses).
export const ENDED_STATUSES: ReadonlySet<string> = new Set(["canceled", "expired", "drafted"]);

// Permission bits that protect a member (copied from the parked sweep scripts).
// Written with BigInt() calls, not literals: tsconfig targets ES2017.
const BIT = (n: number) => BigInt(1) << BigInt(n);
const PROTECT_PERMS: Record<string, bigint> = {
  KICK_MEMBERS: BIT(1),
  BAN_MEMBERS: BIT(2),
  ADMINISTRATOR: BIT(3),
  MANAGE_GUILD: BIT(5),
  MANAGE_ROLES: BIT(28),
};

const DEFAULT_ROLE_IDS = {
  base: "1543096715249197147",
  pro: "1491892747894784120",
  ultra: "1548052401850941500",
  newMember: "1268122479784628268",
  guest: "1556852317322477598",
  owner: "1268122306107150400",
  founder: "1520610290067308625",
  groupCoach: "1520606504338853979",
  underwriter: "1461080076056789024",
  moderator: "1268122373681451053",
};

function envOr(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : fallback;
}

// Base / Pro / Ultra role ids (env first, snapshot literals as fallbacks).
// Shared with app/api/discord/callback so the connect flow and the sweep agree.
export function tierRoleIds(): { base: string; pro: string; ultra: string } {
  return {
    base: envOr("DISCORD_BASE_ROLE_ID", DEFAULT_ROLE_IDS.base),
    pro: envOr("DISCORD_PRO_ROLE_ID", envOr("DISCORD_ROLE_ID", DEFAULT_ROLE_IDS.pro)),
    ultra: envOr("DISCORD_ULTRA_ROLE_ID", DEFAULT_ROLE_IDS.ultra),
  };
}

export function memberRoleIds(): Set<string> {
  const t = tierRoleIds();
  return new Set([t.base, t.pro, t.ultra]);
}

export function newMemberRoleId(): string {
  return envOr("DISCORD_NEW_MEMBER_ROLE_ID", DEFAULT_ROLE_IDS.newMember);
}

// The five staff roles and Guest are ALWAYS protected. DISCORD_PROTECTED_ROLE_IDS
// (comma separated) can only add ids to that set, never remove one.
export function protectedRoleIds(): Set<string> {
  const ids = new Set([
    DEFAULT_ROLE_IDS.owner,
    DEFAULT_ROLE_IDS.founder,
    DEFAULT_ROLE_IDS.groupCoach,
    DEFAULT_ROLE_IDS.underwriter,
    DEFAULT_ROLE_IDS.moderator,
    envOr("DISCORD_GUEST_ROLE_ID", DEFAULT_ROLE_IDS.guest),
  ]);
  const raw = process.env.DISCORD_PROTECTED_ROLE_IDS;
  if (raw && raw.trim().length > 0) {
    for (const part of raw.split(",")) {
      const id = part.trim();
      if (/^\d{5,}$/.test(id)) ids.add(id);
    }
  }
  return ids;
}

export type KickMode = "shadow" | "live";
// Live needs BOTH switches: the mode flag and Vercel's production environment.
// A preview deployment or a local shell holding production env vars stays shadow.
export function kickMode(): KickMode {
  return process.env.DISCORD_KICK_MODE === "live" && process.env.VERCEL_ENV === "production" ? "live" : "shadow";
}

// ---------------------------------------------------------------------------
// Pure decision
// ---------------------------------------------------------------------------

export type SkipReason =
  | "bot"
  | "guild_owner"
  | "allowlisted"
  | "protected_role"
  | "protected_permission"
  | "no_member_role"
  | "new_member_only"
  | "recent_join"
  | "no_link"
  | "live_membership"
  | "paused"
  | "paid_time_left";

export type KickDecision =
  | { action: "kick"; reason: "no_live_membership" }
  | { action: "skip"; reason: SkipReason };

export type DecideInput = {
  discordUserId: string;
  isBot: boolean;
  isGuildOwner: boolean;
  allowlisted: boolean;
  roleIds: string[];
  // Permission bitfield per role id the member holds (plus @everyone), as strings.
  rolePermissions: Record<string, string>;
  joinedAt: string | null; // ISO; null = unknown (treated as not recent)
  linkedWhopUserIds: string[];
  liveWhopUserIds: ReadonlySet<string>;
  // Whop users whose membership is paused (most_recent_action paused_at) and not otherwise live.
  pausedWhopUserIds?: ReadonlySet<string>;
  // Whop users whose only membership is ended in status but not yet past its period end.
  paidTimeWhopUserIds?: ReadonlySet<string>;
  now?: number;
  rules?: {
    memberRoleIds: ReadonlySet<string>;
    newMemberRoleId: string;
    protectedRoleIds: ReadonlySet<string>;
  };
};

export function decideKick(input: DecideInput): KickDecision {
  const rules = input.rules ?? {
    memberRoleIds: memberRoleIds(),
    newMemberRoleId: newMemberRoleId(),
    protectedRoleIds: protectedRoleIds(),
  };
  if (input.isBot) return { action: "skip", reason: "bot" };
  if (input.isGuildOwner) return { action: "skip", reason: "guild_owner" };
  if (input.allowlisted) return { action: "skip", reason: "allowlisted" };
  if (input.roleIds.some((id) => rules.protectedRoleIds.has(id))) {
    return { action: "skip", reason: "protected_role" };
  }
  for (const bits of Object.values(input.rolePermissions)) {
    let b: bigint;
    try {
      b = BigInt(bits);
    } catch {
      continue;
    }
    if (Object.values(PROTECT_PERMS).some((bit) => (b & bit) !== BigInt(0))) {
      return { action: "skip", reason: "protected_permission" };
    }
  }
  const hasMemberRole = input.roleIds.some((id) => rules.memberRoleIds.has(id));
  if (!hasMemberRole) {
    const onlyNewMember = input.roleIds.includes(rules.newMemberRoleId);
    return { action: "skip", reason: onlyNewMember ? "new_member_only" : "no_member_role" };
  }
  if (input.joinedAt) {
    const joined = new Date(input.joinedAt).getTime();
    const now = input.now ?? Date.now();
    if (!Number.isNaN(joined) && now - joined < RECENT_JOIN_MS) {
      return { action: "skip", reason: "recent_join" };
    }
  }
  if (input.linkedWhopUserIds.length === 0) return { action: "skip", reason: "no_link" };
  if (input.linkedWhopUserIds.some((id) => input.liveWhopUserIds.has(id))) {
    return { action: "skip", reason: "live_membership" };
  }
  const paused = input.pausedWhopUserIds;
  if (paused && input.linkedWhopUserIds.some((id) => paused.has(id))) {
    return { action: "skip", reason: "paused" };
  }
  const paid = input.paidTimeWhopUserIds;
  if (paid && input.linkedWhopUserIds.some((id) => paid.has(id))) {
    return { action: "skip", reason: "paid_time_left" };
  }
  return { action: "kick", reason: "no_live_membership" };
}

// ---------------------------------------------------------------------------
// Discord I/O
// ---------------------------------------------------------------------------

type DiscordRole = { id: string; name: string; permissions: string; managed?: boolean };
type DiscordMember = {
  user?: { id?: string; username?: string; bot?: boolean };
  roles?: string[];
  joined_at?: string;
};

function botToken(): string {
  const t = process.env.DISCORD_BOT_TOKEN;
  if (!t) throw new Error("DISCORD_BOT_TOKEN unset");
  return t;
}
function guildId(): string {
  const g = process.env.DISCORD_GUILD_ID;
  if (!g) throw new Error("DISCORD_GUILD_ID unset");
  return g;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function discordFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = { Authorization: `Bot ${botToken()}`, ...(init.headers as Record<string, string> | undefined) };
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${DISCORD_API}${path}`, { ...init, headers, cache: "no-store" });
    if (res.status === 429 && attempt === 0) {
      const body = (await res.json().catch(() => ({}))) as { retry_after?: number };
      await sleep(Math.ceil((Number(body.retry_after) || 1) * 1000) + 250);
      continue;
    }
    return res;
  }
  throw new Error("unreachable");
}

async function fetchGuild(): Promise<{ owner_id: string | null; name: string | null }> {
  const res = await discordFetch(`/guilds/${guildId()}`);
  if (!res.ok) throw new Error(`GET /guilds returned ${res.status}`);
  const g = (await res.json()) as { owner_id?: string; name?: string };
  return { owner_id: g.owner_id ?? null, name: g.name ?? null };
}

async function fetchRoles(): Promise<Map<string, DiscordRole>> {
  const res = await discordFetch(`/guilds/${guildId()}/roles`);
  if (!res.ok) throw new Error(`GET /guilds/roles returned ${res.status}`);
  const roles = (await res.json()) as DiscordRole[];
  return new Map(roles.map((r) => [r.id, r]));
}

async function fetchAllMembers(): Promise<DiscordMember[]> {
  const out: DiscordMember[] = [];
  let after = "0";
  for (let page = 0; page < 50; page++) {
    const res = await discordFetch(`/guilds/${guildId()}/members?limit=1000&after=${after}`);
    if (res.status === 403) throw new Error("GET /guilds/members 403 (Server Members Intent off or bot lacks access)");
    if (!res.ok) throw new Error(`GET /guilds/members returned ${res.status}`);
    const batch = (await res.json()) as DiscordMember[];
    out.push(...batch);
    if (batch.length < 1000) break;
    const last = batch[batch.length - 1]?.user?.id;
    if (!last || last === after) break;
    after = last;
  }
  return out;
}

async function fetchMember(discordUserId: string): Promise<DiscordMember | null | "error"> {
  const res = await discordFetch(`/guilds/${guildId()}/members/${discordUserId}`);
  if (res.status === 404) return null;
  if (!res.ok) return "error";
  return (await res.json()) as DiscordMember;
}

// The ONLY call in this module that changes anything on Discord.
async function kickMember(discordUserId: string): Promise<number> {
  const res = await discordFetch(`/guilds/${guildId()}/members/${discordUserId}`, {
    method: "DELETE",
    headers: { "X-Audit-Log-Reason": encodeURIComponent(AUDIT_REASON) },
  });
  return res.status;
}

export async function postToModChannel(content: string): Promise<void> {
  const url = process.env.DISCORD_MOD_WEBHOOK_URL;
  if (!url) {
    console.log("[discord-kick] DISCORD_MOD_WEBHOOK_URL unset, summary:\n" + content);
    return;
  }
  // Discord caps a message at 2000 characters; split on lines.
  const chunks: string[] = [];
  let cur = "";
  for (const line of content.split("\n")) {
    if ((cur + "\n" + line).length > 1900) {
      chunks.push(cur);
      cur = line;
    } else {
      cur = cur ? cur + "\n" + line : line;
    }
  }
  if (cur) chunks.push(cur);
  for (const chunk of chunks) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: chunk, allowed_mentions: { parse: [] } }),
      });
      if (!res.ok) console.error("[discord-kick] mod channel post failed", res.status);
    } catch (err) {
      console.error("[discord-kick] mod channel post threw", err instanceof Error ? err.message : "unknown");
    }
  }
}

// ---------------------------------------------------------------------------
// Whop liveness
// ---------------------------------------------------------------------------

function whopHeaders(): Record<string, string> {
  const key = process.env.WHOP_API_KEY;
  if (!key) throw new Error("WHOP_API_KEY unset");
  return { Authorization: `Bearer ${key}`, Accept: "application/json", "Api-Version-Date": WHOP_API_VERSION_DATE };
}

function idOf(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (value && typeof value === "object") {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string" && id.length > 0) return id;
  }
  return null;
}

type MembershipRow = Record<string, unknown>;

function rowOwner(m: MembershipRow): string | null {
  return idOf(m.user) ?? idOf(m.user_id) ?? idOf(m.member) ?? null;
}
function rowStatus(m: MembershipRow): string {
  return typeof m.status === "string" ? m.status : "unknown";
}

// ISO string (what api/v1 returns) or unix seconds / ms; anything else = null.
function toMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value < 1e12 ? value * 1000 : value;
  if (typeof value === "string" && value.length > 0) {
    if (/^\d+$/.test(value)) return toMs(Number(value));
    const t = Date.parse(value);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

// Latest of current_period_end / renewal_period_end, or null when neither parses.
export function rowPeriodEnd(m: MembershipRow): number | null {
  const ends = [toMs(m.current_period_end), toMs(m.renewal_period_end)].filter((t): t is number => t !== null);
  return ends.length ? Math.max(...ends) : null;
}

export type MembershipLiveness = "live" | "paused" | "paid_time_left" | "ended";

// Exact shape of a paused membership on api/v1 (GET /memberships/{id},
// 2026-10-22, mem_LFgWJxU3PVzCrq right after the pause): status stays
// "trialing" / "active", current_period_end is unchanged, and the only pause
// marker is most_recent_action === "paused_at". No payment_collection_paused
// field is returned on any Api-Version-Date.
const EMPTY_IDS: ReadonlySet<string> = new Set();

export function rowIsPaused(m: MembershipRow): boolean {
  return m.most_recent_action === "paused_at";
}

// pausedIds: membership ids from GET /memberships?status=paused (lib/whop-paused.ts).
// Ended statuses: paid_time_left ONLY for a member-initiated cancel
// (cancel_at_period_end === true) whose period has not run out. Whop's own
// dunning cancel leaves cancel_at_period_end false and a current_period_end
// 30 days past the failed renewal that was never paid for, so it is ended.
export function classifyMembership(
  m: MembershipRow,
  now: number = Date.now(),
  pausedIds: ReadonlySet<string> = EMPTY_IDS
): MembershipLiveness {
  if (!ENDED_STATUSES.has(rowStatus(m))) {
    const listed = typeof m.id === "string" && pausedIds.has(m.id);
    return listed || rowIsPaused(m) ? "paused" : "live";
  }
  if (m.cancel_at_period_end !== true) return "ended";
  const end = rowPeriodEnd(m);
  return end !== null && end > now ? "paid_time_left" : "ended";
}

export type LivenessSets = { live: Set<string>; paused: Set<string>; paidTime: Set<string> };

// Per-user rollup: live beats paused beats paid_time_left; a user in no set is ended.
export function addToLiveness(sets: LivenessSets, owner: string, c: MembershipLiveness): void {
  if (c === "live") {
    sets.live.add(owner);
    sets.paused.delete(owner);
    sets.paidTime.delete(owner);
  } else if (c === "paused" && !sets.live.has(owner)) {
    sets.paused.add(owner);
    sets.paidTime.delete(owner);
  } else if (c === "paid_time_left" && !sets.live.has(owner) && !sets.paused.has(owner)) {
    sets.paidTime.add(owner);
  }
}

export type LivenessResult =
  | { ok: true; live: Set<string>; paused: Set<string>; paidTime: Set<string>; rows: number; pages: number }
  | { ok: false; error: string };

// Every membership in the company, EVERY product, all statuses, paged. The
// product filter was dropped on purpose: a live membership on Real Venture
// 1-1, Deposit or any product added later keeps the member. A non-2xx, a
// throw, a cursor that does not advance, too many pages or zero rows means the
// read cannot be trusted and the caller acts on no one; the sweep also
// compares the live count with the previous successful run.
export async function loadLiveWhopUsers(): Promise<LivenessResult> {
  const companyId = process.env.WHOP_COMPANY_ID;
  if (!companyId) return { ok: false, error: "WHOP_COMPANY_ID unset" };
  const sets: LivenessSets = { live: new Set<string>(), paused: new Set<string>(), paidTime: new Set<string>() };
  const now = Date.now();
  // Paused list first: primary paused signal. A failed read aborts the sweep
  // like any other bad Whop read.
  const pausedList = await listPausedMemberships();
  if (!pausedList.ok) return { ok: false, error: `paused list: ${pausedList.error}` };
  const pausedIds = new Set<string>(pausedList.rows.map((m) => String(m.id)));
  let rows = 0;
  let after: string | null = null;
  let pages = 0;
  try {
    for (; pages < WHOP_MAX_PAGES; pages++) {
      const params = new URLSearchParams({ company_id: companyId, first: String(WHOP_PAGE_LIMIT) });
      if (after) params.set("after", after);
      const res = await fetch(`${WHOP_API}/memberships?${params.toString()}`, { headers: whopHeaders(), cache: "no-store" });
      if (!res.ok) return { ok: false, error: `memberships read HTTP ${res.status}` };
      const page = (await res.json().catch(() => null)) as
        | { data?: unknown[]; page_info?: { has_next_page?: boolean; end_cursor?: string | null } }
        | null;
      const data = (Array.isArray(page?.data) ? page!.data : []).filter(
        (m): m is MembershipRow => !!m && typeof m === "object"
      );
      for (const m of data) {
        const owner = rowOwner(m);
        if (!owner) continue;
        rows++;
        addToLiveness(sets, owner, classifyMembership(m, now, pausedIds));
      }
      const hasNext = page?.page_info?.has_next_page === true;
      const next = page?.page_info?.end_cursor ?? null;
      if (!hasNext || data.length === 0) break;
      if (!next || next === after) return { ok: false, error: "memberships cursor did not advance" };
      after = next;
    }
  } catch (err) {
    return { ok: false, error: `memberships read threw: ${err instanceof Error ? err.message : "unknown"}` };
  }
  if (pages >= WHOP_MAX_PAGES) return { ok: false, error: `memberships read exceeded ${WHOP_MAX_PAGES} pages` };
  if (rows === 0) return { ok: false, error: "memberships read returned zero rows" };
  return { ok: true, live: sets.live, paused: sets.paused, paidTime: sets.paidTime, rows, pages: pages + 1 };
}

// One user, every product: singular user_id filter plus an owner check on every
// row, since the plural user_ids filter has been seen ignored on newer Whop API
// versions.
export async function isWhopUserLive(
  whopUserId: string
): Promise<{ ok: true; live: boolean; paused: boolean; paidTimeLeft: boolean; statuses: string[] } | { ok: false; error: string }> {
  const companyId = process.env.WHOP_COMPANY_ID;
  if (!companyId) return { ok: false, error: "WHOP_COMPANY_ID unset" };
  try {
    const params = new URLSearchParams({ company_id: companyId, user_id: whopUserId, first: String(WHOP_PAGE_LIMIT) });
    const res = await fetch(`${WHOP_API}/memberships?${params.toString()}`, { headers: whopHeaders(), cache: "no-store" });
    if (!res.ok) return { ok: false, error: `memberships read HTTP ${res.status}` };
    const page = (await res.json().catch(() => null)) as { data?: unknown[] } | null;
    const data = (Array.isArray(page?.data) ? page!.data : []).filter((m): m is MembershipRow => !!m && typeof m === "object");
    // This user's paused memberships (status=paused + user_id), owner-checked.
    const pq = new URLSearchParams({ company_id: companyId, user_id: whopUserId, status: "paused", first: "50" });
    const pres = await fetch(`${WHOP_API}/memberships?${pq.toString()}`, { headers: whopHeaders(), cache: "no-store" });
    if (!pres.ok) return { ok: false, error: `paused list HTTP ${pres.status}` };
    const ppage = (await pres.json().catch(() => null)) as { data?: unknown[] } | null;
    const pausedIds = new Set<string>();
    for (const m of (Array.isArray(ppage?.data) ? ppage!.data : []).filter((x): x is MembershipRow => !!x && typeof x === "object")) {
      const owner = rowOwner(m);
      if (owner !== null && owner !== whopUserId) return { ok: false, error: "foreign user in paused list (user_id filter ignored)" };
      if (typeof m.id === "string") pausedIds.add(m.id);
    }
    const statuses: string[] = [];
    const now = Date.now();
    let live = false;
    let paused = false;
    let paidTimeLeft = false;
    for (const m of data) {
      const owner = rowOwner(m);
      if (owner !== null && owner !== whopUserId) return { ok: false, error: "foreign user in memberships read (user_id filter ignored)" };
      statuses.push(rowStatus(m));
      const c = classifyMembership(m, now, pausedIds);
      if (c === "live") live = true;
      else if (c === "paused") paused = true;
      else if (c === "paid_time_left") paidTimeLeft = true;
    }
    return { ok: true, live, paused: paused && !live, paidTimeLeft: paidTimeLeft && !live && !paused, statuses };
  } catch (err) {
    return { ok: false, error: `memberships read threw: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

// ---------------------------------------------------------------------------
// Supabase: links, allowlist, log
// ---------------------------------------------------------------------------

async function loadLinks(): Promise<Map<string, string[]>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("discord_connections").select("discord_user_id, whop_user_id");
  if (error) throw new Error(`discord_connections read failed: ${error.message}`);
  const map = new Map<string, string[]>();
  for (const row of data ?? []) {
    const d = typeof row.discord_user_id === "string" ? row.discord_user_id : null;
    const w = typeof row.whop_user_id === "string" ? row.whop_user_id : null;
    if (!d || !w) continue;
    const list = map.get(d) ?? [];
    list.push(w);
    map.set(d, list);
  }
  return map;
}

async function loadAllowlist(): Promise<Set<string>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("discord_kick_allowlist").select("discord_user_id");
  if (error) throw new Error(`discord_kick_allowlist read failed: ${error.message}`);
  return new Set((data ?? []).map((r) => r.discord_user_id as string).filter((s) => typeof s === "string"));
}

export type LogAction = "kicked" | "would_kick" | "skipped" | "failed";
export type LogSource = "webhook" | "sweep";

async function logDecisions(
  rows: { discord_user_id: string; whop_user_ids: string[]; reason: string; mode: KickMode; action: LogAction; source: LogSource }[]
): Promise<void> {
  if (rows.length === 0) return;
  try {
    const supabase = createAdminClient();
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await supabase.from("discord_kick_log").insert(rows.slice(i, i + 200));
      if (error) console.error("[discord-kick] log insert failed", error.message);
    }
  } catch (err) {
    console.error("[discord-kick] log insert threw", err instanceof Error ? err.message : "unknown");
  }
}

// ---------------------------------------------------------------------------
// Sweep runs: lease, previous live count, run record (discord_sweep_runs, 028)
// ---------------------------------------------------------------------------

type SweepLease = { ok: true; runId: number } | { ok: false; error: string };

// One sweep at a time. Leases past their expiry are released first, then the
// insert races on the partial unique index (one row with status 'running');
// the loser gets 23505. Any other failure (table missing, Supabase down) fails
// CLOSED: no lease, no sweep.
async function acquireSweepLease(mode: KickMode): Promise<SweepLease> {
  try {
    const supabase = createAdminClient();
    const nowIso = new Date().toISOString();
    const { error: expireError } = await supabase
      .from("discord_sweep_runs")
      .update({ status: "expired", finished_at: nowIso, aborted_reason: "lease expired" })
      .eq("status", "running")
      .lt("lease_expires_at", nowIso);
    if (expireError) return { ok: false, error: `lease expiry update failed: ${expireError.message}` };
    const { data, error } = await supabase
      .from("discord_sweep_runs")
      .insert({ mode, status: "running", lease_expires_at: new Date(Date.now() + SWEEP_LEASE_MS).toISOString() })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") return { ok: false, error: "another sweep is running (lease held)" };
      return { ok: false, error: `lease insert failed: ${error.message}` };
    }
    const runId = Number(data?.id);
    if (!Number.isFinite(runId)) return { ok: false, error: "lease insert returned no id" };
    return { ok: true, runId };
  } catch (err) {
    return { ok: false, error: `lease threw: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

// live_count of the most recent run whose Whop read was accepted (whop_read_ok),
// or null when there is none yet (first run after migration 028).
async function lastAcceptedLiveCount(): Promise<{ ok: true; live: number | null } | { ok: false; error: string }> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("discord_sweep_runs")
      .select("live_count")
      .eq("whop_read_ok", true)
      .not("live_count", "is", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { ok: false, error: `previous run read failed: ${error.message}` };
    const live = data && typeof data.live_count === "number" ? data.live_count : null;
    return { ok: true, live };
  } catch (err) {
    return { ok: false, error: `previous run read threw: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

async function finishSweepRun(runId: number, patch: Record<string, unknown>): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("discord_sweep_runs")
      .update({ ...patch, finished_at: new Date().toISOString() })
      .eq("id", runId);
    if (error) console.error("[discord-kick] sweep run update failed", error.message);
  } catch (err) {
    console.error("[discord-kick] sweep run update threw", err instanceof Error ? err.message : "unknown");
  }
}

// "running" while a sweep holds an unexpired lease; "unknown" when the table
// cannot be read (the webhook path then skips: fail closed).
async function sweepLeaseState(): Promise<"running" | "idle" | "unknown"> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("discord_sweep_runs")
      .select("id")
      .eq("status", "running")
      .gt("lease_expires_at", new Date().toISOString())
      .limit(1);
    if (error) {
      console.error("[discord-kick] sweep lease read failed", error.message);
      return "unknown";
    }
    return (data ?? []).length > 0 ? "running" : "idle";
  } catch (err) {
    console.error("[discord-kick] sweep lease read threw", err instanceof Error ? err.message : "unknown");
    return "unknown";
  }
}

// ---------------------------------------------------------------------------
// Sweep
// ---------------------------------------------------------------------------

export type SweepSummary = {
  mode: KickMode;
  run_id: number | null;
  scanned: number;
  candidates: number;
  whop_rows: number | null;
  whop_live: number | null;
  previous_live: number | null;
  kicked: string[];
  would_kick: string[];
  failed: string[];
  dm_sent: number;
  dm_failed: number;
  counts: Record<SkipReason | "cap_exceeded", number>;
  aborted: string | null;
};

function emptyCounts(): SweepSummary["counts"] {
  return {
    bot: 0,
    guild_owner: 0,
    allowlisted: 0,
    protected_role: 0,
    protected_permission: 0,
    no_member_role: 0,
    new_member_only: 0,
    recent_join: 0,
    no_link: 0,
    live_membership: 0,
    paused: 0,
    paid_time_left: 0,
    cap_exceeded: 0,
  };
}

function label(m: DiscordMember): string {
  const id = m.user?.id ?? "?";
  const name = m.user?.username ? ` (${m.user.username})` : "";
  return `${id}${name}`;
}

function formatSummary(source: LogSource, s: SweepSummary, guildName: string | null): string {
  const head = source === "sweep" ? "Discord sweep" : "Discord webhook check";
  const lines = [
    `**${head}** ${guildName ? `for ${guildName} ` : ""}| mode **${s.mode}** | scanned ${s.scanned} | candidates ${s.candidates}`,
  ];
  if (s.aborted) lines.push(`ALERT: ${s.aborted}. Acted on no one.`);
  if (source === "sweep") {
    lines.push(`whop: rows ${s.whop_rows ?? "?"} | live users ${s.whop_live ?? "?"} | previous run ${s.previous_live ?? "none"}`);
  }
  const acted = s.mode === "live" ? s.kicked : s.would_kick;
  lines.push(`${s.mode === "live" ? "kicked" : "would kick"}: ${acted.length}${acted.length ? " -> " + acted.join(", ") : ""}`);
  if (s.mode === "live") lines.push(`kick DMs: sent ${s.dm_sent} | failed ${s.dm_failed}`);
  if (s.failed.length) lines.push(`failed: ${s.failed.length} -> ${s.failed.join(", ")}`);
  const c = s.counts;
  lines.push(
    `skips: no_link ${c.no_link} | new_member_only ${c.new_member_only} | live_membership ${c.live_membership} | paused ${c.paused} | paid_time_left ${c.paid_time_left} | ` +
      `protected ${c.protected_role + c.protected_permission} | allowlisted ${c.allowlisted} | recent_join ${c.recent_join} | ` +
      `cap_exceeded ${c.cap_exceeded} | no_member_role ${c.no_member_role} | bots ${c.bot} | owner ${c.guild_owner}`
  );
  return lines.join("\n");
}

// cap: candidate ceiling for this run; the route passes a value only for an
// authorized manual call with ?cap=N. Clamped to 1..SWEEP_CAP_MAX.
export async function runDiscordSweep(opts: { cap?: number } = {}): Promise<SweepSummary> {
  const mode = kickMode();
  const cap = Math.min(Math.max(Math.floor(opts.cap ?? SWEEP_CAP), 1), SWEEP_CAP_MAX);
  const summary: SweepSummary = {
    mode,
    run_id: null,
    scanned: 0,
    candidates: 0,
    whop_rows: null,
    whop_live: null,
    previous_live: null,
    kicked: [],
    would_kick: [],
    failed: [],
    dm_sent: 0,
    dm_failed: 0,
    counts: emptyCounts(),
    aborted: null,
  };
  let guildName: string | null = null;
  const logRows: Parameters<typeof logDecisions>[0] = [];

  // One sweep at a time (discord_sweep_runs lease). No lease, no sweep.
  const lease = await acquireSweepLease(mode);
  if (!lease.ok) {
    summary.aborted = `sweep lock: ${lease.error}`;
    await postToModChannel(formatSummary("sweep", summary, guildName));
    return summary;
  }
  summary.run_id = lease.runId;
  let whopReadOk = false;
  let pausedCount: number | null = null;
  let paidTimeCount: number | null = null;

  try {
    const [guild, roles, members, links, allowlist, liveness, previous] = await Promise.all([
      fetchGuild(),
      fetchRoles(),
      fetchAllMembers(),
      loadLinks(),
      loadAllowlist(),
      loadLiveWhopUsers(),
      lastAcceptedLiveCount(),
    ]);
    guildName = guild.name;
    summary.scanned = members.length;

    if (!liveness.ok) {
      summary.aborted = `Whop membership read failed: ${liveness.error}`;
      await postToModChannel(formatSummary("sweep", summary, guildName));
      return summary;
    }
    summary.whop_rows = liveness.rows;
    summary.whop_live = liveness.live.size;
    pausedCount = liveness.paused.size;
    paidTimeCount = liveness.paidTime.size;
    if (!previous.ok) {
      summary.aborted = `previous sweep read failed: ${previous.error}`;
      await postToModChannel(formatSummary("sweep", summary, guildName));
      return summary;
    }
    summary.previous_live = previous.live;
    // Truncated-data guard: a well-formed but short read (missing page, early
    // has_next_page false) would turn live members into candidates. Compare
    // with the last accepted run before trusting this one.
    if (previous.live !== null && liveness.live.size < previous.live * LIVE_DROP_RATIO) {
      summary.aborted =
        `Whop live users ${liveness.live.size} is below ${Math.round(LIVE_DROP_RATIO * 100)}% of the last accepted sweep (${previous.live}); read looks truncated`;
      await postToModChannel(formatSummary("sweep", summary, guildName));
      return summary;
    }
    whopReadOk = true;

    const rules = { memberRoleIds: memberRoleIds(), newMemberRoleId: newMemberRoleId(), protectedRoleIds: protectedRoleIds() };
    const everyone = roles.get(guildId());
    const candidates: { member: DiscordMember; id: string; whop: string[] }[] = [];

    for (const m of members) {
      const id = m.user?.id;
      if (!id) continue;
      const roleIds = m.roles ?? [];
      const rolePermissions: Record<string, string> = {};
      for (const rid of roleIds) {
        const r = roles.get(rid);
        if (r) rolePermissions[rid] = r.permissions;
      }
      if (everyone) rolePermissions[everyone.id] = everyone.permissions;
      const whop = links.get(id) ?? [];
      const decision = decideKick({
        discordUserId: id,
        isBot: m.user?.bot === true,
        isGuildOwner: guild.owner_id !== null && id === guild.owner_id,
        allowlisted: allowlist.has(id),
        roleIds,
        rolePermissions,
        joinedAt: m.joined_at ?? null,
        linkedWhopUserIds: whop,
        liveWhopUserIds: liveness.live,
        pausedWhopUserIds: liveness.paused,
        paidTimeWhopUserIds: liveness.paidTime,
        rules,
      });
      if (decision.action === "skip") {
        summary.counts[decision.reason]++;
        // Log skips of people who hold a member role (the interesting ones).
        const holdsMemberRole = roleIds.some((rid) => rules.memberRoleIds.has(rid));
        if (holdsMemberRole && decision.reason !== "no_member_role") {
          logRows.push({ discord_user_id: id, whop_user_ids: whop, reason: decision.reason, mode, action: "skipped", source: "sweep" });
        }
        continue;
      }
      candidates.push({ member: m, id, whop });
    }
    summary.candidates = candidates.length;

    if (candidates.length > cap) {
      summary.aborted = `${candidates.length} kick candidates exceed the cap of ${cap}`;
      summary.counts.cap_exceeded = candidates.length;
      for (const c of candidates) {
        logRows.push({ discord_user_id: c.id, whop_user_ids: c.whop, reason: "cap_exceeded", mode, action: "skipped", source: "sweep" });
      }
      await logDecisions(logRows);
      await postToModChannel(formatSummary("sweep", summary, guildName));
      return summary;
    }

    let consecutiveFailures = 0;
    for (const c of candidates) {
      if (mode !== "live") {
        summary.would_kick.push(label(c.member));
        logRows.push({ discord_user_id: c.id, whop_user_ids: c.whop, reason: "no_live_membership", mode, action: "would_kick", source: "sweep" });
        continue;
      }
      // DM first (a kicked member can no longer be DMed by the bot). Failure
      // is counted and never blocks the kick.
      if (await sendDiscordDm(c.id, KICK_DM)) summary.dm_sent++;
      else summary.dm_failed++;
      const status = await kickMember(c.id);
      if (status === 204) {
        summary.kicked.push(label(c.member));
        logRows.push({ discord_user_id: c.id, whop_user_ids: c.whop, reason: "no_live_membership", mode, action: "kicked", source: "sweep" });
        await postToModChannel(`**Discord sweep** | mode **live** | kicked ${label(c.member)} (no_live_membership)`);
        consecutiveFailures = 0;
      } else if (status === 403) {
        summary.failed.push(label(c.member));
        logRows.push({ discord_user_id: c.id, whop_user_ids: c.whop, reason: "discord_403", mode, action: "failed", source: "sweep" });
        summary.aborted = "Bot lost Kick Members or role too low (Discord 403). Run stopped";
        break;
      } else if (status === 404) {
        // Already gone; nothing to do.
        logRows.push({ discord_user_id: c.id, whop_user_ids: c.whop, reason: "already_gone", mode, action: "skipped", source: "sweep" });
      } else {
        summary.failed.push(label(c.member));
        logRows.push({ discord_user_id: c.id, whop_user_ids: c.whop, reason: `discord_${status}`, mode, action: "failed", source: "sweep" });
        consecutiveFailures++;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          summary.aborted = `${MAX_CONSECUTIVE_FAILURES} consecutive Discord failures. Run stopped`;
          break;
        }
      }
      await sleep(KICK_PAUSE_MS);
    }
  } catch (err) {
    summary.aborted = `sweep threw: ${err instanceof Error ? err.message : "unknown"}`;
  } finally {
    // Runs on every exit above, early returns included: release the lease and
    // record the counts the next run compares against.
    await finishSweepRun(lease.runId, {
      status: summary.aborted ? "aborted" : "ok",
      aborted_reason: summary.aborted,
      whop_read_ok: whopReadOk,
      rows_read: summary.whop_rows,
      live_count: summary.whop_live,
      paused_count: pausedCount,
      paid_time_count: paidTimeCount,
      scanned: summary.scanned,
      candidates: summary.candidates,
      kicked: summary.kicked.length,
      would_kick: summary.would_kick.length,
      failed: summary.failed.length,
      dm_sent: summary.dm_sent,
      dm_failed: summary.dm_failed,
    });
  }

  await logDecisions(logRows);
  await postToModChannel(formatSummary("sweep", summary, guildName));
  return summary;
}

// ---------------------------------------------------------------------------
// Webhook path: one member, same rules
// ---------------------------------------------------------------------------

export type WebhookCheckResult = {
  action: LogAction | "not_in_server" | "aborted";
  reason: string;
  mode: KickMode;
};

export async function checkOneFromWebhook(whopUserId: string, discordUserId: string): Promise<WebhookCheckResult> {
  const mode = kickMode();
  const line = (text: string) => postToModChannel(`**Discord webhook check** | mode **${mode}** | ${text}`);
  try {
    const [guild, roles, member, allowlist, liveness] = await Promise.all([
      fetchGuild(),
      fetchRoles(),
      fetchMember(discordUserId),
      loadAllowlist(),
      isWhopUserLive(whopUserId),
    ]);
    if (member === null) {
      await line(`${discordUserId}: not in server`);
      return { action: "not_in_server", reason: "not_in_server", mode };
    }
    if (member === "error") {
      await line(`ALERT: ${discordUserId}: Discord member read failed. Acted on no one.`);
      return { action: "aborted", reason: "discord_member_read_failed", mode };
    }
    if (!liveness.ok) {
      await line(`ALERT: ${discordUserId}: Whop membership read failed (${liveness.error}). Acted on no one.`);
      return { action: "aborted", reason: liveness.error, mode };
    }
    // Any other Whop user linked to this Discord id counts too (1:1 today).
    const links = await loadLinks();
    const whop = Array.from(new Set([whopUserId, ...(links.get(discordUserId) ?? [])]));
    const live = new Set<string>();
    const paused = new Set<string>();
    const paidTime = new Set<string>();
    if (liveness.live) live.add(whopUserId);
    if (liveness.paused) paused.add(whopUserId);
    if (liveness.paidTimeLeft) paidTime.add(whopUserId);
    for (const other of whop) {
      if (other === whopUserId) continue;
      const r = await isWhopUserLive(other);
      if (!r.ok) {
        await line(`ALERT: ${discordUserId}: Whop membership read failed for a linked user (${r.error}). Acted on no one.`);
        return { action: "aborted", reason: r.error, mode };
      }
      if (r.live) live.add(other);
      if (r.paused) paused.add(other);
      if (r.paidTimeLeft) paidTime.add(other);
    }
    const roleIds = member.roles ?? [];
    const rolePermissions: Record<string, string> = {};
    for (const rid of roleIds) {
      const r = roles.get(rid);
      if (r) rolePermissions[rid] = r.permissions;
    }
    const everyone = roles.get(guildId());
    if (everyone) rolePermissions[everyone.id] = everyone.permissions;

    const decision = decideKick({
      discordUserId,
      isBot: member.user?.bot === true,
      isGuildOwner: guild.owner_id !== null && discordUserId === guild.owner_id,
      allowlisted: allowlist.has(discordUserId),
      roleIds,
      rolePermissions,
      joinedAt: member.joined_at ?? null,
      linkedWhopUserIds: whop,
      liveWhopUserIds: live,
      pausedWhopUserIds: paused,
      paidTimeWhopUserIds: paidTime,
    });

    if (decision.action === "skip") {
      await logDecisions([{ discord_user_id: discordUserId, whop_user_ids: whop, reason: decision.reason, mode, action: "skipped", source: "webhook" }]);
      await line(`${label(member)}: skipped (${decision.reason}) | statuses ${liveness.statuses.join(",") || "none"}`);
      return { action: "skipped", reason: decision.reason, mode };
    }

    // Never act while a sweep holds the lease (it will decide on this member
    // itself), and never act when the lease table cannot be read.
    const leaseState = await sweepLeaseState();
    if (leaseState !== "idle") {
      const reason = leaseState === "running" ? "sweep_running" : "sweep_lock_unavailable";
      await logDecisions([{ discord_user_id: discordUserId, whop_user_ids: whop, reason, mode, action: "skipped", source: "webhook" }]);
      await line(`${label(member)}: skipped (${reason}) | statuses ${liveness.statuses.join(",") || "none"}`);
      return { action: "skipped", reason, mode };
    }

    if (mode !== "live") {
      await logDecisions([{ discord_user_id: discordUserId, whop_user_ids: whop, reason: "no_live_membership", mode, action: "would_kick", source: "webhook" }]);
      await line(`would kick ${label(member)} (no_live_membership) | statuses ${liveness.statuses.join(",") || "none"}`);
      return { action: "would_kick", reason: "no_live_membership", mode };
    }

    // DM first (a kicked member can no longer be DMed by the bot); a failed DM
    // never blocks the kick.
    const dmSent = await sendDiscordDm(discordUserId, KICK_DM);
    const status = await kickMember(discordUserId);
    if (status === 204) {
      await logDecisions([{ discord_user_id: discordUserId, whop_user_ids: whop, reason: "no_live_membership", mode, action: "kicked", source: "webhook" }]);
      await line(`kicked ${label(member)} (no_live_membership) | dm ${dmSent ? "sent" : "failed"}`);
      return { action: "kicked", reason: "no_live_membership", mode };
    }
    const reason = status === 403 ? "discord_403" : `discord_${status}`;
    await logDecisions([{ discord_user_id: discordUserId, whop_user_ids: whop, reason, mode, action: "failed", source: "webhook" }]);
    await line(
      status === 403
        ? `ALERT: Bot lost Kick Members or role too low (403) while handling ${label(member)}`
        : `failed to kick ${label(member)} (HTTP ${status})`
    );
    return { action: "failed", reason, mode };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    await line(`ALERT: ${discordUserId}: check threw (${msg}). Acted on no one.`);
    return { action: "aborted", reason: msg, mode };
  }
}

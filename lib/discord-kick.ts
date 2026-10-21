import { createAdminClient } from "./supabase/admin";

// Discord auto-kick, shared by the nightly sweep (app/api/cron/discord-sweep)
// and the Whop webhook (membership.deactivated / membership.went_invalid).
//
// Decision rules (decideKick, pure):
//   kick ONLY if the member holds a member role (Base / Pro / Ultra) AND has a
//   discord_connections link AND none of the linked Whop users holds a
//   membership on WHOP_PRODUCT_ID in a live status (anything that is not
//   canceled / expired / drafted: active, trialing, past_due, completed, paused).
//   never kick: bots, the guild owner, allowlisted ids, protected roles (Owner,
//   Founder, Group Coach, Real Venture Underwriter, Moderator, Guest) or any
//   role carrying kick / ban / admin / manage-guild / manage-roles bits, members
//   with no member role (New Member only, Guest only, boosters, none), members
//   with no link, and anyone who joined the server in the last 7 days.
// Mode: DISCORD_KICK_MODE === "live" removes people; anything else is shadow
// (log + mod post, no DELETE). Every sweep posts one summary to
// DISCORD_MOD_WEBHOOK_URL; without it, console only.
// Safety: more than 25 candidates in one sweep means act on none; a Whop read
// that fails or looks wrong means act on none; in live mode the first 403 from
// Discord stops the run.

// ---------------------------------------------------------------------------
// Constants (env first, snapshot literals as fallbacks)
// ---------------------------------------------------------------------------

const DISCORD_API = "https://discord.com/api/v10";
const WHOP_API = "https://api.whop.com/api/v1";

export const SWEEP_CAP = 25;
export const RECENT_JOIN_DAYS = 7;
const RECENT_JOIN_MS = RECENT_JOIN_DAYS * 24 * 60 * 60 * 1000;
const WHOP_PAGE_LIMIT = 100;
const WHOP_MAX_PAGES = 80;
const MAX_CONSECUTIVE_FAILURES = 5;
const KICK_PAUSE_MS = 1100;
const AUDIT_REASON = "Membership ended (auto sweep)";

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

export function memberRoleIds(): Set<string> {
  return new Set([
    envOr("DISCORD_BASE_ROLE_ID", DEFAULT_ROLE_IDS.base),
    envOr("DISCORD_PRO_ROLE_ID", envOr("DISCORD_ROLE_ID", DEFAULT_ROLE_IDS.pro)),
    envOr("DISCORD_ULTRA_ROLE_ID", DEFAULT_ROLE_IDS.ultra),
  ]);
}

export function newMemberRoleId(): string {
  return envOr("DISCORD_NEW_MEMBER_ROLE_ID", DEFAULT_ROLE_IDS.newMember);
}

// DISCORD_PROTECTED_ROLE_IDS (comma separated) replaces the default list when set.
export function protectedRoleIds(): Set<string> {
  const raw = process.env.DISCORD_PROTECTED_ROLE_IDS;
  if (raw && raw.trim().length > 0) {
    return new Set(raw.split(",").map((s) => s.trim()).filter((s) => /^\d{5,}$/.test(s)));
  }
  return new Set([
    DEFAULT_ROLE_IDS.owner,
    DEFAULT_ROLE_IDS.founder,
    DEFAULT_ROLE_IDS.groupCoach,
    DEFAULT_ROLE_IDS.underwriter,
    DEFAULT_ROLE_IDS.moderator,
    envOr("DISCORD_GUEST_ROLE_ID", DEFAULT_ROLE_IDS.guest),
  ]);
}

export type KickMode = "shadow" | "live";
export function kickMode(): KickMode {
  return process.env.DISCORD_KICK_MODE === "live" ? "live" : "shadow";
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
  | "live_membership";

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

async function postToModChannel(content: string): Promise<void> {
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
  return { Authorization: `Bearer ${key}`, Accept: "application/json" };
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
function rowProduct(m: MembershipRow): string | null {
  return idOf(m.product) ?? idOf(m.product_id) ?? null;
}
function rowStatus(m: MembershipRow): string {
  return typeof m.status === "string" ? m.status : "unknown";
}

export type LivenessResult =
  | { ok: true; live: Set<string>; rows: number; pages: number }
  | { ok: false; error: string };

// Every membership on WHOP_PRODUCT_ID, all statuses, paged. A row for another
// product, a cursor that does not advance, or zero rows means the read cannot
// be trusted and the caller acts on no one.
export async function loadLiveWhopUsers(): Promise<LivenessResult> {
  const companyId = process.env.WHOP_COMPANY_ID;
  const productId = process.env.WHOP_PRODUCT_ID;
  if (!companyId || !productId) return { ok: false, error: "WHOP_COMPANY_ID or WHOP_PRODUCT_ID unset" };
  const live = new Set<string>();
  let rows = 0;
  let after: string | null = null;
  let pages = 0;
  try {
    for (; pages < WHOP_MAX_PAGES; pages++) {
      const params = new URLSearchParams({ company_id: companyId, first: String(WHOP_PAGE_LIMIT) });
      params.append("product_ids", productId);
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
        const product = rowProduct(m);
        if (product !== null && product !== productId) {
          return { ok: false, error: "foreign product in memberships read (product_ids filter ignored)" };
        }
        const owner = rowOwner(m);
        if (!owner) continue;
        rows++;
        if (!ENDED_STATUSES.has(rowStatus(m))) live.add(owner);
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
  return { ok: true, live, rows, pages: pages + 1 };
}

// One user: singular user_id filter plus an owner check on every row, since the
// plural user_ids filter has been seen ignored on newer Whop API versions.
export async function isWhopUserLive(whopUserId: string): Promise<{ ok: true; live: boolean; statuses: string[] } | { ok: false; error: string }> {
  const companyId = process.env.WHOP_COMPANY_ID;
  const productId = process.env.WHOP_PRODUCT_ID;
  if (!companyId || !productId) return { ok: false, error: "WHOP_COMPANY_ID or WHOP_PRODUCT_ID unset" };
  try {
    const params = new URLSearchParams({ company_id: companyId, user_id: whopUserId, first: String(WHOP_PAGE_LIMIT) });
    params.append("product_ids", productId);
    const res = await fetch(`${WHOP_API}/memberships?${params.toString()}`, { headers: whopHeaders(), cache: "no-store" });
    if (!res.ok) return { ok: false, error: `memberships read HTTP ${res.status}` };
    const page = (await res.json().catch(() => null)) as { data?: unknown[] } | null;
    const data = (Array.isArray(page?.data) ? page!.data : []).filter((m): m is MembershipRow => !!m && typeof m === "object");
    const statuses: string[] = [];
    let live = false;
    for (const m of data) {
      const owner = rowOwner(m);
      if (owner !== null && owner !== whopUserId) return { ok: false, error: "foreign user in memberships read (user_id filter ignored)" };
      const product = rowProduct(m);
      if (product !== null && product !== productId) continue; // other products never count as live
      const st = rowStatus(m);
      statuses.push(st);
      if (!ENDED_STATUSES.has(st)) live = true;
    }
    return { ok: true, live, statuses };
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
// Sweep
// ---------------------------------------------------------------------------

export type SweepSummary = {
  mode: KickMode;
  scanned: number;
  candidates: number;
  kicked: string[];
  would_kick: string[];
  failed: string[];
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
  const acted = s.mode === "live" ? s.kicked : s.would_kick;
  lines.push(`${s.mode === "live" ? "kicked" : "would kick"}: ${acted.length}${acted.length ? " -> " + acted.join(", ") : ""}`);
  if (s.failed.length) lines.push(`failed: ${s.failed.length} -> ${s.failed.join(", ")}`);
  const c = s.counts;
  lines.push(
    `skips: no_link ${c.no_link} | new_member_only ${c.new_member_only} | live_membership ${c.live_membership} | ` +
      `protected ${c.protected_role + c.protected_permission} | allowlisted ${c.allowlisted} | recent_join ${c.recent_join} | ` +
      `cap_exceeded ${c.cap_exceeded} | no_member_role ${c.no_member_role} | bots ${c.bot} | owner ${c.guild_owner}`
  );
  return lines.join("\n");
}

export async function runDiscordSweep(): Promise<SweepSummary> {
  const mode = kickMode();
  const summary: SweepSummary = {
    mode,
    scanned: 0,
    candidates: 0,
    kicked: [],
    would_kick: [],
    failed: [],
    counts: emptyCounts(),
    aborted: null,
  };
  let guildName: string | null = null;
  const logRows: Parameters<typeof logDecisions>[0] = [];

  try {
    const [guild, roles, members, links, allowlist, liveness] = await Promise.all([
      fetchGuild(),
      fetchRoles(),
      fetchAllMembers(),
      loadLinks(),
      loadAllowlist(),
      loadLiveWhopUsers(),
    ]);
    guildName = guild.name;
    summary.scanned = members.length;

    if (!liveness.ok) {
      summary.aborted = `Whop membership read failed: ${liveness.error}`;
      await postToModChannel(formatSummary("sweep", summary, guildName));
      return summary;
    }

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

    if (candidates.length > SWEEP_CAP) {
      summary.aborted = `${candidates.length} kick candidates exceed the cap of ${SWEEP_CAP}`;
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
      const status = await kickMember(c.id);
      if (status === 204) {
        summary.kicked.push(label(c.member));
        logRows.push({ discord_user_id: c.id, whop_user_ids: c.whop, reason: "no_live_membership", mode, action: "kicked", source: "sweep" });
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
    if (liveness.live) live.add(whopUserId);
    for (const other of whop) {
      if (other === whopUserId) continue;
      const r = await isWhopUserLive(other);
      if (!r.ok) {
        await line(`ALERT: ${discordUserId}: Whop membership read failed for a linked user (${r.error}). Acted on no one.`);
        return { action: "aborted", reason: r.error, mode };
      }
      if (r.live) live.add(other);
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
    });

    if (decision.action === "skip") {
      await logDecisions([{ discord_user_id: discordUserId, whop_user_ids: whop, reason: decision.reason, mode, action: "skipped", source: "webhook" }]);
      await line(`${label(member)}: skipped (${decision.reason}) | statuses ${liveness.statuses.join(",") || "none"}`);
      return { action: "skipped", reason: decision.reason, mode };
    }

    if (mode !== "live") {
      await logDecisions([{ discord_user_id: discordUserId, whop_user_ids: whop, reason: "no_live_membership", mode, action: "would_kick", source: "webhook" }]);
      await line(`would kick ${label(member)} (no_live_membership) | statuses ${liveness.statuses.join(",") || "none"}`);
      return { action: "would_kick", reason: "no_live_membership", mode };
    }

    const status = await kickMember(discordUserId);
    if (status === 204) {
      await logDecisions([{ discord_user_id: discordUserId, whop_user_ids: whop, reason: "no_live_membership", mode, action: "kicked", source: "webhook" }]);
      await line(`kicked ${label(member)} (no_live_membership)`);
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

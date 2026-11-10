// Server only. One answer to "is this Whop user a member right now?", for the
// login callback (app/api/auth/whop/callback) and the dashboard layout.
//
// The read is the same shape every other membership check uses
// (app/api/whop/whop-membership.ts): SINGULAR user_id and product_id, the
// pinned API version, and an owner check on every row. The plural
// user_ids / product_ids / statuses filters are ignored by the key's API
// version: checked 2026-11-09, they returned the company's 20 newest
// memberships for any user id, so the old login gate let in anyone with a
// Whop account.
//
// The rule, in order:
//   member  the user owns a membership on the product that is active,
//           trialing, completed (one time and lifetime purchases) or past_due
//           (a failed renewal in its grace window), or one they canceled at
//           period end with paid time still left. Same rule as the Discord
//           role. The user's own row counts even if strangers' rows came back.
//   ended   the user owns memberships on the product, none of them granting
//   none    the user owns nothing on the product (often the wrong Whop account)
//   untrusted  Whop answered with strangers' rows and none of the user's
//           own live ones (the user filter ignored again): see the callers.
//   error   Whop could not answer (timeout, HTTP error, missing config).
//           The login lets the person in with a 1 hour session and logs it
//           (logLetInOnError): a Whop outage, or a broken key on our side,
//           must never lock out a paying member.

import { rowOwner, rowProduct, WHOP_API_VERSION_DATE } from "@/app/api/whop/whop-membership";
import { isAdmin } from "@/lib/admin-allowlist";
import { createAdminClient } from "@/lib/supabase/admin";

export type WhopAccess =
  | { kind: "member"; oldestCreatedAtMs: number | null }
  // newestOwnCreatedAtMs: the newest of the user's own memberships, any
  // status (a membership made in the last hour means a purchase in progress)
  | { kind: "ended"; newestOwnCreatedAtMs: number | null }
  | { kind: "none" }
  // Whop answered, but with strangers' rows and none of the caller's own live
  // ones: the user filter was ignored again (the original bug). Not an outage,
  // so not a free pass: see the callers.
  | { kind: "untrusted" }
  // config: our own setup is wrong (a missing env var, or Whop said 400, 401,
  // 403 or 404 to our key), not a Whop outage. Still lets people in (a broken
  // key must never lock out every paying member) but is logged loudly.
  // rateLimited: Whop said 429 to our key. Anyone can cause that by
  // hammering our public routes that use the same key, so the login does NOT
  // treat it as a free pass (see the callback).
  | { kind: "error"; reason: string; config?: boolean; rateLimited?: boolean };

const KNOWN_STATUSES: ReadonlySet<string> = new Set(["active", "trialing", "completed", "past_due", "canceled", "expired", "drafted"]);

export const LIVE_STATUSES: ReadonlySet<string> = new Set(["active", "trialing", "completed", "past_due"]);

const READ_TIMEOUT_MS = 8000;
// Whop answers these to a bad key, a key without the right permission, or a
// wrong company or product id: our setup, not their outage
const CONFIG_HTTP: ReadonlySet<number> = new Set([400, 401, 403, 404]);
const MAX_PAGES = 5;

// Strict created_at parse. Anything dubious returns null so onboarding routing
// defaults to onboarding (a unix-seconds value would otherwise parse as 1970).
export function parseCreatedAtMs(value: unknown): number | null {
  let ms: number | null = null;
  if (typeof value === "string") {
    const parsed = new Date(value).getTime();
    ms = Number.isNaN(parsed) ? null : parsed;
  } else if (typeof value === "number" && Number.isFinite(value)) {
    ms = value < 1e12 ? value * 1000 : value;
  }
  if (ms === null || ms < Date.UTC(2020, 0, 1)) return null;
  return ms;
}

/** A membership that grants the hub now: a live status, or a member who
    canceled at period end and still has paid time left (the same rule as the
    Discord role, classifyMembership in lib/discord-kick.ts). Whop's own
    dunning cancel leaves cancel_at_period_end false, so that one is ended. */
export function grantsAccess(m: Record<string, unknown>, now = Date.now()): boolean {
  const status = typeof m.status === "string" ? m.status : "";
  if (LIVE_STATUSES.has(status)) return true;
  if ((status === "canceled" || status === "expired") && m.cancel_at_period_end === true) {
    const ends = [parseCreatedAtMs(m.current_period_end), parseCreatedAtMs(m.renewal_period_end)].filter((t): t is number => t !== null);
    return ends.length > 0 && Math.max(...ends) > now;
  }
  return false;
}

/** One read of the user's memberships on the product (every page). Never throws. */
export async function readWhopAccess(whopUserId: string, opts: { timeoutMs?: number; now?: number; deadlineAt?: number } = {}): Promise<WhopAccess> {
  const productId = process.env.WHOP_PRODUCT_ID;
  const companyId = process.env.WHOP_COMPANY_ID;
  const apiKey = process.env.WHOP_API_KEY;
  if (!productId || !companyId || !apiKey) return { kind: "error", reason: "missing whop env var", config: true };
  if (!whopUserId) return { kind: "error", reason: "missing user id" };
  const now = opts.now ?? Date.now();
  try {
    const all: Record<string, unknown>[] = [];
    let after: string | null = null;
    for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo++) {
      // one time budget for every page of this read
      const left = opts.deadlineAt ? opts.deadlineAt - Date.now() : Infinity;
      if (left < 500) return { kind: "error", reason: "whop read ran out of time" };
      const params = new URLSearchParams({ company_id: companyId, user_id: whopUserId, product_id: productId, first: "50" });
      if (after) params.set("after", after);
      const res = await fetch(`https://api.whop.com/api/v1/memberships?${params.toString()}`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json", "Api-Version-Date": WHOP_API_VERSION_DATE },
        cache: "no-store",
        signal: AbortSignal.timeout(Math.min(opts.timeoutMs ?? READ_TIMEOUT_MS, left)),
      });
      if (!res.ok) return { kind: "error", reason: `whop http ${res.status}`, config: CONFIG_HTTP.has(res.status), rateLimited: res.status === 429 };
      const page = await res.json();
      if (!page || !Array.isArray(page.data)) return { kind: "error", reason: "whop answer had no data list" };
      all.push(...(page.data as unknown[]).filter((m): m is Record<string, unknown> => !!m && typeof m === "object"));
      const info = page.page_info as { has_next_page?: boolean; end_cursor?: string } | undefined;
      // stop as soon as a membership that grants access is found, or at the last page
      if (all.some((m) => rowOwner(m) === whopUserId && grantsAccess(m, now)) || !info?.has_next_page || !info.end_cursor) break;
      after = info.end_cursor;
    }
    const own = all.filter((m) => {
      if (rowOwner(m) !== whopUserId) return false;
      const product = rowProduct(m);
      return product === null || product === productId;
    });
    const odd = own.filter((m) => !KNOWN_STATUSES.has(String(m.status)));
    if (odd.length) console.warn("[whop-access] membership status we don't know; not counted as access", { whopUserId, statuses: odd.map((m) => m.status) });
    const granting = own.filter((m) => grantsAccess(m, now));
    if (granting.length > 0) {
      // the caller's own membership counts even if strangers' rows came back too
      let oldest: number | null = null;
      for (const m of granting) {
        const ms = parseCreatedAtMs(m.created_at);
        if (ms !== null && (oldest === null || ms < oldest)) oldest = ms;
      }
      return { kind: "member", oldestCreatedAtMs: oldest };
    }
    // A row for anyone else means the user filter was ignored again: we can't
    // tell this person's rows from strangers', so we don't decide "ended" or
    // "none" from it.
    if (all.some((m) => rowOwner(m) !== whopUserId)) {
      console.error("[whop-access] strangers' rows in a single user read (user_id filter ignored?)", { whopUserId });
      return { kind: "untrusted" };
    }
    if (own.length === 0) return { kind: "none" };
    let newest: number | null = null;
    for (const m of own) {
      const ms = parseCreatedAtMs(m.created_at);
      if (ms !== null && (newest === null || ms > newest)) newest = ms;
    }
    return { kind: "ended", newestOwnCreatedAtMs: newest };
  } catch (err) {
    const reason = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError") ? "whop timed out" : `whop read threw: ${err instanceof Error ? err.message : String(err)}`;
    return { kind: "error", reason };
  }
}

// Right after checkout Whop can take a few seconds to list a new membership.
// When the answer is "ended" or "none", ask again for up to about 20 seconds
// before believing it: a brand new buyer must never be turned away.
export const WAIT_STEPS_MS = [750, 1500, 2500, 4000, 5000, 6000];
const WAIT_DEADLINE_MS = 25_000;

/** readWhopAccess, retried while the answer is "ended" or "none". Once Whop
    has given a definite "ended" or "none", a later error can't turn it into
    "let in": the last definite answer stands. An error on the very first read
    (Whop down) is returned at once, and callers let the person in. */
export async function waitForWhopAccess(
  whopUserId: string,
  opts: {
    steps?: readonly number[];
    timeoutMs?: number;
    sleep?: (ms: number) => Promise<void>;
    deadlineMs?: number;
    // asked on the first definite "ended" or "none" and again at the end: if
    // it says this is someone who just bought, stop waiting here and answer
    // at once with recentBuyer set (the caller shows "Finishing your purchase")
    isRecentBuyer?: (access: WhopAccess) => Promise<boolean>;
  } = {},
): Promise<WhopAccess & { tries: number; recentBuyer?: boolean }> {
  const steps = opts.steps ?? WAIT_STEPS_MS;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const deadlineAt = Date.now() + (opts.deadlineMs ?? WAIT_DEADLINE_MS);
  const read = () => readWhopAccess(whopUserId, { timeoutMs: opts.timeoutMs, deadlineAt });
  let tries = 1;
  let access = await read();
  // one error alone (a rate limit, a blip) is not enough to let someone in:
  // ask once more before treating Whop as down
  if (access.kind === "error" && Date.now() + 1000 < deadlineAt) {
    const wasRateLimited = Boolean(access.rateLimited);
    await sleep(1000);
    tries++;
    access = await read();
    // a 429 then a timeout is still a rate limit (likely while being flooded)
    if (access.kind === "error" && wasRateLimited) access = { ...access, rateLimited: true };
  }
  if (access.kind === "member" || access.kind === "error" || access.kind === "untrusted") return { ...access, tries };
  let definite: WhopAccess = access;
  if (opts.isRecentBuyer && (await opts.isRecentBuyer(definite))) return { ...definite, tries, recentBuyer: true };
  for (const ms of steps) {
    if (Date.now() + ms >= deadlineAt) break;
    await sleep(ms);
    tries++;
    access = await read();
    if (access.kind === "member" || access.kind === "untrusted") return { ...access, tries };
    if (access.kind !== "error") definite = access;
  }
  if (opts.isRecentBuyer && (await opts.isRecentBuyer(definite))) return { ...definite, tries, recentBuyer: true };
  return { ...definite, tries };
}

/** True if this person has been a member before by our own records: a plan
    tier and plan id stamped from Whop's own membership rows at sign in
    (lib/whop-login.ts). Nothing a signed in person can submit writes these
    (a finished intake does NOT count: anyone with a session can save one).
    Used only when Whop's answer can't be trusted or Whop rate limits us, so a
    real member can still get in while a stranger can't. */
export async function hadMembership(whopUserId: string): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient()
      .from("member_profiles")
      .select("whop_tier, whop_plan_id")
      .eq("whop_user_id", whopUserId)
      .maybeSingle();
    if (error || !data) return false;
    return Boolean(data.whop_tier && data.whop_plan_id);
  } catch {
    return false;
  }
}

/** Admins, plus the people on the Discord "never kick" list (staff, coaches,
    guests: discord_kick_allowlist, matched through discord_connections). They
    keep the hub without a membership on the product. */
export async function hubAllowlisted(whopUserId: string): Promise<boolean> {
  if (isAdmin(whopUserId)) return true;
  try {
    const supabase = createAdminClient();
    const { data: links, error } = await supabase.from("discord_connections").select("discord_user_id").eq("whop_user_id", whopUserId);
    if (error || !links?.length) return false;
    const ids = links.map((l) => l.discord_user_id).filter((x): x is string => typeof x === "string");
    if (!ids.length) return false;
    const { data: allowed, error: e2 } = await supabase.from("discord_kick_allowlist").select("discord_user_id").in("discord_user_id", ids);
    return !e2 && (allowed?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// The dashboard's re-check: canceled members lose the hub when their plan
// ends, not only at their next login. A "member" answer is kept for 10
// minutes per server instance; "ended" and "none" are never kept, so someone
// who rejoins gets in on their very next page load. Errors let people in.
const MEMBER_TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 5000;
const memberUntil = new Map<string, number>();

/** Keep a fresh "member" answer for the dashboard (also used by the
    purchase status check, so the hub doesn't ask Whop again a second later
    and catch a slow server that hasn't listed the purchase yet). */
export function rememberMember(whopUserId: string, now = Date.now()): void {
  if (memberUntil.size >= MAX_ENTRIES) memberUntil.clear();
  memberUntil.set(whopUserId, now + MEMBER_TTL_MS);
}

// "ended_recent": ended, but one of their memberships is under an hour old
// (an upgrade or rejoin Whop hasn't switched on yet): the waiting screen,
// not the ended page.
// "wait": Whop rate limited us or answered with strangers' rows, and our own
// records don't show this person as a member: the waiting screen (which lets
// them in the moment Whop answers), not a free pass.
export async function dashboardAccess(whopUserId: string, now = Date.now()): Promise<"member" | "ended" | "ended_recent" | "none" | "error" | "wait"> {
  const until = memberUntil.get(whopUserId);
  if (until !== undefined && until > now) return "member";
  let access = await readWhopAccess(whopUserId, { timeoutMs: 5000 });
  // a brand new buyer can reach the hub a moment before every Whop server
  // lists the membership: ask once more before sending anyone out
  if (access.kind === "ended" || access.kind === "none") {
    await new Promise((r) => setTimeout(r, 1500));
    access = await readWhopAccess(whopUserId, { timeoutMs: 5000 });
  }
  if ((access.kind === "ended" || access.kind === "none") && (await hubAllowlisted(whopUserId))) return "member";
  if (access.kind === "untrusted" || (access.kind === "error" && access.rateLimited)) {
    const known = await hadMembership(whopUserId);
    const what = access.kind === "untrusted" ? "strangers' rows (user filter ignored?)" : "rate limited";
    if (!known) {
      console.error(`[WHOP_GATE_RATE_LIMITED] dashboard: ${what}, no member record: waiting screen`, { whopUserId });
      return "wait";
    }
    console.error(`[whop-access] dashboard re-check ${what}, member by our records: letting in`, { whopUserId });
    return "error";
  }
  if (access.kind === "member") {
    rememberMember(whopUserId, now);
  } else {
    memberUntil.delete(whopUserId);
  }
  if (access.kind === "error") logLetInOnError("dashboard", whopUserId, access);
  if (access.kind === "ended" && access.newestOwnCreatedAtMs !== null && now - access.newestOwnCreatedAtMs < RECENT_MS) return "ended_recent";
  return access.kind;
}

// ---------------------------------------------------------------------------
// Letting someone in because Whop could not answer. One log line per event.
// Our own config errors get a fixed tag, WHOP_GATE_CONFIG_ERROR: the number
// of log lines with that tag (Vercel logs, search the tag) is the count of
// people let in because our Whop setup was broken. The count printed in the
// line is per server instance only.
let configErrorCount = 0;
let outageCount = 0;
export function logLetInOnError(where: string, whopUserId: string, access: { reason: string; config?: boolean }): void {
  if (access.config) {
    configErrorCount++;
    console.error(
      `[WHOP_GATE_CONFIG_ERROR] ${where}: our Whop setup is broken (${access.reason}). Letting this person in for 1 hour without a membership check. Check WHOP_API_KEY, WHOP_COMPANY_ID and WHOP_PRODUCT_ID. Count on this server: ${configErrorCount}`,
      { whopUserId },
    );
  } else {
    outageCount++;
    console.error(`[WHOP_GATE_OUTAGE] ${where}: Whop could not answer (${access.reason}). Letting this person in for 1 hour. Count on this server: ${outageCount}`, { whopUserId });
  }
}

// ---------------------------------------------------------------------------
// "Did this person just buy?" Used only to choose between the "Finishing your
// purchase" screen and a turn away; it never lets anyone into the hub.
export const RECENT_MS = 60 * 60 * 1000;
export const RECENT_PURCHASE_COOKIE = "rv_recent_purchase";

/** When the Whop account was made, or null if Whop can't say. Read only. */
export async function whopAccountCreatedAtMs(whopUserId: string, timeoutMs = 4000): Promise<number | null> {
  const apiKey = process.env.WHOP_API_KEY;
  if (!apiKey || !whopUserId) return null;
  try {
    const res = await fetch(`https://api.whop.com/api/v1/users/${encodeURIComponent(whopUserId)}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json", "Api-Version-Date": WHOP_API_VERSION_DATE },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const user = (await res.json()) as Record<string, unknown> | null;
    if (!user || user.id !== whopUserId) return null;
    return parseCreatedAtMs(user.created_at);
  } catch {
    return null;
  }
}

const PAID_STATUSES: ReadonlySet<string> = new Set(["paid", "succeeded"]);

/** True if Whop shows a paid payment by this user for the product in the
    last hour. Read only; the user filter is checked on every row. */
function idOf(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string") return (value as { id: string }).id;
  return null;
}

/** null means Whop couldn't be asked (the caller treats that as "maybe just
    bought": a waiting screen is safer than "Wrong email"). */
export async function paidInLastHour(whopUserId: string, now = Date.now(), timeoutMs = 4000): Promise<boolean | null> {
  const apiKey = process.env.WHOP_API_KEY;
  const companyId = process.env.WHOP_COMPANY_ID;
  const productId = process.env.WHOP_PRODUCT_ID;
  if (!apiKey || !companyId || !productId || !whopUserId) return null;
  try {
    const params = new URLSearchParams({ account_id: companyId, user_id: whopUserId, first: "10" });
    const res = await fetch(`https://api.whop.com/api/v1/payments?${params.toString()}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json", "Api-Version-Date": WHOP_API_VERSION_DATE },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const page = (await res.json()) as { data?: unknown } | null;
    const rows = Array.isArray(page?.data) ? (page.data as Record<string, unknown>[]) : [];
    return rows.some((p) => {
      if (!p || typeof p !== "object") return false;
      if ((idOf(p.user) ?? idOf(p.user_id)) !== whopUserId) return false;
      if ((idOf(p.product_id) ?? idOf(p.product)) !== productId) return false;
      if (!PAID_STATUSES.has(String(p.status))) return false;
      const at = parseCreatedAtMs(p.paid_at) ?? parseCreatedAtMs(p.created_at);
      return at !== null && now - at < RECENT_MS && at <= now + 60_000;
    });
  } catch {
    return null;
  }
}

/** True if the person most likely bought in the last hour: they came to sign
    in from the page checkout sends buyers to (the cookie), one of their own
    memberships was made in the last hour, their Whop account was, or Whop
    shows a paid payment from them in the last hour. */
export async function looksLikeRecentBuyer(
  whopUserId: string,
  access: WhopAccess,
  opts: { cameFromCheckout: boolean; now?: number },
): Promise<boolean> {
  const now = opts.now ?? Date.now();
  if (opts.cameFromCheckout) return true;
  if (access.kind === "ended" && access.newestOwnCreatedAtMs !== null && now - access.newestOwnCreatedAtMs < RECENT_MS) return true;
  // both asked at once (4 s each at most) to stay inside the login's time
  const [created, paid] = await Promise.all([whopAccountCreatedAtMs(whopUserId), paidInLastHour(whopUserId, now)]);
  if (created !== null && now - created < RECENT_MS && created <= now + 60_000) return true;
  return paid !== false;
}

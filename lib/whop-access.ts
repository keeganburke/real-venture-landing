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
//   error   Whop could not answer (timeout, HTTP error, missing config) or
//           answered with strangers' rows and none of the user's own live
//           ones. The login lets the person in with a 1 hour session and logs
//           it: a Whop outage must never lock out a paying member.

import { rowOwner, rowProduct, WHOP_API_VERSION_DATE } from "@/app/api/whop/whop-membership";
import { isAdmin } from "@/lib/admin-allowlist";
import { createAdminClient } from "@/lib/supabase/admin";

export type WhopAccess =
  | { kind: "member"; oldestCreatedAtMs: number | null }
  | { kind: "ended" }
  | { kind: "none" }
  // Whop answered, but with strangers' rows and none of the caller's own live
  // ones: the user filter was ignored again (the original bug). Not an outage,
  // so not a free pass: see the callers.
  | { kind: "untrusted" }
  | { kind: "error"; reason: string };

const KNOWN_STATUSES: ReadonlySet<string> = new Set(["active", "trialing", "completed", "past_due", "canceled", "expired", "drafted"]);

export const LIVE_STATUSES: ReadonlySet<string> = new Set(["active", "trialing", "completed", "past_due"]);

const READ_TIMEOUT_MS = 8000;
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
  if (!productId || !companyId || !apiKey) return { kind: "error", reason: "missing whop config" };
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
      if (!res.ok) return { kind: "error", reason: `whop http ${res.status}` };
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
    return own.length > 0 ? { kind: "ended" } : { kind: "none" };
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
  opts: { steps?: readonly number[]; timeoutMs?: number; sleep?: (ms: number) => Promise<void>; deadlineMs?: number } = {},
): Promise<WhopAccess & { tries: number }> {
  const steps = opts.steps ?? WAIT_STEPS_MS;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const deadlineAt = Date.now() + (opts.deadlineMs ?? WAIT_DEADLINE_MS);
  const read = () => readWhopAccess(whopUserId, { timeoutMs: opts.timeoutMs, deadlineAt });
  let tries = 1;
  let access = await read();
  // one error alone (a rate limit, a blip) is not enough to let someone in:
  // ask once more before treating Whop as down
  if (access.kind === "error" && Date.now() + 1000 < deadlineAt) {
    await sleep(1000);
    tries++;
    access = await read();
  }
  if (access.kind === "member" || access.kind === "error" || access.kind === "untrusted") return { ...access, tries };
  let definite: WhopAccess = access;
  for (const ms of steps) {
    if (Date.now() + ms >= deadlineAt) break;
    await sleep(ms);
    tries++;
    access = await read();
    if (access.kind === "member" || access.kind === "untrusted") return { ...access, tries };
    if (access.kind !== "error") definite = access;
  }
  return { ...definite, tries };
}

/** True if this person has been a member before by our own records: a saved
    plan tier or a finished intake. Used only when Whop's answer can't be
    trusted, so a real member can still sign in while a stranger can't. */
export async function hadMembership(whopUserId: string): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient()
      .from("member_profiles")
      .select("whop_tier, intake_completed_at")
      .eq("whop_user_id", whopUserId)
      .maybeSingle();
    if (error || !data) return false;
    return Boolean(data.whop_tier || data.intake_completed_at);
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

export async function dashboardAccess(whopUserId: string, now = Date.now()): Promise<"member" | "ended" | "none" | "error"> {
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
  if (access.kind === "untrusted") {
    console.error("[whop-access] dashboard re-check untrusted, letting in (the session came from a passed login)", { whopUserId });
    return "error";
  }
  if (access.kind === "member") {
    if (memberUntil.size >= MAX_ENTRIES) memberUntil.clear();
    memberUntil.set(whopUserId, now + MEMBER_TTL_MS);
  } else {
    memberUntil.delete(whopUserId);
  }
  if (access.kind === "error") console.error("[whop-access] dashboard re-check unavailable, letting in", { whopUserId, reason: access.reason });
  return access.kind;
}

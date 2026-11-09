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
//           (a failed renewal in its grace window, same as the Discord role)
//   ended   the user owns memberships on the product, none of them live
//   none    the user owns nothing on the product (often the wrong Whop account)
//   error   Whop could not answer or answered something we can't trust.
//           Callers LET THE PERSON IN and log it: a Whop outage must never
//           lock out a paying member.

import { rowOwner, rowProduct, WHOP_API_VERSION_DATE } from "@/app/api/whop/whop-membership";

export type WhopAccess =
  | { kind: "member"; oldestCreatedAtMs: number | null }
  | { kind: "ended" }
  | { kind: "none" }
  | { kind: "error"; reason: string };

export const LIVE_STATUSES: ReadonlySet<string> = new Set(["active", "trialing", "completed", "past_due"]);

const READ_TIMEOUT_MS = 8000;

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

/** One read of the user's memberships on the product. Never throws. */
export async function readWhopAccess(whopUserId: string, opts: { timeoutMs?: number } = {}): Promise<WhopAccess> {
  const productId = process.env.WHOP_PRODUCT_ID;
  const companyId = process.env.WHOP_COMPANY_ID;
  const apiKey = process.env.WHOP_API_KEY;
  if (!productId || !companyId || !apiKey) return { kind: "error", reason: "missing whop config" };
  if (!whopUserId) return { kind: "error", reason: "missing user id" };
  try {
    const params = new URLSearchParams({ company_id: companyId, user_id: whopUserId, product_id: productId, first: "50" });
    const res = await fetch(`https://api.whop.com/api/v1/memberships?${params.toString()}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json", "Api-Version-Date": WHOP_API_VERSION_DATE },
      cache: "no-store",
      signal: AbortSignal.timeout(opts.timeoutMs ?? READ_TIMEOUT_MS),
    });
    if (!res.ok) return { kind: "error", reason: `whop http ${res.status}` };
    const page = await res.json();
    if (!page || !Array.isArray(page.data)) return { kind: "error", reason: "whop answer had no data list" };
    const all = (page.data as unknown[]).filter((m): m is Record<string, unknown> => !!m && typeof m === "object");
    // A row for anyone else means the user filter was ignored again: we can't
    // tell this person's rows from strangers', so we don't decide here.
    if (all.some((m) => rowOwner(m) !== whopUserId)) return { kind: "error", reason: "foreign or ownerless row (user_id filter ignored?)" };
    const own = all.filter((m) => {
      const product = rowProduct(m);
      return product === null || product === productId;
    });
    const live = own.filter((m) => typeof m.status === "string" && LIVE_STATUSES.has(m.status));
    if (live.length > 0) {
      let oldest: number | null = null;
      for (const m of live) {
        const ms = parseCreatedAtMs(m.created_at);
        if (ms !== null && (oldest === null || ms < oldest)) oldest = ms;
      }
      return { kind: "member", oldestCreatedAtMs: oldest };
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

/** readWhopAccess, retried while the answer is "ended" or "none". */
export async function waitForWhopAccess(
  whopUserId: string,
  opts: { steps?: readonly number[]; timeoutMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<WhopAccess & { tries: number }> {
  const steps = opts.steps ?? WAIT_STEPS_MS;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let tries = 1;
  let access = await readWhopAccess(whopUserId, { timeoutMs: opts.timeoutMs });
  for (const ms of steps) {
    if (access.kind === "member" || access.kind === "error") break;
    await sleep(ms);
    tries++;
    access = await readWhopAccess(whopUserId, { timeoutMs: opts.timeoutMs });
  }
  return { ...access, tries };
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
  const access = await readWhopAccess(whopUserId, { timeoutMs: 5000 });
  if (access.kind === "member") {
    if (memberUntil.size >= MAX_ENTRIES) memberUntil.clear();
    memberUntil.set(whopUserId, now + MEMBER_TTL_MS);
  } else {
    memberUntil.delete(whopUserId);
  }
  if (access.kind === "error") console.error("[whop-access] dashboard re-check unavailable, letting in", { whopUserId, reason: access.reason });
  return access.kind;
}

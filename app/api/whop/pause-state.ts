import { createAdminClient } from "../../../lib/supabase/server";
import { WHOP_API_VERSION_DATE, whopAuthHeaders, type WhopMembershipRow } from "./whop-membership";

// Server-only. Everything the pause flow needs to know about a membership
// BEFORE it writes anything to Whop. Shared by /api/whop/pause (the refusal
// checks) and /manage-membership/page.tsx (status line + whether to offer
// Gate 2 at all).
//
// Field facts, verified 2026-10-22 on membership mem_LFgWJxU3PVzCrq right
// after a successful pause through the live route:
//   - GET /memberships/{id} keeps status "trialing" (an active one keeps
//     "active"); the pause shows ONLY as most_recent_action === "paused_at"
//     with most_recent_action_at = the pause time. There is no
//     payment_collection_paused, resumes_at or pauses_until field in the
//     response, whatever Api-Version-Date is sent (2026-10-15, 2026-10-15-1,
//     2026-08-21-1, none).
//   - GET /memberships?...&status=paused DOES filter: 15 of 1286 rows, every
//     one of them paused (12 with most_recent_action paused_at, 3 paused then
//     canceled). Combined with user_id it returns exactly that user's paused
//     memberships. This is the flag Whop's dashboard calls "Paused".
//   - current_period_end does NOT move when a membership is paused
//     (2026-11-21 before and after). It is the next date Whop will try to
//     charge once collection is running again, so it is the only real
//     "next payment" date the API exposes.
//   - A membership with no subscription behind it (100 % promo, comped) has
//     collection_method null and current_period_start/end null; Whop answers
//     the pause with 400 "There is no subscription for this membership".
//     renewal_price alone is NOT the test: the trial membership above has
//     renewal_price 0.00 with collection_method charge_automatically and a
//     period, and it paused fine.

export const PAUSE_REUSE_DAYS = 180;
export const PAUSE_SUCCEEDED_EVENT = "pause_succeeded";

export type PauseBlock = "no_subscription" | "already_paused" | "already_used";

export type PauseState = {
  // true when Whop lists this membership under status=paused, or the row's
  // most_recent_action is paused_at (fallback when the list read fails).
  paused: boolean;
  // collection_method charge_automatically AND a current_period_end.
  hasSubscription: boolean;
  // ISO date of the next charge attempt (current_period_end), or null.
  nextPaymentAt: string | null;
  // A pause_succeeded row for this Whop user in the last PAUSE_REUSE_DAYS.
  usedRecently: boolean;
  usedAt: string | null;
  // resumes_at from that row: the date we told Whop to resume collection.
  // Whop never returns it, so this row is the only record. Null for a
  // membership paused by hand in the Whop dashboard.
  resumesAt: string | null;
  // First reason the pause must be refused, or null when it can be offered.
  block: PauseBlock | null;
  // Reads that failed are surfaced, never silently treated as "fine".
  warnings: string[];
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function isoOrNull(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  return Number.isNaN(Date.parse(s)) ? null : s;
}

export function membershipNextPaymentAt(m: WhopMembershipRow): string | null {
  return isoOrNull(m.current_period_end) ?? isoOrNull(m.renewal_period_end);
}

export function membershipHasSubscription(m: WhopMembershipRow): boolean {
  return m.collection_method === "charge_automatically" && membershipNextPaymentAt(m) !== null;
}

export function membershipLooksPaused(m: WhopMembershipRow): boolean {
  return m.most_recent_action === "paused_at";
}

// GET /memberships?company_id&product_id&user_id&status=paused, with the same
// owner check the Discord sweep uses: a foreign user id in the result means
// the filter was ignored and the answer cannot be trusted.
export async function isMembershipPausedOnWhop(
  whopUserId: string,
  membershipId: string
): Promise<{ ok: true; paused: boolean } | { ok: false; error: string }> {
  const companyId = process.env.WHOP_COMPANY_ID;
  const productId = process.env.WHOP_PRODUCT_ID;
  if (!companyId || !productId) return { ok: false, error: "missing whop config" };
  const params = new URLSearchParams({
    company_id: companyId,
    product_id: productId,
    user_id: whopUserId,
    status: "paused",
    first: "50",
  });
  try {
    const res = await fetch(`https://api.whop.com/api/v1/memberships?${params.toString()}`, {
      headers: whopAuthHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: `paused list HTTP ${res.status}` };
    const page = (await res.json().catch(() => null)) as { data?: unknown[] } | null;
    const rows = (Array.isArray(page?.data) ? page!.data : []).filter(
      (m): m is WhopMembershipRow => !!m && typeof m === "object"
    );
    for (const m of rows) {
      const owner = str(m.user_id) ?? str((m.user as { id?: unknown } | undefined)?.id);
      if (owner !== null && owner !== whopUserId) {
        return { ok: false, error: "foreign user in paused list (user_id filter ignored)" };
      }
    }
    return { ok: true, paused: rows.some((m) => m.id === membershipId) };
  } catch (err) {
    return { ok: false, error: `paused list threw: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

export async function fetchMembershipRow(
  membershipId: string
): Promise<{ ok: true; membership: WhopMembershipRow } | { ok: false; error: string }> {
  try {
    const res = await fetch(`https://api.whop.com/api/v1/memberships/${membershipId}`, {
      headers: { ...whopAuthHeaders(), "Api-Version-Date": WHOP_API_VERSION_DATE },
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: `membership GET HTTP ${res.status}` };
    const m = (await res.json().catch(() => null)) as WhopMembershipRow | null;
    if (!m || typeof m !== "object") return { ok: false, error: "membership GET returned no object" };
    return { ok: true, membership: m };
  } catch (err) {
    return { ok: false, error: `membership GET threw: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

// Most recent pause_succeeded for this Whop user inside the reuse window.
// Only the server writes pause_succeeded (it is NOT in the cancel-events/log
// whitelist), so a client cannot forge or clear this.
export async function lastPauseSucceeded(
  whopUserId: string,
  now: number = Date.now()
): Promise<{ ok: true; usedAt: string | null; resumesAt: string | null } | { ok: false; error: string }> {
  try {
    const since = new Date(now - PAUSE_REUSE_DAYS * 86_400_000).toISOString();
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("cancel_flow_events")
      .select("created_at, event_data")
      .eq("user_id", whopUserId)
      .eq("event_type", PAUSE_SUCCEEDED_EVENT)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) return { ok: false, error: `pause_succeeded read failed: ${error.message}` };
    const row = data && data.length > 0 ? data[0] : null;
    const usedAt = row ? str(row.created_at) : null;
    const eventData = row && row.event_data && typeof row.event_data === "object" ? (row.event_data as Record<string, unknown>) : null;
    const resumesAt = eventData ? isoOrNull(eventData.resumes_at) : null;
    return { ok: true, usedAt, resumesAt };
  } catch (err) {
    return { ok: false, error: `pause_succeeded read threw: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

// The full picture for one membership row. A failed paused-list read falls
// back to the row's most_recent_action; a failed Supabase read counts as
// "not used" but is reported in warnings so the route can log it.
export async function readPauseState(
  whopUserId: string,
  membership: WhopMembershipRow,
  now: number = Date.now()
): Promise<PauseState> {
  const warnings: string[] = [];
  const membershipId = str(membership.id) ?? "";

  const hasSubscription = membershipHasSubscription(membership);
  const nextPaymentAt = membershipNextPaymentAt(membership);

  let paused = membershipLooksPaused(membership);
  if (membershipId) {
    const listed = await isMembershipPausedOnWhop(whopUserId, membershipId);
    if (listed.ok) paused = listed.paused || paused;
    else warnings.push(listed.error);
  }

  const used = await lastPauseSucceeded(whopUserId, now);
  const usedAt = used.ok ? used.usedAt : null;
  const resumesAt = used.ok ? used.resumesAt : null;
  if (!used.ok) warnings.push(used.error);

  const block: PauseBlock | null = !hasSubscription
    ? "no_subscription"
    : paused
      ? "already_paused"
      : usedAt
        ? "already_used"
        : null;

  return { paused, hasSubscription, nextPaymentAt, usedRecently: usedAt !== null, usedAt, resumesAt, block, warnings };
}

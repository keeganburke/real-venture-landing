import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../lib/session";

// Resolves the caller's active membership id from their rv_session cookie,
// using the same v1 memberships lookup as /manage-membership/page.tsx.
export type WhopMembershipRow = Record<string, unknown>;

export async function getActiveMembershipId(request: NextRequest): Promise<
  | { ok: true; membershipId: string; whopUserId: string; membership: WhopMembershipRow }
  | { ok: false; error: string; status: number }
> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return { ok: false, error: "unauthorized", status: 401 };

  const productId = process.env.WHOP_PRODUCT_ID;
  const companyId = process.env.WHOP_COMPANY_ID;
  if (!productId || !companyId) return { ok: false, error: "missing whop config", status: 200 };

  // SINGULAR filters, pinned version, owner-checked. The plural form
  // (user_ids / product_ids / statuses) is silently IGNORED by the key's
  // current API version (checked 2026-10-22: 20 rows, 20 different owners,
  // newest first, on api-version-date 2026-09-22 and 2026-10-15-1 alike), so
  // the old query returned the newest membership in the whole company and
  // this helper would have handed the pause/cancel routes someone else's
  // membership. user_id + product_id return exactly the caller's rows on both
  // versions. Status is filtered locally; the owner check below is the
  // backstop if a filter is ever ignored again.
  const params = new URLSearchParams({
    company_id: companyId,
    user_id: session.whopUserId,
    product_id: productId,
    first: "50",
  });

  const res = await fetch(`https://api.whop.com/api/v1/memberships?${params.toString()}`, {
    headers: {
      // Same requireWhopApiKey as whopAuthHeaders, deliberately. This lookup
      // runs BEFORE every cancel/pause call, so leaving a `?? ""` here would
      // make the throw above unreachable: a missing key would 401 this fetch,
      // return "membership lookup failed", and the loud failure would never
      // happen.
      Authorization: `Bearer ${requireWhopApiKey()}`,
      Accept: "application/json",
      "Api-Version-Date": WHOP_API_VERSION_DATE,
    },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, error: "membership lookup failed", status: 200 };

  const page = await res.json();
  const all: Record<string, unknown>[] = (Array.isArray(page?.data) ? page.data : []).filter(
    (m: unknown): m is Record<string, unknown> => !!m && typeof m === "object"
  );
  // A row for another user means the filter was ignored: refuse rather than
  // act on a stranger's membership.
  if (all.some((m) => rowOwner(m) !== null && rowOwner(m) !== session.whopUserId)) {
    console.error("whop-membership: foreign user in memberships read (user_id filter ignored)");
    return { ok: false, error: "membership lookup failed", status: 200 };
  }
  // Same priority as the manage page: paying memberships (active or
  // trialing) before completed one-time purchases, newest first per tier.
  const rows = all.filter((m) => {
    const product = rowProduct(m);
    if (product !== null && product !== productId) return false;
    return m.status === "active" || m.status === "trialing" || m.status === "completed";
  });
  const tier = (m: Record<string, unknown>) =>
    m.status === "active" || m.status === "trialing" ? 0 : 1;
  const createdAtMs = (v: unknown) => {
    if (typeof v !== "string" && typeof v !== "number") return 0;
    const ms = new Date(v).getTime();
    return Number.isNaN(ms) ? 0 : ms;
  };
  rows.sort((a, b) => tier(a) - tier(b) || createdAtMs(b.created_at) - createdAtMs(a.created_at));
  const membershipId = rows[0]?.id;
  if (typeof membershipId !== "string" || membershipId.length === 0) {
    return { ok: false, error: "no membership", status: 200 };
  }
  // The row and the session's Whop user id ride along so callers that need
  // more than the id (the pause route's refusal checks) do not re-fetch.
  return { ok: true, membershipId, whopUserId: session.whopUserId, membership: rows[0] };
}

function idOf(v: unknown): string | null {
  if (typeof v === "string" && v.length > 0) return v;
  if (v && typeof v === "object") {
    const id = (v as { id?: unknown }).id;
    if (typeof id === "string" && id.length > 0) return id;
  }
  return null;
}
export function rowOwner(m: WhopMembershipRow): string | null {
  return idOf(m.user_id) ?? idOf(m.user) ?? null;
}
export function rowProduct(m: WhopMembershipRow): string | null {
  return idOf(m.product_id) ?? idOf(m.product) ?? null;
}

// Pinned Whop API version. Whop renamed the pause body field between
// versions; pinning makes the request shape deterministic instead of riding
// on whatever default the account is on.
//
// "2026-10-15-1" is the value the published specs carry (pause-membership
// and cancel-membership both say x-api-version-date: 2026-10-15-1). Checked
// 2026-10-22: GET /memberships (list, with status=paused) and
// GET /memberships/{id} both answer 200 with this header and return the same
// fields as the bare "2026-10-15".
export const WHOP_API_VERSION_DATE = "2026-10-15-1";

/**
 * The API key, or a thrown error.
 *
 * Replaces a `?? ""` fallback that sent `Bearer ` with an empty token when the
 * variable was missing. Whop answered that with a 401, which is
 * indistinguishable from a key that exists but lacks a scope — so a config
 * mistake looked like a permissions problem. Missing config now fails loudly
 * at the call site, where the route's catch logs it.
 */
function requireWhopApiKey(): string {
  const key = process.env.WHOP_API_KEY;
  if (!key || key.trim() === "") {
    throw new Error("WHOP_API_KEY is unset or empty");
  }
  return key;
}

export function whopAuthHeaders() {
  return {
    Authorization: `Bearer ${requireWhopApiKey()}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "Api-Version-Date": WHOP_API_VERSION_DATE,
  };
}

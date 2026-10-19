import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../lib/session";

// Resolves the caller's active membership id from their rv_session cookie,
// using the same v1 memberships lookup as /manage-membership/page.tsx.
export async function getActiveMembershipId(request: NextRequest): Promise<
  { ok: true; membershipId: string } | { ok: false; error: string; status: number }
> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return { ok: false, error: "unauthorized", status: 401 };

  const productId = process.env.WHOP_PRODUCT_ID;
  const companyId = process.env.WHOP_COMPANY_ID;
  if (!productId || !companyId) return { ok: false, error: "missing whop config", status: 200 };

  const params = new URLSearchParams({ company_id: companyId });
  params.append("user_ids", session.whopUserId);
  params.append("product_ids", productId);
  params.append("statuses", "active");
  params.append("statuses", "trialing");
  params.append("statuses", "completed");

  const res = await fetch(`https://api.whop.com/api/v1/memberships?${params.toString()}`, {
    headers: {
      // Same requireWhopApiKey as whopAuthHeaders, deliberately. This lookup
      // runs BEFORE every cancel/pause call, so leaving a `?? ""` here would
      // make the throw above unreachable: a missing key would 401 this fetch,
      // return "membership lookup failed", and the loud failure would never
      // happen.
      Authorization: `Bearer ${requireWhopApiKey()}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, error: "membership lookup failed", status: 200 };

  const page = await res.json();
  // Same priority as the manage page: paying memberships (active or
  // trialing) before completed one-time purchases, newest first per tier.
  const rows: Record<string, unknown>[] = (Array.isArray(page?.data) ? page.data : []).filter(
    (m: unknown): m is Record<string, unknown> => !!m && typeof m === "object"
  );
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
  return { ok: true, membershipId };
}

// Pinned Whop API version. Whop renamed the pause body field between
// versions; pinning makes the request shape deterministic instead of riding
// on whatever default the account is on.
export const WHOP_API_VERSION_DATE = "2026-10-15";

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

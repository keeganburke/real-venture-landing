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
      Authorization: `Bearer ${process.env.WHOP_API_KEY ?? ""}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, error: "membership lookup failed", status: 200 };

  const page = await res.json();
  const membershipId = Array.isArray(page?.data) ? page.data[0]?.id : null;
  if (typeof membershipId !== "string" || membershipId.length === 0) {
    return { ok: false, error: "no membership", status: 200 };
  }
  return { ok: true, membershipId };
}

export function whopAuthHeaders() {
  return {
    Authorization: `Bearer ${process.env.WHOP_API_KEY ?? ""}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

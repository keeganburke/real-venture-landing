import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../lib/session";
import ManageMembershipClient, { type MembershipSummary } from "./ManageMembershipClient";

function formatRenewal(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Mockup placeholder values, shown when the live fetch cannot resolve a
// field. TODO: confirm real field names against a production response.
const FALLBACK: MembershipSummary = {
  membershipId: null,
  planName: "Pro",
  price: "$49.99 / month",
  status: "Active",
  renewalDate: null,
};

async function fetchMembership(whopUserId: string): Promise<MembershipSummary> {
  const productId = process.env.WHOP_PRODUCT_ID;
  const companyId = process.env.WHOP_COMPANY_ID;
  if (!productId || !companyId) return FALLBACK;

  try {
    const params = new URLSearchParams({ company_id: companyId });
    params.append("user_ids", whopUserId);
    params.append("product_ids", productId);
    const res = await fetch(`https://api.whop.com/api/v1/memberships?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${process.env.WHOP_API_KEY ?? ""}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return FALLBACK;
    const page = await res.json();
    const m = Array.isArray(page?.data) ? page.data[0] : null;
    if (!m) return FALLBACK;

    const status =
      typeof m.status === "string" && m.status.length > 0
        ? m.status.charAt(0).toUpperCase() + m.status.slice(1)
        : FALLBACK.status;

    return {
      membershipId: typeof m.id === "string" ? m.id : null,
      planName:
        (typeof m.plan === "object" && m.plan && typeof m.plan.title === "string" && m.plan.title) ||
        (typeof m.plan_id === "string" && m.plan_id) ||
        FALLBACK.planName,
      price: FALLBACK.price, // TODO: derive from plan pricing once real response shape is confirmed
      status,
      renewalDate: formatRenewal(m.renewal_period_end) ?? formatRenewal(m.expires_at),
    };
  } catch {
    return FALLBACK;
  }
}

export default async function ManageMembershipPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const membership = session ? await fetchMembership(session.whopUserId) : FALLBACK;

  return <ManageMembershipClient membership={membership} />;
}

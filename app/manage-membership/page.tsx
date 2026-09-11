import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../lib/session";
import ManageMembershipClient, { type MembershipSummary } from "./ManageMembershipClient";

function formatRenewal(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Reads the plan id from a Whop membership response. The memberships list
// endpoint puts the id at m.plan.id; older callers assumed m.plan_id at
// the top level. Fall back to m.plan_id for defensive compatibility.
function readPlanId(m: Record<string, unknown>): string | null {
  const plan = m.plan as Record<string, unknown> | undefined;
  if (plan && typeof plan.id === "string" && plan.id.length > 0) return plan.id;
  if (typeof m.plan_id === "string" && m.plan_id.length > 0) return m.plan_id;
  return null;
}

// Canonical plan names. Whop's plan object does NOT return a title on the
// memberships endpoint, so we resolve it locally. Unknown plan ids fall
// through to the raw plan id (better than FALLBACK "Pro" for debugging).
const PLAN_NAMES: Record<string, string> = {
  plan_2NqC2WJzV87QY: "Base",
  plan_J8vFpCWME75W3: "Pro",
  plan_9nyRNbuhQF0pk: "Pro (3 months)",
  plan_SIYHeHyFp1dbR: "Pro (legacy)",
  plan_SGscR3JhdTtKh: "Base (legacy)",
  plan_mjpuBNS3KJqmw: "Ultra",
};

// Mockup placeholder values, shown when the live fetch cannot resolve a
// field. TODO: confirm real field names against a production response.
const FALLBACK: MembershipSummary = {
  membershipId: null,
  planId: null,
  planName: "Pro",
  price: "$49.99 / month",
  status: "Active",
  renewalDate: null,
};

function createdAtMs(value: unknown): number {
  if (typeof value !== "string" && typeof value !== "number") return 0;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

// Users can hold several memberships on the product (rejoins, one-time
// purchases, canceled runs). Pick the most relevant one: paying first
// (active or trialing), then completed one-time purchases, newest first
// within each tier. A user with only canceled or expired memberships gets
// null, never a dead membership with misleading dates.
function pickMembership(data: unknown[]): Record<string, unknown> | null {
  const rows = data.filter(
    (m): m is Record<string, unknown> => !!m && typeof m === "object"
  );
  const newestFirst = (a: Record<string, unknown>, b: Record<string, unknown>) =>
    createdAtMs(b.created_at) - createdAtMs(a.created_at);

  const paying = rows
    .filter((m) => m.status === "active" || m.status === "trialing")
    .sort(newestFirst);
  if (paying.length > 0) return paying[0];

  const completed = rows.filter((m) => m.status === "completed").sort(newestFirst);
  if (completed.length > 0) return completed[0];

  return null;
}

// Returns null when the user has no active, trialing, or completed
// membership; FALLBACK only on fetch or config errors, as before.
async function fetchMembership(whopUserId: string): Promise<MembershipSummary | null> {
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
    const m = pickMembership(Array.isArray(page?.data) ? page.data : []);
    if (!m) return null;

    const status =
      typeof m.status === "string" && m.status.length > 0
        ? m.status.charAt(0).toUpperCase() + m.status.slice(1)
        : FALLBACK.status;

    const planId = readPlanId(m);
    const rawPrice =
      typeof m.formatted_renewal_price === "string" && m.formatted_renewal_price.length > 0
        ? m.formatted_renewal_price
        : null;
    return {
      membershipId: typeof m.id === "string" ? m.id : null,
      planId,
      planName: (planId && PLAN_NAMES[planId]) || planId || FALLBACK.planName,
      price: rawPrice ?? FALLBACK.price,
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

  if (membership === null) {
    const checkoutUrl = process.env.NEXT_PUBLIC_WHOP_CHECKOUT_URL;
    return (
      <main className="manage-mem-page">
        <div className="mm-shell">
          <div className="settings">
            <div className="settings-h">
              <div className="settings-title">Manage Membership</div>
              <div className="settings-sub">View your plan or manage billing.</div>
            </div>
            <div className="plan-card">
              <div className="plan-top">
                <div>
                  <div className="plan-tier">Current Plan</div>
                  <div className="plan-name">No active membership</div>
                </div>
              </div>
              {checkoutUrl && (
                <div className="plan-meta">
                  <a
                    href={checkoutUrl}
                    style={{ color: "var(--gold)", fontWeight: 700, textDecoration: "none" }}
                  >
                    Rejoin {"→"}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    );
  }

  return <ManageMembershipClient membership={membership} />;
}

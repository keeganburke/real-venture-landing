// Server-only: one Whop memberships lookup that yields everything the
// dashboard needs about the caller: tier, plan, and the embedded Whop user
// profile (name, username, email, photo). Never import in client components.

export type WhopMemberSummary = {
  tier: "Base" | "Pro" | null;
  planId: string | null;
  name: string | null;
  username: string | null;
  email: string | null;
  photoUrl: string | null;
};

// Plan tiers verified against live plan pricing (Aug 2026):
//   plan_2NqC2WJzV87QY  hosted Base, $19.99/mo
//   plan_J8vFpCWME75W3  hosted Pro, $49.99/mo
//   plan_SIYHeHyFp1dbR  legacy membership (WHOP_PLAN_ID), $75.24 renewal -> Pro
//   plan_SGscR3JhdTtKh  $1 one-time entry plan -> Base
const PLAN_TIERS: Record<string, "Base" | "Pro"> = {
  plan_2NqC2WJzV87QY: "Base",
  plan_J8vFpCWME75W3: "Pro",
  plan_SIYHeHyFp1dbR: "Pro",
  plan_SGscR3JhdTtKh: "Base",
};

const EMPTY: WhopMemberSummary = {
  tier: null,
  planId: null,
  name: null,
  username: null,
  email: null,
  photoUrl: null,
};

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function getWhopMemberSummary(whopUserId: string): Promise<WhopMemberSummary> {
  const productId = process.env.WHOP_PRODUCT_ID;
  const companyId = process.env.WHOP_COMPANY_ID;
  if (!productId || !companyId || !whopUserId) return EMPTY;

  try {
    const params = new URLSearchParams({ company_id: companyId });
    params.append("user_ids", whopUserId);
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
    if (!res.ok) return EMPTY;

    const page = await res.json();
    const rows: Record<string, unknown>[] = (Array.isArray(page?.data) ? page.data : []).filter(
      (m: unknown): m is Record<string, unknown> => !!m && typeof m === "object"
    );

    const summary: WhopMemberSummary = { ...EMPTY };
    for (const row of rows) {
      const plan = row.plan as Record<string, unknown> | undefined;
      const planId = typeof row.plan_id === "string" ? row.plan_id : str(plan?.id);
      const rowTier = planId ? PLAN_TIERS[planId] : undefined;
      // Pro wins when a user holds multiple memberships.
      if (rowTier === "Pro" || (rowTier === "Base" && summary.tier !== "Pro")) {
        summary.tier = rowTier;
        summary.planId = planId;
      }

      const user = row.user as Record<string, unknown> | undefined;
      if (user) {
        summary.name = summary.name ?? str(user.name);
        summary.username = summary.username ?? str(user.username);
        summary.email = summary.email ?? str(user.email);
        summary.photoUrl = summary.photoUrl ?? str(user.profile_pic);
      }
    }
    return summary;
  } catch {
    return EMPTY;
  }
}

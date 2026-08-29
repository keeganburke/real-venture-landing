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
//   plan_9nyRNbuhQF0pk  hosted Pro 3-month, $130
const PLAN_TIERS: Record<string, "Base" | "Pro"> = {
  plan_2NqC2WJzV87QY: "Base",
  plan_J8vFpCWME75W3: "Pro",
  plan_SIYHeHyFp1dbR: "Pro",
  plan_SGscR3JhdTtKh: "Base",
  plan_9nyRNbuhQF0pk: "Pro",
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

function emailLocal(email: string | null): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : null;
}

// Display-name priority: Whop's real name field from checkout, unless it just
// mirrors the auto-handle (Whop sometimes copies username into name); then the
// email local part. Usernames are NEVER shown: auto-handles like
// "alienfloor03" read worse than the no-name greeting variants, so anything
// past email resolves to null.
export function resolveDisplayName(summary: WhopMemberSummary): string | null {
  if (summary.name && summary.name !== summary.username) return summary.name;
  return emailLocal(summary.email);
}

// ui-avatars renders 64px by default, which blurs at display sizes; request a
// retina-friendly size. Real uploads on assets-2-prod.whop.com are full-res.
function normalizePhotoUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.includes("ui-avatars.com")) {
    try {
      const parsed = new URL(url);
      parsed.searchParams.set("size", "256");
      return parsed.toString();
    } catch {
      return url;
    }
  }
  return url;
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
        summary.photoUrl = summary.photoUrl ?? normalizePhotoUrl(str(user.profile_pic));
      }
    }
    return summary;
  } catch {
    return EMPTY;
  }
}

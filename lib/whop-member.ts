import { rowOwner, rowProduct, WHOP_API_VERSION_DATE } from "@/app/api/whop/whop-membership";

// Server-only: one Whop memberships lookup that yields everything the
// dashboard needs about the caller: tier, plan, and the embedded Whop user
// profile (name, username, email, photo). Never import in client components.

export type WhopMemberSummary = {
  tier: "Base" | "Pro" | "Ultra" | null;
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
//   Pro 6-month $250, Ultra monthly $249 / 3-month $600 / 6-month $1,000 (ids below)
const PLAN_TIERS: Record<string, "Base" | "Pro" | "Ultra"> = {
  plan_2NqC2WJzV87QY: "Base",
  plan_J8vFpCWME75W3: "Pro",
  plan_SIYHeHyFp1dbR: "Pro",
  plan_SGscR3JhdTtKh: "Base",
  plan_9nyRNbuhQF0pk: "Pro",
  plan_mjpuBNS3KJqmw: "Ultra",
  plan_MVEXluUMjBlxL: "Ultra",
  plan_8CGnZkflAnXOe: "Ultra",
  plan_tfYMBwmuOwuB0: "Pro",
};

// Multi-membership priority: Ultra > Pro > Base.
const TIER_RANK: Record<string, number> = { Ultra: 3, Pro: 2, Base: 1 };

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
    // SINGULAR user_id / product_id with the pinned API version, the same read
    // the cancel and pause routes use (app/api/whop/whop-membership.ts). The
    // plural user_ids / product_ids / statuses filters are ignored by the key's
    // API version: checked again 2026-11-09, they returned the company's 20
    // newest memberships, 20 different owners, none of them the caller's, so
    // every Profile showed the highest plan among the newest sign ups.
    const params = new URLSearchParams({ company_id: companyId, user_id: whopUserId, product_id: productId, first: "50" });

    const res = await fetch(`https://api.whop.com/api/v1/memberships?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${process.env.WHOP_API_KEY ?? ""}`,
        Accept: "application/json",
        "Api-Version-Date": WHOP_API_VERSION_DATE,
      },
      cache: "no-store",
    });
    if (!res.ok) return EMPTY;

    const page = await res.json();
    const all: Record<string, unknown>[] = (Array.isArray(page?.data) ? page.data : []).filter(
      (m: unknown): m is Record<string, unknown> => !!m && typeof m === "object"
    );
    // A row for another user means the filter was ignored again: show nothing
    // rather than someone else's plan.
    if (all.some((m) => rowOwner(m) !== null && rowOwner(m) !== whopUserId)) {
      console.error("whop-member: foreign user in memberships read (user_id filter ignored)");
      return EMPTY;
    }
    // Same statuses as before (active, trialing, completed), now filtered here.
    const rows = all.filter((m) => {
      const product = rowProduct(m);
      if (product !== null && product !== productId) return false;
      return m.status === "active" || m.status === "trialing" || m.status === "completed";
    });

    const summary: WhopMemberSummary = { ...EMPTY };
    for (const row of rows) {
      const plan = row.plan as Record<string, unknown> | undefined;
      const planId = typeof row.plan_id === "string" ? row.plan_id : str(plan?.id);
      const rowTier = planId ? PLAN_TIERS[planId] : undefined;
      // Highest tier wins when a user holds multiple memberships (Ultra > Pro > Base).
      if (rowTier && (TIER_RANK[rowTier] ?? 0) > (summary.tier ? TIER_RANK[summary.tier] ?? 0 : 0)) {
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

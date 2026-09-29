// Fetches a Whop user's membership and returns the "winning" row using
// the SAME logic as scripts/backfill-whop-members.mjs so login-time
// writes and safety-net backfill writes agree.
//
// This intentionally differs from lib/whop-member.ts's getWhopMemberSummary
// (which picks "Pro always wins" for tier display in the manage page).
// Do not merge the two - they answer different questions.

const WHOP_API_BASE = "https://api.whop.com/api/v1";

const PLAN_TIERS: Record<string, "Base" | "Pro"> = {
  plan_2NqC2WJzV87QY: "Base",
  plan_J8vFpCWME75W3: "Pro",
  plan_9nyRNbuhQF0pk: "Pro",
  plan_tfYMBwmuOwuB0: "Pro",
  plan_mjpuBNS3KJqmw: "Pro",
  plan_SIYHeHyFp1dbR: "Pro",
  plan_SGscR3JhdTtKh: "Base",
};

const STATUS_RANK: Record<string, number> = {
  active: 0,
  trialing: 1,
  paid: 2,
  completed: 3,
};

export type WhopMemberDetail = {
  whopDisplayName: string | null;
  whopUsername: string | null;
  whopTier: "Base" | "Pro" | null;
  whopPlanId: string | null;
  whopJoinedAt: string | null;
};

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toMs(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    return v < 1e12 ? v * 1000 : v;
  }
  if (typeof v === "string") {
    const parsed = Date.parse(v);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toIso(v: unknown): string | null {
  const ms = toMs(v);
  if (!ms) return null;
  return new Date(ms).toISOString();
}

export async function getWhopMemberDetail(
  whopUserId: string,
): Promise<WhopMemberDetail | null> {
  const companyId = process.env.WHOP_COMPANY_ID;
  const productId = process.env.WHOP_PRODUCT_ID;
  const apiKey = process.env.WHOP_API_KEY;
  if (!companyId || !productId || !apiKey) return null;

  const url = new URL(`${WHOP_API_BASE}/memberships`);
  url.searchParams.set("company_id", companyId);
  url.searchParams.set("user_ids", whopUserId);
  url.searchParams.set("product_ids", productId);
  url.searchParams.append("statuses", "active");
  url.searchParams.append("statuses", "trialing");
  url.searchParams.append("statuses", "completed");

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const body = (await res.json()) as { data?: unknown[] };
  const rows = Array.isArray(body?.data) ? body.data : [];
  if (rows.length === 0) return null;

  // Pick winner: lowest STATUS_RANK, tie-break by newest
  // joined_at ?? created_at. Matches backfill script.
  let winner: Record<string, unknown> | null = null;
  let winnerRank = Number.POSITIVE_INFINITY;
  let winnerTs = -1;

  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const status = typeof row.status === "string" ? row.status : "";
    const rank = STATUS_RANK[status];
    if (rank === undefined) continue;
    const ts = toMs(row.joined_at) || toMs(row.created_at);
    if (
      rank < winnerRank ||
      (rank === winnerRank && ts > winnerTs)
    ) {
      winner = row;
      winnerRank = rank;
      winnerTs = ts;
    }
  }
  if (!winner) return null;

  const plan =
    winner.plan && typeof winner.plan === "object"
      ? (winner.plan as Record<string, unknown>)
      : null;
  const user =
    winner.user && typeof winner.user === "object"
      ? (winner.user as Record<string, unknown>)
      : null;

  const planId = str(plan?.id) ?? str(winner.plan_id);
  const tier = planId && PLAN_TIERS[planId] ? PLAN_TIERS[planId] : null;

  return {
    whopDisplayName: str(user?.name),
    whopUsername: str(user?.username),
    whopTier: tier,
    whopPlanId: planId,
    whopJoinedAt: toIso(winner.joined_at) ?? toIso(winner.created_at),
  };
}

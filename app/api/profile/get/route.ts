import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../../lib/session";
import { createAdminClient } from "../../../../lib/supabase/server";

// Same hosted plan ids as the landing PLANS config.
const PLAN_TIERS: Record<string, "Base" | "Pro"> = {
  plan_2NqC2WJzV87QY: "Base",
  plan_J8vFpCWME75W3: "Pro",
};

// Best-effort tier + email from the caller's memberships. Tier falls back to
// "Member" when no known plan id is present; email is null unless the
// membership payload carries one (we never store it ourselves).
async function getWhopTierAndEmail(
  whopUserId: string
): Promise<{ tier: string; email: string | null }> {
  const productId = process.env.WHOP_PRODUCT_ID;
  const companyId = process.env.WHOP_COMPANY_ID;
  if (!productId || !companyId) return { tier: "Member", email: null };

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
    if (!res.ok) return { tier: "Member", email: null };

    const page = await res.json();
    const rows: Record<string, unknown>[] = (Array.isArray(page?.data) ? page.data : []).filter(
      (m: unknown): m is Record<string, unknown> => !!m && typeof m === "object"
    );

    let tier = "Member";
    let email: string | null = null;
    for (const row of rows) {
      const planId =
        typeof row.plan_id === "string"
          ? row.plan_id
          : typeof (row.plan as Record<string, unknown> | undefined)?.id === "string"
            ? ((row.plan as Record<string, unknown>).id as string)
            : null;
      const rowTier = planId ? PLAN_TIERS[planId] : undefined;
      // Pro wins over Base when both memberships exist.
      if (rowTier === "Pro") tier = "Pro";
      else if (rowTier === "Base" && tier !== "Pro") tier = "Base";

      if (!email) {
        const user = row.user as Record<string, unknown> | undefined;
        if (typeof row.user_email === "string") email = row.user_email;
        else if (typeof user?.email === "string") email = user.email as string;
      }
    }
    return { tier, email };
  } catch {
    return { tier: "Member", email: null };
  }
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("member_profiles")
    .select("*")
    .eq("whop_user_id", session.whopUserId)
    .maybeSingle();

  const { tier, email } = await getWhopTierAndEmail(session.whopUserId);

  return NextResponse.json({
    ok: true,
    profile: {
      displayName: data?.display_name ?? "",
      phone: data?.phone ?? "",
      timezone: data?.timezone ?? "America/Los_Angeles",
      headline: data?.headline ?? "",
      bio: data?.bio ?? "",
      photoUrl: data?.photo_url ?? null,
    },
    tier,
    email,
  });
}

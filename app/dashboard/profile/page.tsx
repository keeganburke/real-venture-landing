import Link from "next/link";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../lib/session";
import { createAdminClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

const PLAN_TIERS: Record<string, "Base" | "Pro"> = {
  plan_2NqC2WJzV87QY: "Base",
  plan_J8vFpCWME75W3: "Pro",
};

async function getTier(whopUserId: string): Promise<string> {
  const productId = process.env.WHOP_PRODUCT_ID;
  const companyId = process.env.WHOP_COMPANY_ID;
  if (!productId || !companyId) return "Member";
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
    if (!res.ok) return "Member";
    const page = await res.json();
    const rows: Record<string, unknown>[] = Array.isArray(page?.data) ? page.data : [];
    let tier = "Member";
    for (const row of rows) {
      const planId =
        typeof row.plan_id === "string"
          ? row.plan_id
          : typeof (row.plan as Record<string, unknown> | undefined)?.id === "string"
            ? ((row.plan as Record<string, unknown>).id as string)
            : null;
      const rowTier = planId ? PLAN_TIERS[planId] : undefined;
      if (rowTier === "Pro") tier = "Pro";
      else if (rowTier === "Base" && tier !== "Pro") tier = "Base";
    }
    return tier;
  } catch {
    return "Member";
  }
}

export default async function ProfilePage() {
  // Layout already gates; re-read here for the user id.
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return null;

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("member_profiles")
    .select("display_name, photo_url")
    .eq("whop_user_id", session.whopUserId)
    .maybeSingle();

  const tier = await getTier(session.whopUserId);
  const name = profile?.display_name || "Member";
  const initial = name.trim().charAt(0).toUpperCase() || "M";

  return (
    <div className="hub2-page">
      <div className="hub2-shell">
        <div className="pf-stack">
          <nav className="hub2-nav">
            <Link href="/dashboard" className="hub2-menu">{"←"} Back to hub</Link>
          </nav>

          <section className="pf-card">
            {profile?.photo_url ? (
              <img className="pf-photo" src={profile.photo_url} alt={name} width={112} height={112} />
            ) : (
              <div className="pf-photo pf-photo-fallback" aria-hidden="true">{initial}</div>
            )}
            <h1 className="pf-name">{name}</h1>
            <div className={`pf-tier${tier === "Pro" ? " is-pro" : ""}`}>{tier} member</div>
            <Link href="/dashboard/profile/edit" className="pf-edit-btn">
              Edit profile
            </Link>
          </section>

        </div>
      </div>
    </div>
  );
}

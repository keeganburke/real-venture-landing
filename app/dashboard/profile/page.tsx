import Link from "next/link";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../lib/session";
import { createAdminClient } from "../../../lib/supabase/server";
import { getWhopMemberSummary, resolveDisplayName } from "../../../lib/whop-member";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  // Layout already gates; re-read here for the user id.
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return null;

  const supabase = createAdminClient();
  const [{ data: profile }, whopMember] = await Promise.all([
    supabase
      .from("member_profiles")
      .select("display_name, photo_url")
      .eq("whop_user_id", session.whopUserId)
      .maybeSingle(),
    getWhopMemberSummary(session.whopUserId),
  ]);

  const tier = whopMember.tier;
  const name = profile?.display_name || resolveDisplayName(whopMember) || "Member";
  const photoUrl = profile?.photo_url || whopMember.photoUrl;
  const initial = name.trim().charAt(0).toUpperCase() || "M";

  return (
    <div className="hub2-page">
      <div className="hub2-shell">
        <div className="pf-stack">
          <nav className="hub2-nav">
            <Link href="/dashboard" className="hub2-menu">{"←"} Back to hub</Link>
          </nav>

          <section className="pf-card">
            {photoUrl ? (
              <img className="pf-photo" src={photoUrl} alt={name} width={140} height={140} />
            ) : (
              <div className="pf-photo pf-photo-fallback" aria-hidden="true">{initial}</div>
            )}
            <h1 className="pf-name">{name}</h1>
            <div className={`pf-tier${tier === "Pro" ? " pf-badge-pro" : tier === "Base" ? " pf-badge-base" : ""}`}>
              {tier ? `👑 ${tier} member` : "Member"}
            </div>
            <Link href="/dashboard/profile/edit" className="pf-edit-btn">
              Edit profile
            </Link>
          </section>

        </div>
      </div>
    </div>
  );
}

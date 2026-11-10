import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../lib/session";
import { getIntakeCookie } from "../../lib/intake-cookie";
import { createAdminClient } from "../../lib/supabase/server";
import { getWhopMemberSummary, resolveDisplayName } from "../../lib/whop-member";
import { dashboardAccess } from "../../lib/whop-access";
import { isAdmin } from "../../lib/admin-allowlist";
import DashboardNav from "./DashboardNav";
import InstallBanner from "./InstallBanner";

export const metadata: Metadata = {
  title: "Real Venture | Hub",
};

// Same gate pattern as app/onboarding/layout.tsx: reads only, no cookie
// writes in server components. Additionally requires a completed intake.
export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) redirect("/api/auth/whop/start");

  // Membership re-check (lib/whop-access.ts): a member whose plan ended loses
  // the hub now, not at their next login. Admins skip it; a Whop error lets
  // the person in.
  if (!isAdmin(session.whopUserId)) {
    // (the never-kick list is checked inside dashboardAccess)
    const access = await dashboardAccess(session.whopUserId);
    // signed in under an hour ago (a brand new buyer finishing onboarding):
    // never a turn away, the "Finishing your purchase" screen keeps checking.
    // Sessions made before this fix have no iat, so they are never "recent".
    const signedInRecently = typeof session.iat === "number" && Date.now() / 1000 - session.iat < 60 * 60;
    if ((access === "ended" || access === "none") && signedInRecently) redirect("/finishing-purchase");
    if (access === "ended") redirect("/membership-ended");
    if (access === "none") redirect("/login?auth=denied");
  }

  // One profile read serves both the intake gate and the nav identity.
  // Nav identity: saved profile wins, Whop's embedded user record fills gaps.
  const [profileRes, whopMember] = await Promise.all([
    createAdminClient()
      .from("member_profiles")
      .select("display_name, photo_url, intake_completed_at")
      .eq("whop_user_id", session.whopUserId)
      .maybeSingle(),
    getWhopMemberSummary(session.whopUserId),
  ]);
  if (profileRes.error) {
    console.error("[dashboard/layout] member_profiles read failed", profileRes.error.message);
  }

  // Intake gate: Supabase first, cookie second. intake_completed_at is set
  // once by /api/intake/save and never expires, so a member who finished on
  // any device is never forced back through onboarding by a missing or
  // expired rv_intake cookie. A failed read leaves it null and the cookie
  // decides, exactly as before.
  const completedInDb = Boolean(profileRes.data?.intake_completed_at);
  if (!completedInDb) {
    const intake = await getIntakeCookie();
    if (!intake?.completedAt) redirect("/onboarding");
  }
  const profileName = profileRes.data?.display_name;
  const displayName =
    typeof profileName === "string" && profileName.trim().length > 0
      ? profileName.trim()
      : resolveDisplayName(whopMember);
  const rawPhoto = profileRes.data?.photo_url;
  const avatarUrl =
    typeof rawPhoto === "string" && rawPhoto.length > 0 ? rawPhoto : whopMember.photoUrl;

  return (
    <>
      <DashboardNav
        avatarUrl={avatarUrl}
        initial={(displayName?.trim().charAt(0) || "M").toUpperCase()}
      />
      <InstallBanner />
      {children}
    </>
  );
}

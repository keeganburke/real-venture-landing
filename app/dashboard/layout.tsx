import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../lib/session";
import { getIntakeCookie } from "../../lib/intake-cookie";
import { createAdminClient } from "../../lib/supabase/server";
import { getWhopMemberSummary, resolveDisplayName } from "../../lib/whop-member";
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

  const intake = await getIntakeCookie();
  if (!intake?.completedAt) redirect("/onboarding");

  // Nav identity: saved profile wins, Whop's embedded user record fills gaps.
  const [profileRes, whopMember] = await Promise.all([
    createAdminClient()
      .from("member_profiles")
      .select("display_name, photo_url")
      .eq("whop_user_id", session.whopUserId)
      .maybeSingle(),
    getWhopMemberSummary(session.whopUserId),
  ]);
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

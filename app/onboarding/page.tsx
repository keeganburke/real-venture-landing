import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getIntakeCookie } from "../../lib/intake-cookie";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../lib/session";
import { createAdminClient } from "../../lib/supabase/server";
import OnboardingClient from "./OnboardingClient";

// Durable completion check. The rv_intake cookie has a 7 day TTL and is
// per-device, so it alone would re-run onboarding after expiry or on a new
// device. member_profiles.intake_completed_at is written by /api/intake/save
// on completion and never expires. Any failure returns false so the cookie
// path below still decides, exactly as before.
async function hasCompletedIntakeInDb(whopUserId: string): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient()
      .from("member_profiles")
      .select("intake_completed_at")
      .eq("whop_user_id", whopUserId)
      .maybeSingle();
    if (error) {
      console.error("[onboarding/page] intake_completed_at lookup failed", error.message);
      return false;
    }
    return Boolean(data?.intake_completed_at);
  } catch (err) {
    console.error("[onboarding/page] intake_completed_at lookup threw", err);
    return false;
  }
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ force?: string }>;
}) {
  const { force } = await searchParams;
  const forced = force === "1";

  // Supabase first, then cookie. ?force=1 (Take the Tour / replay) skips the
  // DB gate so the questions can be redone; the layout already guaranteed a
  // session, this just re-reads it for the whop_user_id.
  if (!forced) {
    const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
    const session = token ? await verifySessionToken(token) : null;
    if (session && (await hasCompletedIntakeInDb(session.whopUserId))) {
      redirect("/dashboard");
    }
  }

  const answers = await getIntakeCookie();
  if (answers?.completedAt && !forced) redirect("/dashboard");
  // answers.tourCompletedAt rides in the same signed payload; OnboardingClient
  // reads it to skip the tour phase on revisit. A forced replay (Take the
  // Tour) strips it from the props so the tour renders again; the cookie
  // itself is untouched and prior answers stay prefilled.
  const initialAnswers = forced ? { ...(answers ?? {}), tourCompletedAt: null } : (answers ?? {});
  return <OnboardingClient initialAnswers={initialAnswers} />;
}

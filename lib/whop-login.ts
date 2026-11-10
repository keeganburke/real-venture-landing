// Server only. The end of a successful Whop sign in, shared by the login
// callback (app/api/auth/whop/callback) and the "Finishing your purchase"
// check (app/api/auth/whop/purchase-status): stamp the profile, make the
// session, and send the person to onboarding or the hub. Moved here
// unchanged from the callback.
import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/session";
import { setIntakeCookie } from "@/lib/intake-cookie";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWhopMemberDetail } from "@/lib/whop-member-detail";

// Existing members skip onboarding: memberships created before this instant
// (9:30 PM Pacific, Aug 28 2026) bypass the tour + intake entirely.
const ONBOARDING_CUTOFF = new Date("2026-08-29T04:30:00Z");

/** Non-blocking: stamp whop_* fields onto member_profiles so admin
    dashboards and cohort features have real data from first login. If the
    Whop API hiccups, log and continue (the backfill script is the safety
    net). NEVER blocks login. */
export async function stampProfile(whopUserId: string): Promise<void> {
  try {
    const detail = await getWhopMemberDetail(whopUserId);
    if (!detail) return;
    const { error } = await createAdminClient()
      .from("member_profiles")
      .upsert(
        // only fields with a value: a missing name or username never blanks a
        // good one already saved
        {
          whop_user_id: whopUserId,
          ...(detail.whopDisplayName ? { whop_display_name: detail.whopDisplayName } : {}),
          ...(detail.whopUsername ? { whop_username: detail.whopUsername } : {}),
          ...(detail.whopTier ? { whop_tier: detail.whopTier } : {}),
          ...(detail.whopPlanId ? { whop_plan_id: detail.whopPlanId } : {}),
          ...(detail.whopJoinedAt ? { whop_joined_at: detail.whopJoinedAt } : {}),
        },
        { onConflict: "whop_user_id" },
      );
    if (error) console.error("[whop-callback] member_profiles upsert failed", error);
  } catch (err) {
    console.error("[whop-callback] whop detail stamp failed", err);
  }
}

/** Make the session and pick where the member goes. `respond` builds the
    response for a path (a redirect for the callback, JSON for the purchase
    check). Returns null if the session could not be signed. */
export async function completeLogin(
  whopUserId: string,
  oldestCreatedAtMs: number | null,
  sessionTtl: number,
  respond: (path: "/dashboard" | "/onboarding") => NextResponse,
): Promise<NextResponse | null> {
  // the stamp never holds up a sign in by more than 4 seconds (the login
  // has a 60 second limit and may already have waited on Whop)
  await Promise.race([stampProfile(whopUserId), new Promise<void>((r) => setTimeout(r, 4000))]);

  const sessionToken = await createSessionToken(whopUserId, sessionTtl);
  if (!sessionToken) return null;

  // Existing members (oldest membership before the cutoff) skip onboarding.
  // Missing or unparseable created_at defaults to onboarding.
  let decision: "bypass" | "onboard" | "onboard_default" = "onboard_default";
  if (oldestCreatedAtMs !== null) {
    decision = oldestCreatedAtMs < ONBOARDING_CUTOFF.getTime() ? "bypass" : "onboard";
  }
  console.log("[whop/callback] Onboarding routing", {
    whopUserId,
    membershipCreatedAt: oldestCreatedAtMs === null ? null : new Date(oldestCreatedAtMs).toISOString(),
    cutoff: ONBOARDING_CUTOFF.toISOString(),
    decision,
  });

  if (decision === "bypass") {
    const now = new Date().toISOString();
    const response = respond("/dashboard");
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions(sessionTtl));
    // Mark intake complete so no later code path pulls them into onboarding.
    const signed = await setIntakeCookie(response, { completedAt: now, tourCompletedAt: now });
    if (signed) return response;
    // Could not sign the intake cookie; send through onboarding instead of
    // letting the dashboard gate bounce them in a loop.
  }

  const response = respond("/onboarding");
  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions(sessionTtl));
  return response;
}

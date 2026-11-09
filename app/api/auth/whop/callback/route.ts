import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE_NAME, sessionCookieOptions } from "../../../../../lib/session";
import { setIntakeCookie } from "../../../../../lib/intake-cookie";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWhopMemberDetail } from "@/lib/whop-member-detail";
import { waitForWhopAccess } from "@/lib/whop-access";

// the membership check can wait up to about 20 seconds for a brand new
// purchase to show up on Whop; leave room for it and the token exchange
export const maxDuration = 60;

function clearOAuthCookies(response: NextResponse): NextResponse {
  const clear = { maxAge: 0, path: "/" };
  response.cookies.set("whop_oauth_state", "", clear);
  response.cookies.set("whop_code_verifier", "", clear);
  return response;
}

// The membership gate lives in lib/whop-access.ts (shared with the dashboard
// layout): the safe single-user read with an owner check. Any membership on
// the membership product that is active, trialing, completed or past_due lets
// the person in; a Whop error or timeout also lets them in (logged), so an
// outage never locks out a paying member.
// Existing members skip onboarding: memberships created before this instant
// (9:30 PM Pacific, Aug 28 2026) bypass the tour + intake entirely.
const ONBOARDING_CUTOFF = new Date("2026-08-29T04:30:00Z");

export async function GET(request: NextRequest) {
  // Every redirect and the token-exchange redirect_uri derive from the host the
  // browser is actually on (see start/route.ts). Redirecting to a different
  // host than the one the session cookie was set on forces a second sign-in.
  const origin = request.nextUrl.origin || process.env.NEXT_PUBLIC_SITE_URL || "";
  const redirectUri = `${origin}/api/auth/whop/callback`;
  const { searchParams } = new URL(request.url);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const storedState = request.cookies.get("whop_oauth_state")?.value;
  const codeVerifier = request.cookies.get("whop_code_verifier")?.value;

  if (!state || !storedState || state !== storedState) {
    return clearOAuthCookies(NextResponse.redirect(`${origin}/login?auth=state_mismatch`));
  }
  if (!code || !codeVerifier) {
    return clearOAuthCookies(NextResponse.redirect(`${origin}/login?auth=whop_error`));
  }

  let accessToken: string;
  try {
    const tokenRes = await fetch("https://api.whop.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: process.env.WHOP_CLIENT_ID,
        client_secret: process.env.WHOP_CLIENT_SECRET,
        code_verifier: codeVerifier,
      }),
    });
    if (!tokenRes.ok) {
      return clearOAuthCookies(NextResponse.redirect(`${origin}/login?auth=whop_error`));
    }
    const tokenData = await tokenRes.json();
    if (typeof tokenData?.access_token !== "string" || tokenData.access_token.length === 0) {
      return clearOAuthCookies(NextResponse.redirect(`${origin}/login?auth=whop_error`));
    }
    accessToken = tokenData.access_token;
  } catch {
    return clearOAuthCookies(NextResponse.redirect(`${origin}/login?auth=whop_error`));
  }

  let whopUserId: string;
  try {
    const userinfoRes = await fetch("https://api.whop.com/oauth/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userinfoRes.ok) {
      return clearOAuthCookies(NextResponse.redirect(`${origin}/login?auth=whop_error`));
    }
    const userinfo = await userinfoRes.json();
    if (typeof userinfo?.sub !== "string" || userinfo.sub.length === 0) {
      return clearOAuthCookies(NextResponse.redirect(`${origin}/login?auth=whop_error`));
    }
    whopUserId = userinfo.sub;
  } catch {
    return clearOAuthCookies(NextResponse.redirect(`${origin}/login?auth=whop_error`));
  }

  // Whop's memberships list is eventually consistent right after checkout, so
  // "ended" and "none" are asked again for up to about 20 seconds before they
  // are believed (lib/whop-access.ts). A Whop error lets the person in.
  const access = await waitForWhopAccess(whopUserId);
  if (access.kind === "error") {
    console.error("[whop/callback] membership check unavailable, letting in", { whopUserId, reason: access.reason, tries: access.tries });
  } else if (access.kind === "ended") {
    // owned memberships, none live: the friendly win back page, not an error
    console.log("[whop/callback] membership ended", { whopUserId, tries: access.tries });
    return clearOAuthCookies(NextResponse.redirect(`${origin}/membership-ended`));
  } else if (access.kind === "none") {
    // nothing on the product: usually the wrong Whop account (unchanged screen)
    console.log("[whop/callback] no membership on this account", { whopUserId, tries: access.tries });
    return clearOAuthCookies(NextResponse.redirect(`${origin}/login?auth=denied`));
  }
  const membership = { oldestCreatedAtMs: access.kind === "member" ? access.oldestCreatedAtMs : null };

  // Non-blocking: stamp whop_* fields onto member_profiles so admin
  // dashboards and cohort features have real data from first login.
  // If Whop API hiccups, log and continue - backfill script is the
  // safety net. NEVER block login on this.
  try {
    const detail = await getWhopMemberDetail(whopUserId);
    if (detail) {
      const admin = createAdminClient();
      const { error: profileError } = await admin
        .from("member_profiles")
        .upsert(
          // only fields with a value: a missing name or username never
          // blanks a good one already saved
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
      if (profileError) {
        console.error(
          "[whop-callback] member_profiles upsert failed",
          profileError,
        );
      }
    }
  } catch (err) {
    console.error("[whop-callback] whop detail stamp failed", err);
  }

  const sessionToken = await createSessionToken(whopUserId);
  if (!sessionToken) {
    return clearOAuthCookies(NextResponse.redirect(`${origin}/login?auth=whop_error`));
  }

  // Existing members (oldest membership before the cutoff) skip onboarding.
  // Missing or unparseable created_at defaults to onboarding.
  const { oldestCreatedAtMs } = membership;
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
    const response = NextResponse.redirect(`${origin}/dashboard`);
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions());
    // Mark intake complete so no later code path pulls them into onboarding.
    const signed = await setIntakeCookie(response, { completedAt: now, tourCompletedAt: now });
    if (signed) return clearOAuthCookies(response);
    // Could not sign the intake cookie; send through onboarding instead of
    // letting the dashboard gate bounce them in a loop.
  }

  const response = NextResponse.redirect(`${origin}/onboarding`);
  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions());
  return clearOAuthCookies(response);
}

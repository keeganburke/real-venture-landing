import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE_NAME, sessionCookieOptions } from "../../../../../lib/session";
import { setIntakeCookie } from "../../../../../lib/intake-cookie";

function clearOAuthCookies(response: NextResponse): NextResponse {
  const clear = { maxAge: 0, path: "/" };
  response.cookies.set("whop_oauth_state", "", clear);
  response.cookies.set("whop_code_verifier", "", clear);
  return response;
}

// Admin read via WHOP_API_KEY, never the OAuth client secret or the user's
// access token (spec 6.14). Plain fetch stands in for the SDK's
// memberships.list per spec section 5, matching its wire format: plural
// array params (user_ids, product_ids, statuses) with company_id singular;
// a non-empty data array means an active membership. The gate is
// product-based, not plan-based: any membership on the membership product
// counts, so newly launched plans grant access without a deploy. Status
// "completed" is included because one-time and lifetime purchases finish as
// completed and stay that way; scoping to the single membership product
// keeps unrelated one-time purchases from granting access.
// Existing members skip onboarding: memberships created before this instant
// (9:30 PM Pacific, Aug 28 2026) bypass the tour + intake entirely.
const ONBOARDING_CUTOFF = new Date("2026-08-29T04:30:00Z");

// Strict created_at parse. Anything dubious returns null so the routing
// defaults to onboarding (a numeric unix-seconds value would otherwise
// parse as 1970 and wrongly bypass a brand-new member).
function parseCreatedAtMs(value: unknown): number | null {
  let ms: number | null = null;
  if (typeof value === "string") {
    const parsed = new Date(value).getTime();
    ms = Number.isNaN(parsed) ? null : parsed;
  } else if (typeof value === "number" && Number.isFinite(value)) {
    ms = value < 1e12 ? value * 1000 : value;
  }
  if (ms === null || ms < Date.UTC(2020, 0, 1)) return null;
  return ms;
}

async function getWhopMembership(
  whopUserId: string
): Promise<{ active: boolean; oldestCreatedAtMs: number | null }> {
  const productId = process.env.WHOP_PRODUCT_ID;
  const companyId = process.env.WHOP_COMPANY_ID;
  if (!productId || !companyId) return { active: false, oldestCreatedAtMs: null };

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
    if (!res.ok) return { active: false, oldestCreatedAtMs: null };
    const page = await res.json();
    const rows: Record<string, unknown>[] = (Array.isArray(page?.data) ? page.data : []).filter(
      (m: unknown): m is Record<string, unknown> => !!m && typeof m === "object"
    );
    let oldest: number | null = null;
    for (const row of rows) {
      const ms = parseCreatedAtMs(row.created_at);
      if (ms !== null && (oldest === null || ms < oldest)) oldest = ms;
    }
    return { active: rows.length > 0, oldestCreatedAtMs: oldest };
  } catch {
    return { active: false, oldestCreatedAtMs: null };
  }
}

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

  // Whop's memberships list is eventually consistent right after checkout.
  // Retry once with a 1.5s delay before denying (spec 6.7).
  let membership = await getWhopMembership(whopUserId);
  if (!membership.active) {
    await new Promise((r) => setTimeout(r, 1500));
    membership = await getWhopMembership(whopUserId);
  }

  if (!membership.active) {
    return clearOAuthCookies(NextResponse.redirect(`${origin}/login?auth=denied`));
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

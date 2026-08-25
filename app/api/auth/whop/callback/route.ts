import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE_NAME, sessionCookieOptions } from "../../../../../lib/session";

// Hardcoded plan allowlist, copied exactly from the spec. New paid plans must
// be appended here and deployed or their subscribers are denied (spec 6.9).
const PAID_PLAN_IDS = [
  "plan_J8vFpCWME75W3",
  "plan_D2DOEif6aomSK",
  "plan_SIYHeHyFp1dbR",
  "plan_9nyRNbuhQF0pk",
];

function clearOAuthCookies(response: NextResponse): NextResponse {
  const clear = { maxAge: 0, path: "/" };
  response.cookies.set("whop_oauth_state", "", clear);
  response.cookies.set("whop_code_verifier", "", clear);
  return response;
}

// Admin read via WHOP_API_KEY, never the OAuth client secret or the user's
// access token (spec 6.14). Plain fetch stands in for the SDK's
// memberships.list per spec section 5; the plan and status scoping the SDK
// call expressed as parameters is enforced on the response here.
async function getWhopMembershipActive(whopUserId: string): Promise<boolean> {
  const productId = process.env.WHOP_PRODUCT_ID;
  const companyId = process.env.WHOP_COMPANY_ID;
  if (!productId || !companyId) return false;

  try {
    const params = new URLSearchParams({
      user_id: whopUserId,
      product_id: productId,
      company_id: companyId,
    });
    const res = await fetch(`https://api.whop.com/api/v2/memberships?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${process.env.WHOP_API_KEY ?? ""}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const page = await res.json();
    const memberships: { plan_id?: string; status?: string }[] = Array.isArray(page?.data)
      ? page.data
      : [];
    return memberships.some(
      (m) =>
        typeof m?.plan_id === "string" &&
        PAID_PLAN_IDS.includes(m.plan_id) &&
        (m?.status === "active" || m?.status === "trialing")
    );
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const redirectUri = `${origin}/api/auth/whop/callback`;
  const { searchParams } = new URL(request.url);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const storedState = request.cookies.get("whop_oauth_state")?.value;
  const codeVerifier = request.cookies.get("whop_code_verifier")?.value;

  if (!state || !storedState || state !== storedState) {
    return clearOAuthCookies(NextResponse.redirect(`${origin}/?auth=state_mismatch`));
  }
  if (!code || !codeVerifier) {
    return clearOAuthCookies(NextResponse.redirect(`${origin}/?auth=whop_error`));
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
      return clearOAuthCookies(NextResponse.redirect(`${origin}/?auth=whop_error`));
    }
    const tokenData = await tokenRes.json();
    if (typeof tokenData?.access_token !== "string" || tokenData.access_token.length === 0) {
      return clearOAuthCookies(NextResponse.redirect(`${origin}/?auth=whop_error`));
    }
    accessToken = tokenData.access_token;
  } catch {
    return clearOAuthCookies(NextResponse.redirect(`${origin}/?auth=whop_error`));
  }

  let whopUserId: string;
  try {
    const userinfoRes = await fetch("https://api.whop.com/oauth/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userinfoRes.ok) {
      return clearOAuthCookies(NextResponse.redirect(`${origin}/?auth=whop_error`));
    }
    const userinfo = await userinfoRes.json();
    if (typeof userinfo?.sub !== "string" || userinfo.sub.length === 0) {
      return clearOAuthCookies(NextResponse.redirect(`${origin}/?auth=whop_error`));
    }
    whopUserId = userinfo.sub;
  } catch {
    return clearOAuthCookies(NextResponse.redirect(`${origin}/?auth=whop_error`));
  }

  // Whop's memberships list is eventually consistent right after checkout.
  // Retry once with a 1.5s delay before denying (spec 6.7).
  let isActive = await getWhopMembershipActive(whopUserId);
  if (!isActive) {
    await new Promise((r) => setTimeout(r, 1500));
    isActive = await getWhopMembershipActive(whopUserId);
  }

  if (!isActive) {
    return clearOAuthCookies(NextResponse.redirect(`${origin}/?auth=denied`));
  }

  const sessionToken = await createSessionToken(whopUserId);
  if (!sessionToken) {
    return clearOAuthCookies(NextResponse.redirect(`${origin}/?auth=whop_error`));
  }

  const response = NextResponse.redirect(`${origin}/onboarding`);
  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions());
  return clearOAuthCookies(response);
}

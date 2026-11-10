import { NextRequest, NextResponse } from "next/server";
import { createPendingToken, PENDING_COOKIE_NAME, pendingCookieOptions, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "../../../../../lib/session";
import { isAdmin } from "@/lib/admin-allowlist";
import {
  hadMembership,
  hubAllowlisted,
  logLetInOnError,
  looksLikeRecentBuyer,
  RECENT_PURCHASE_COOKIE,
  waitForWhopAccess,
  type WhopAccess,
} from "@/lib/whop-access";
import { completeLogin } from "@/lib/whop-login";

// the membership check can wait up to about 20 seconds for a brand new
// purchase to show up on Whop; leave room for it and the token exchange
export const maxDuration = 60;

// someone turned away keeps no session from an earlier sign in
function clearSession(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, "", { maxAge: 0, path: "/" });
  return response;
}

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
// outage never locks out a paying member. The onboarding routing and the
// profile stamp are in lib/whop-login.ts (shared with the purchase check).

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
      signal: AbortSignal.timeout(10_000),
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
      signal: AbortSignal.timeout(10_000),
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
  // Someone who most likely just bought (came from the post checkout page,
  // or their membership or Whop account is under an hour old) doesn't wait
  // here: they go to "Finishing your purchase", which keeps checking for 2
  // minutes and never shows "Wrong email".
  const cameFromCheckout = request.cookies.get(RECENT_PURCHASE_COOKIE)?.value === "1";
  // admins skip the gate (the dashboard re-check skips them too)
  let access = isAdmin(whopUserId)
    ? ({ kind: "member", oldestCreatedAtMs: null, tries: 0 } as WhopAccess & { tries: number; recentBuyer?: boolean })
    : await waitForWhopAccess(whopUserId, {
        isRecentBuyer: async (a) => !(await hubAllowlisted(whopUserId)) && (await looksLikeRecentBuyer(whopUserId, a, { cameFromCheckout })),
      });
  // the Discord "never kick" list and anyone with a staff role in the Discord
  // (Owner, Founder, Group Coach, Underwriter, Moderator) keep the hub
  // without a membership on the product
  if ((access.kind === "ended" || access.kind === "none") && !access.recentBuyer && (await hubAllowlisted(whopUserId))) {
    console.log("[whop/callback] no membership, staff or never-kick list: letting in", { whopUserId });
    access = { kind: "member", oldestCreatedAtMs: null, tries: access.tries };
  }
  // Whop answered with strangers' rows (the user filter ignored, the original
  // bug): someone our own records show as a member before gets a 1 hour
  // session; anyone else is asked to try again in a minute (not let in)
  let untrustedButKnown = false;
  if (access.kind === "untrusted") {
    if (await hadMembership(whopUserId)) {
      untrustedButKnown = true;
      console.error("[whop/callback] Whop answer untrusted, known member: letting in for 1 hour", { whopUserId });
    } else {
      console.error("[whop/callback] Whop answer untrusted, no member record: try again", { whopUserId });
      return clearOAuthCookies(NextResponse.redirect(`${origin}/login?auth=whop_error`));
    }
  }
  // Whop rate limited our key (429). Anyone can cause that by hammering our
  // public routes, so it is not a free pass: someone our records show as a
  // member gets the usual 1 hour session; anyone else gets the "Finishing
  // your purchase" screen, which lets them in the moment Whop answers.
  let rateLimitedButKnown = false;
  if (access.kind === "error" && access.rateLimited) {
    if (await hadMembership(whopUserId)) {
      rateLimitedButKnown = true;
    } else {
      console.error("[WHOP_GATE_RATE_LIMITED] login: Whop rate limited our key, no member record: waiting screen", { whopUserId });
      access = { kind: "none", tries: access.tries, recentBuyer: true };
    }
  }
  // let in because Whop could not answer: a 1 hour session, so they are
  // checked again soon instead of holding a week long pass
  const sessionTtl = access.kind === "error" || untrustedButKnown ? 60 * 60 : SESSION_TTL_SECONDS;
  if (access.kind === "error") {
    logLetInOnError(rateLimitedButKnown ? "login (rate limited, known member)" : "login", whopUserId, access);
  } else if ((access.kind === "ended" || access.kind === "none") && access.recentBuyer) {
    // just bought, Whop doesn't list it yet: the waiting screen. The pass in
    // the cookie only lets /api/auth/whop/purchase-status keep checking; it
    // is not a session and opens nothing.
    const pending = await createPendingToken(whopUserId);
    if (!pending) return clearOAuthCookies(NextResponse.redirect(`${origin}/login?auth=whop_error`));
    console.log("[whop/callback] purchase not listed yet, finishing screen", { whopUserId, kind: access.kind, tries: access.tries, cameFromCheckout });
    const response = clearSession(clearOAuthCookies(NextResponse.redirect(`${origin}/finishing-purchase`)));
    response.cookies.set(PENDING_COOKIE_NAME, pending, pendingCookieOptions());
    return response;
  } else if (access.kind === "ended") {
    // owned memberships, none granting access: the friendly win back page
    console.log("[whop/callback] membership ended", { whopUserId, tries: access.tries });
    return clearSession(clearOAuthCookies(NextResponse.redirect(`${origin}/membership-ended`)));
  } else if (access.kind === "none") {
    // nothing on the product: usually the wrong Whop account (unchanged screen)
    console.log("[whop/callback] no membership on this account", { whopUserId, tries: access.tries });
    return clearSession(clearOAuthCookies(NextResponse.redirect(`${origin}/login?auth=denied`)));
  }
  const oldestCreatedAtMs = access.kind === "member" ? access.oldestCreatedAtMs : null;

  const response = await completeLogin(whopUserId, oldestCreatedAtMs, sessionTtl, (path) => NextResponse.redirect(`${origin}${path}`));
  if (!response) return clearOAuthCookies(NextResponse.redirect(`${origin}/login?auth=whop_error`));
  // a finished sign in leaves no waiting pass or purchase mark behind
  response.cookies.set(PENDING_COOKIE_NAME, "", { maxAge: 0, path: "/" });
  response.cookies.set(RECENT_PURCHASE_COOKIE, "", { maxAge: 0, path: "/" });
  return clearOAuthCookies(response);
}

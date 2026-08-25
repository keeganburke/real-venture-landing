import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const redirectUri = `${origin}/api/auth/whop/callback`;

  const state = crypto.randomUUID();
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const nonce = randomBytes(16).toString("hex");

  const authUrl = new URL("https://api.whop.com/oauth/authorize");
  authUrl.searchParams.set("client_id", process.env.WHOP_CLIENT_ID ?? "");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid profile email");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("nonce", nonce);

  const response = NextResponse.redirect(authUrl.toString());

  const cookieOpts = {
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 600,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  };
  response.cookies.set("whop_oauth_state", state, cookieOpts);
  response.cookies.set("whop_code_verifier", codeVerifier, cookieOpts);

  return response;
}

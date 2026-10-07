import type { NextRequest } from "next/server";

// Base URL for the guest Discord door, shared by the start and callback routes
// so the redirect_uri sent to Discord and the one in the token exchange always
// match. In production this is exactly what both routes used before:
// NEXT_PUBLIC_SITE_URL, falling back to https://realventure.io. Anywhere else
// (next dev on localhost, a preview) it is the origin the browser actually hit,
// so the door can be exercised end to end without leaving localhost.
const PROD_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://realventure.io";

export function guestSiteUrl(request: NextRequest): string {
  if (process.env.NODE_ENV === "production") return PROD_SITE_URL;
  return request.nextUrl.origin || PROD_SITE_URL;
}

export function guestRedirectUri(request: NextRequest): string {
  return `${guestSiteUrl(request)}/api/discord/guest/callback`;
}

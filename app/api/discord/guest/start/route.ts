import { NextRequest, NextResponse } from "next/server";
import { guestRedirectUri, guestSiteUrl } from "../site-url";
import { encodeGuestState } from "../../../../../lib/discord-guest-link";

// Free Discord door for /free leads. No Whop login, no session: one Discord
// "Authorize" tap, then the guest callback adds them with the Guest role only.
// Mirrors app/api/discord/connect (the member flow) without importing it.
export const dynamic = "force-dynamic";

const GUEST_STATE_COOKIE = "rv_guest_state";

export async function GET(request: NextRequest) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) {
    console.error("[discord/guest/start] DISCORD_CLIENT_ID missing");
    return NextResponse.redirect(new URL("/free?discord=error", guestSiteUrl(request)));
  }

  // Same helper as the callback's token exchange, so the two always match.
  const redirectUri = guestRedirectUri(request);
  // The OAuth `state` doubles as the CSRF token AND the carrier for the two
  // attribution params. The whole string is still stored in the one-shot
  // cookie, so the callback's `state === cookie` check is unchanged; the
  // callback also decodes it to recover src/cid.
  const { searchParams } = request.nextUrl;
  const state = encodeGuestState({
    nonce: crypto.randomUUID(),
    src: searchParams.get("src"),
    cid: searchParams.get("cid"),
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify email guilds.join",
    state,
  });

  const response = NextResponse.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
  response.cookies.set(GUEST_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/discord/guest",
    maxAge: 600,
  });
  return response;
}

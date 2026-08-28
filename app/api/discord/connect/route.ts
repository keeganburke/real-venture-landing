import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../../lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  // Verify user is authenticated (has a valid Whop session).
  // Anonymous users get bounced to login.
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.redirect(
      new URL("/login?next=/api/discord/connect", process.env.NEXT_PUBLIC_SITE_URL ?? "https://realventure.io")
    );
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://realventure.io"}/api/discord/callback`;

  if (!clientId) {
    console.error("DISCORD_CLIENT_ID missing");
    return NextResponse.redirect(
      new URL("/dashboard?discord=misconfigured", process.env.NEXT_PUBLIC_SITE_URL ?? "https://realventure.io")
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify guilds.join",
  });

  const discordAuthUrl = `https://discord.com/oauth2/authorize?${params.toString()}`;
  return NextResponse.redirect(discordAuthUrl);
}

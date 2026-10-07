import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";
import { guestRedirectUri, guestSiteUrl } from "../site-url";

// Free Discord door, step 2. No Whop login, no session. Exchanges the code,
// reads the Discord user, and has the bot add them with the Guest role only.
// Only ever ADDS a member. Nothing here touches the member flow or its table.
export const dynamic = "force-dynamic";

const GUEST_ROLE_ID = process.env.DISCORD_GUEST_ROLE_ID ?? "1556852317322477598";
const GUEST_STATE_COOKIE = "rv_guest_state";
const GUEST_COOKIE = "rv_guest";
const SECURE = process.env.NODE_ENV === "production";

type GuestStatus = "joined" | "already" | "error";

// Every exit lands on /free (same site base as the start route) and clears
// the one-shot state cookie.
function redirectToOn(siteUrl: string, status: GuestStatus, opts: { joined?: boolean } = {}) {
  const response = NextResponse.redirect(new URL(`/free?discord=${status}`, siteUrl));
  response.cookies.set(GUEST_STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: SECURE,
    path: "/api/discord/guest",
    maxAge: 0,
  });
  if (opts.joined) {
    // Readable by the page (not httpOnly) so /free can show the joined card.
    response.cookies.set(GUEST_COOKIE, "1", {
      httpOnly: false,
      sameSite: "lax",
      secure: SECURE,
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}

type GuestRow = {
  discord_user_id: string;
  discord_username: string | null;
  discord_email: string | null;
  already_in_server: boolean;
  source: "free_page";
};

// A database failure must never block the redirect: log and carry on.
async function recordGuest(row: GuestRow) {
  try {
    const supabase = createAdminClient();
    const { error } = row.already_in_server
      ? // Already in the server: insert only if no row exists yet.
        await supabase
          .from("discord_guests")
          .upsert(row, { onConflict: "discord_user_id", ignoreDuplicates: true })
      : await supabase.from("discord_guests").upsert(row, { onConflict: "discord_user_id" });
    if (error) {
      console.error("[discord/guest/callback] discord_guests write failed", error.code ?? error.message);
    }
  } catch (err) {
    console.error("[discord/guest/callback] discord_guests write threw", err instanceof Error ? err.message : "unknown");
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieState = request.cookies.get(GUEST_STATE_COOKIE)?.value;
  const siteUrl = guestSiteUrl(request);
  const redirectTo = (status: GuestStatus, opts: { joined?: boolean } = {}) =>
    redirectToOn(siteUrl, status, opts);

  if (!code || !state || !cookieState || state !== cookieState) {
    return redirectTo("error");
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  // Same helper as the start route, so this matches the redirect_uri Discord saw.
  const redirectUri = guestRedirectUri(request);

  if (!clientId || !clientSecret || !botToken || !guildId) {
    console.error("[discord/guest/callback] Discord env vars missing");
    return redirectTo("error");
  }

  try {
    // Step 1: code -> user access token (same request shape as the member callback).
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenRes.ok) {
      console.error("[discord/guest/callback] token exchange failed", tokenRes.status);
      return redirectTo("error");
    }
    const tokenData = (await tokenRes.json()) as { access_token?: unknown };
    const userAccessToken = typeof tokenData.access_token === "string" ? tokenData.access_token : null;
    if (!userAccessToken) {
      return redirectTo("error");
    }

    // Step 2: who is this (id, username, email).
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${userAccessToken}` },
    });
    if (!userRes.ok) {
      console.error("[discord/guest/callback] user fetch failed", userRes.status);
      return redirectTo("error");
    }
    const userData = (await userRes.json()) as { id?: unknown; username?: unknown; email?: unknown };
    const discordUserId = typeof userData.id === "string" ? userData.id : null;
    if (!discordUserId) {
      return redirectTo("error");
    }
    const discordUsername = typeof userData.username === "string" && userData.username.length > 0 ? userData.username : null;
    const discordEmail = typeof userData.email === "string" && userData.email.length > 0 ? userData.email : null;

    // Step 3: the bot adds them with the Guest role only.
    const addRes = await fetch(`https://discord.com/api/guilds/${guildId}/members/${discordUserId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        access_token: userAccessToken,
        roles: [GUEST_ROLE_ID],
      }),
    });

    // 201 = fresh join, Guest role rode along in the body.
    if (addRes.status === 201) {
      await recordGuest({
        discord_user_id: discordUserId,
        discord_username: discordUsername,
        discord_email: discordEmail,
        already_in_server: false,
        source: "free_page",
      });
      return redirectTo("joined", { joined: true });
    }

    // 204 = already in the server. Change NOTHING on Discord: no Guest role,
    // no role of any kind. Just remember we saw them.
    if (addRes.status === 204) {
      await recordGuest({
        discord_user_id: discordUserId,
        discord_username: discordUsername,
        discord_email: discordEmail,
        already_in_server: true,
        source: "free_page",
      });
      return redirectTo("already", { joined: true });
    }

    console.error("[discord/guest/callback] guild add failed", addRes.status);
    return redirectTo("error");
  } catch (err) {
    console.error("[discord/guest/callback] threw", err instanceof Error ? err.message : "unknown");
    return redirectTo("error");
  }
}

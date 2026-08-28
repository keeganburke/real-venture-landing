import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../../lib/session";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://realventure.io";

function redirectWithStatus(status: string) {
  return NextResponse.redirect(new URL(`/dashboard?discord=${status}`, SITE_URL));
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  // User denied on Discord's OAuth screen
  if (error) {
    console.log("Discord OAuth denied:", error);
    return redirectWithStatus("cancelled");
  }
  if (!code) {
    return redirectWithStatus("invalid");
  }

  // Verify user is still authenticated on our side
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.redirect(new URL("/login", SITE_URL));
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  const roleId = process.env.DISCORD_ROLE_ID;
  const redirectUri = `${SITE_URL}/api/discord/callback`;

  if (!clientId || !clientSecret || !botToken || !guildId || !roleId) {
    console.error("Discord env vars missing");
    return redirectWithStatus("misconfigured");
  }

  try {
    // Step 1: Exchange code for user access token
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
      const errText = await tokenRes.text();
      console.error("Discord token exchange failed:", tokenRes.status, errText);
      return redirectWithStatus("token_failed");
    }

    const tokenData = await tokenRes.json();
    const userAccessToken = tokenData.access_token as string | undefined;
    if (!userAccessToken) {
      return redirectWithStatus("token_failed");
    }

    // Step 2: Get the Discord user ID
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${userAccessToken}` },
    });

    if (!userRes.ok) {
      const errText = await userRes.text();
      console.error("Discord user fetch failed:", userRes.status, errText);
      return redirectWithStatus("user_failed");
    }

    const userData = await userRes.json();
    const discordUserId = userData.id as string | undefined;
    if (!discordUserId) {
      return redirectWithStatus("user_failed");
    }

    // Step 3: Add user to the guild with the Community Member role.
    // PUT /guilds/{guild.id}/members/{user.id} either adds or updates the member.
    const addRes = await fetch(
      `https://discord.com/api/guilds/${guildId}/members/${discordUserId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          access_token: userAccessToken,
          roles: [roleId],
        }),
      }
    );

    // 201 = added successfully. 204 = already in server (Discord ignores body when member exists).
    // If already in server, we need a separate call to assign the role.
    if (addRes.status === 201) {
      return redirectWithStatus("connected");
    }

    if (addRes.status === 204) {
      // User is already in the server. Assign the role separately.
      const roleRes = await fetch(
        `https://discord.com/api/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`,
        {
          method: "PUT",
          headers: { Authorization: `Bot ${botToken}` },
        }
      );

      if (!roleRes.ok && roleRes.status !== 204) {
        const errText = await roleRes.text();
        console.error("Role assignment failed:", roleRes.status, errText);
        return redirectWithStatus("role_failed");
      }

      return redirectWithStatus("already_in_server");
    }

    const errText = await addRes.text();
    console.error("Discord guild add failed:", addRes.status, errText);
    return redirectWithStatus("add_failed");
  } catch (err) {
    console.error("Discord callback error:", err);
    return redirectWithStatus("error");
  }
}

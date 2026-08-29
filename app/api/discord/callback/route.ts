import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../../lib/session";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://realventure.io";

function redirectWithStatus(status: string) {
  return NextResponse.redirect(new URL(`/dashboard?discord=${status}`, SITE_URL));
}

const ROLE_IDS = {
  BASE: process.env.DISCORD_BASE_ROLE_ID,
  PRO: process.env.DISCORD_PRO_ROLE_ID,
  FALLBACK: process.env.DISCORD_ROLE_ID,
};

// Same hosted plan ids as the landing PLANS config and the profile tier
// check (app/api/profile/get); duplicated here on purpose, that module
// keeps its logic private.
const PLAN_TIERS: Record<string, "Base" | "Pro"> = {
  plan_2NqC2WJzV87QY: "Base",
  plan_J8vFpCWME75W3: "Pro",
  plan_SIYHeHyFp1dbR: "Pro",   // legacy $75/mo plan
  plan_SGscR3JhdTtKh: "Base",  // legacy $1 entry plan
};

// Best-effort tier from the caller's Whop memberships. Any failure returns
// nulls so the caller falls back to the original single role: no one is
// ever left roleless because tier detection hiccuped.
async function getWhopTier(
  whopUserId: string
): Promise<{ tier: "Base" | "Pro" | null; planId: string | null }> {
  const productId = process.env.WHOP_PRODUCT_ID;
  const companyId = process.env.WHOP_COMPANY_ID;
  if (!productId || !companyId) return { tier: null, planId: null };

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
    if (!res.ok) return { tier: null, planId: null };

    const page = await res.json();
    const rows: Record<string, unknown>[] = Array.isArray(page?.data) ? page.data : [];
    let tier: "Base" | "Pro" | null = null;
    let planId: string | null = null;
    for (const row of rows) {
      const rowPlanId =
        typeof row.plan_id === "string"
          ? row.plan_id
          : typeof (row.plan as Record<string, unknown> | undefined)?.id === "string"
            ? ((row.plan as Record<string, unknown>).id as string)
            : null;
      const rowTier = rowPlanId ? PLAN_TIERS[rowPlanId] : undefined;
      // Pro wins when both memberships exist.
      if (rowTier === "Pro") {
        tier = "Pro";
        planId = rowPlanId;
      } else if (rowTier === "Base" && tier !== "Pro") {
        tier = "Base";
        planId = rowPlanId;
      }
    }
    return { tier, planId };
  } catch {
    return { tier: null, planId: null };
  }
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
  const redirectUri = `${SITE_URL}/api/discord/callback`;

  if (!ROLE_IDS.FALLBACK) {
    console.error("[discord/callback] Missing DISCORD_ROLE_ID");
    return redirectWithStatus("misconfigured");
  }
  if (!clientId || !clientSecret || !botToken || !guildId) {
    console.error("Discord env vars missing");
    return redirectWithStatus("misconfigured");
  }

  // Tier-split role: Pro and Base get their own role when configured;
  // unknown plan, missing membership, Whop API error, or missing tier env
  // all fall back to the original single role.
  const { tier, planId } = await getWhopTier(session.whopUserId);
  let roleId = ROLE_IDS.FALLBACK;
  let resolvedTier = "fallback";
  if (tier === "Pro" && ROLE_IDS.PRO) {
    roleId = ROLE_IDS.PRO;
    resolvedTier = "Pro";
  } else if (tier === "Base" && ROLE_IDS.BASE) {
    roleId = ROLE_IDS.BASE;
    resolvedTier = "Base";
  }
  console.log("[discord/callback] Assigning role", {
    whopUserId: session.whopUserId,
    planId,
    roleId,
    tier: resolvedTier,
  });

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
      // Fresh join: drop them straight into the server they just entered.
      return NextResponse.redirect(`https://discord.com/channels/${guildId}`);
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

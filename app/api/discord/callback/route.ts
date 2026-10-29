import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../../lib/session";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { isWhopUserLive, tierRoleIds } from "../../../../lib/discord-kick";
import { rowOwner, rowProduct, whopAuthHeaders } from "../../whop/whop-membership";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://realventure.io";

function redirectWithStatus(status: string) {
  return NextResponse.redirect(new URL(`/dashboard?discord=${status}`, SITE_URL));
}

type Tier = "Base" | "Pro" | "Ultra";

// Explicit plan -> tier map (same hosted plan ids as the landing PLANS config
// and the profile tier check, app/api/profile/get; duplicated here on
// purpose, that module keeps its logic private). A plan missing here gets
// Base plus a warning, never Pro.
const PLAN_TIERS: Record<string, Tier> = {
  plan_2NqC2WJzV87QY: "Base",
  plan_SGscR3JhdTtKh: "Base",  // legacy $1 entry plan
  plan_J8vFpCWME75W3: "Pro",
  plan_9nyRNbuhQF0pk: "Pro",   // Pro 3-month, $130
  plan_tfYMBwmuOwuB0: "Pro",   // Pro 6-month, $250
  plan_SIYHeHyFp1dbR: "Pro",   // legacy $75/mo plan
  plan_mjpuBNS3KJqmw: "Ultra", // Ultra monthly, $249
  plan_MVEXluUMjBlxL: "Ultra", // Ultra 3-month, $600
  plan_8CGnZkflAnXOe: "Ultra", // Ultra 6-month, $1,000
};

// Multi-membership priority: Ultra > Pro > Base.
const TIER_RANK: Record<Tier, number> = { Ultra: 3, Pro: 2, Base: 1 };

// Why the tier came back the way it did.
//   ok             tier is Base, Pro or Ultra from PLAN_TIERS
//   unknown_plan   at least one qualifying membership, but no plan id is in
//                  PLAN_TIERS: tier is Base, a warning is logged
//   no_membership  Whop answered 2xx, owner-checked, zero qualifying rows: refused
//   error          missing config, non-2xx, untrusted response or a throw: refused
//                  (never a fallback role)
type TierReason = "ok" | "unknown_plan" | "no_membership" | "error";

// Statuses that count as "has a membership". past_due is included on purpose
// (a failed renewal in its grace window keeps access). The tier is picked
// from active / trialing / completed rows first; a past_due row only chooses
// the tier when no other row does.
const EXISTENCE_STATUSES: ReadonlySet<string> = new Set(["active", "trialing", "completed", "past_due"]);
const TIER_STATUSES: ReadonlySet<string> = new Set(["active", "trialing", "completed"]);

function rowPlanId(row: Record<string, unknown>): string | null {
  if (typeof row.plan_id === "string" && row.plan_id.length > 0) return row.plan_id;
  const plan = row.plan as Record<string, unknown> | undefined;
  return plan && typeof plan.id === "string" && plan.id.length > 0 ? plan.id : null;
}

// Highest mapped tier among rows (Ultra > Pro > Base); null when none maps.
function highestTier(rows: Record<string, unknown>[]): { tier: Tier; planId: string } | null {
  let best: { tier: Tier; planId: string } | null = null;
  for (const row of rows) {
    const planId = rowPlanId(row);
    const tier = planId ? PLAN_TIERS[planId] : undefined;
    if (tier && planId && TIER_RANK[tier] > (best ? TIER_RANK[best.tier] : 0)) best = { tier, planId };
  }
  return best;
}

// Tier from the caller's own Whop memberships on WHOP_PRODUCT_ID.
// SINGULAR filters, pinned version, owner-checked (same shape as
// app/api/whop/whop-membership.ts): the plural user_ids / product_ids /
// statuses filters are ignored by the key's API version and returned the
// newest memberships in the whole company, which is how Base payers were
// handed the Pro role. Status and product are filtered locally. No fallback:
// "error" and "no_membership" are both refused by the handler.
async function getWhopTier(
  whopUserId: string
): Promise<{ tier: Tier | null; planId: string | null; reason: TierReason }> {
  const productId = process.env.WHOP_PRODUCT_ID;
  const companyId = process.env.WHOP_COMPANY_ID;
  if (!productId || !companyId) return { tier: null, planId: null, reason: "error" };

  try {
    const params = new URLSearchParams({
      company_id: companyId,
      user_id: whopUserId,
      product_id: productId,
      first: "50",
    });
    const res = await fetch(`https://api.whop.com/api/v1/memberships?${params.toString()}`, {
      headers: whopAuthHeaders(),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[discord/callback] memberships read non-2xx", res.status);
      return { tier: null, planId: null, reason: "error" };
    }

    const page = await res.json();
    const all: Record<string, unknown>[] = (Array.isArray(page?.data) ? page.data : []).filter(
      (m: unknown): m is Record<string, unknown> => !!m && typeof m === "object"
    );
    // A row for another user means the filter was ignored: never pick a role
    // from a stranger's membership.
    if (all.some((m) => rowOwner(m) !== null && rowOwner(m) !== whopUserId)) {
      console.error("[discord/callback] foreign user in memberships read (user_id filter ignored)");
      return { tier: null, planId: null, reason: "error" };
    }
    const rows = all.filter((m) => {
      const product = rowProduct(m);
      if (product !== null && product !== productId) return false;
      return typeof m.status === "string" && EXISTENCE_STATUSES.has(m.status);
    });
    if (rows.length === 0) return { tier: null, planId: null, reason: "no_membership" };

    const fromCurrent = highestTier(rows.filter((m) => TIER_STATUSES.has(m.status as string)));
    if (fromCurrent) return { ...fromCurrent, reason: "ok" };
    const fromPastDue = highestTier(rows.filter((m) => m.status === "past_due"));
    if (fromPastDue) return { ...fromPastDue, reason: "ok" };

    // Qualifying membership on a plan we do not map: Base, logged. Never Pro.
    const plans = rows.map((m) => rowPlanId(m) ?? "none");
    console.warn("[discord/callback] unmapped plan, granting Base", {
      whopUserId,
      plans,
      statuses: rows.map((m) => m.status),
    });
    return { tier: "Base", planId: plans[0] ?? null, reason: "unknown_plan" };
  } catch (err) {
    console.error("[discord/callback] memberships read threw", err instanceof Error ? err.message : "unknown");
    return { tier: null, planId: null, reason: "error" };
  }
}

// Records the Whop -> Discord binding once a role has actually been granted.
// Failure is logged only: the member already has their role, and the Phase 2
// backfill re-derives missing rows. tier is the Whop-derived tier, role_id is
// the Discord role that was really assigned.
async function recordConnection(args: {
  whopUserId: string;
  discordUserId: string;
  // Discord username (the unique handle, not global_name) for the admin
  // table (migration 019). Null if Discord did not return one.
  discordUsername: string | null;
  tier: Tier;
  roleId: string;
}) {
  try {
    const supabase = createAdminClient();
    const now = new Date().toISOString();
    const { error: dbError } = await supabase.from("discord_connections").upsert(
      {
        whop_user_id: args.whopUserId,
        discord_user_id: args.discordUserId,
        discord_username: args.discordUsername,
        tier: args.tier,
        role_id: args.roleId,
        connected_at: now,
        updated_at: now,
      },
      { onConflict: "whop_user_id" }
    );
    if (dbError) {
      console.error("[discord/callback] discord_connections upsert failed", dbError.message);
    }
  } catch (err) {
    console.error("[discord/callback] discord_connections upsert threw", err);
  }
}

type BindingCheck =
  | { kind: "ok" }
  | { kind: "conflict"; code: "already_bound_different_discord" | "discord_owned_by_another_whop" }
  // The Discord id belongs to a different Whop user whose memberships are all
  // over (rebuy under a new Whop account after a kick): the link may move.
  | { kind: "relink"; fromWhopUserId: string };

// 1:1 enforcement, checked BEFORE any Discord mutation. "ok" for a first bind
// or the same pair reconnecting, "conflict" with the discord_error code to
// redirect with, or "relink" (see BindingCheck). A lookup failure allows the
// bind: the DB unique constraints (migration 011) are the hard backstop, and a
// paying member must never be locked out because a read hiccuped.
async function findBindingConflict(whopUserId: string, discordUserId: string): Promise<BindingCheck> {
  try {
    const supabase = createAdminClient();

    // Check A: is this Whop user already bound to a DIFFERENT Discord?
    const { data: existingByWhop, error: errA } = await supabase
      .from("discord_connections")
      .select("discord_user_id")
      .eq("whop_user_id", whopUserId)
      .maybeSingle();
    if (errA) console.error("[discord/callback] conflict check A failed", errA.message);
    if (existingByWhop && existingByWhop.discord_user_id !== discordUserId) {
      return { kind: "conflict", code: "already_bound_different_discord" };
    }

    // Check B: is this Discord user already bound to a DIFFERENT Whop?
    const { data: existingByDiscord, error: errB } = await supabase
      .from("discord_connections")
      .select("whop_user_id")
      .eq("discord_user_id", discordUserId)
      .maybeSingle();
    if (errB) console.error("[discord/callback] conflict check B failed", errB.message);
    if (existingByDiscord && existingByDiscord.whop_user_id !== whopUserId) {
      const oldWhopUserId = existingByDiscord.whop_user_id as string;
      // Relink is allowed ONLY when the old Whop user has no live membership
      // on any product (the caller already proved the new one does). A read
      // failure or any remaining access (live, paused, paid time left) keeps
      // the refusal.
      const old = await isWhopUserLive(oldWhopUserId);
      if (!old.ok) {
        console.error("[discord/callback] relink refused, old Whop user read failed", { discordUserId, oldWhopUserId, error: old.error });
        return { kind: "conflict", code: "discord_owned_by_another_whop" };
      }
      if (old.live || old.paused || old.paidTimeLeft) {
        console.log("[discord/callback] relink refused, old Whop user still has access", { discordUserId, oldWhopUserId, statuses: old.statuses });
        return { kind: "conflict", code: "discord_owned_by_another_whop" };
      }
      return { kind: "relink", fromWhopUserId: oldWhopUserId };
    }

    return { kind: "ok" };
  } catch (err) {
    console.error("[discord/callback] conflict check threw", err);
    return { kind: "ok" };
  }
}

// Relink: drop the stale row BEFORE touching Discord, so the upsert below
// cannot collide on discord_user_id and so the stale link to the ended Whop
// account can never feed the sweep again. If Discord then fails, the member
// simply has no link (never kicked) and can reconnect. Deletes only the exact
// (old whop, this discord) pair.
async function releaseStaleLink(fromWhopUserId: string, discordUserId: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("discord_connections")
      .delete()
      .eq("whop_user_id", fromWhopUserId)
      .eq("discord_user_id", discordUserId);
    if (error) {
      console.error("[discord/callback] relink: stale row delete failed", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[discord/callback] relink: stale row delete threw", err);
    return false;
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

  if (!clientId || !clientSecret || !botToken || !guildId) {
    console.error("Discord env vars missing");
    return redirectWithStatus("misconfigured");
  }

  // Tier-split roles: Ultra gets Ultra Member AND Pro Member (Ultra includes
  // everything in Pro); Pro and Base get their own role. Role ids come from
  // lib/discord-kick (env first, snapshot literals as fallbacks), the same
  // set the sweep treats as member roles. roleId is the primary role recorded
  // in discord_connections; roleIds is everything granted.
  // Roles are only ever ADDED here; removal is the sweep's job.
  const { tier, planId, reason } = await getWhopTier(session.whopUserId);

  // Refused outright, before any Discord token exchange, guild add, role or
  // discord_connections row: no qualifying membership on the product, or a
  // Whop read that failed or could not be trusted. There is no fallback role.
  if (reason === "no_membership") {
    console.log(`[discord/callback] refused: no membership, whop user ${session.whopUserId}`);
    return redirectWithStatus("no_membership");
  }
  if (reason === "error" || tier === null) {
    console.error(`[discord/callback] refused: membership check unavailable, whop user ${session.whopUserId}`);
    return redirectWithStatus("whop_unavailable");
  }

  const tierRoles = tierRoleIds();
  let roleId: string;
  let roleIds: string[];
  if (tier === "Ultra") {
    roleId = tierRoles.ultra;
    roleIds = [tierRoles.ultra, tierRoles.pro];
  } else if (tier === "Pro") {
    roleId = tierRoles.pro;
    roleIds = [tierRoles.pro];
  } else {
    roleId = tierRoles.base;
    roleIds = [tierRoles.base];
  }
  console.log("[discord/callback] Assigning roles", {
    whopUserId: session.whopUserId,
    planId,
    roleId,
    roleIds,
    tier,
    reason,
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
    const discordUsername: string | null =
      typeof userData.username === "string" && userData.username.length > 0
        ? userData.username
        : null;

    // Enforce 1:1 before assigning anything. On conflict: no role, no DB row.
    const binding = await findBindingConflict(session.whopUserId, discordUserId);
    if (binding.kind === "conflict") {
      console.error("[discord/callback] binding conflict", {
        whopUserId: session.whopUserId,
        discordUserId,
        conflict: binding.code,
      });
      return NextResponse.redirect(new URL(`/dashboard?discord_error=${binding.code}`, request.url));
    }
    if (binding.kind === "relink") {
      const released = await releaseStaleLink(binding.fromWhopUserId, discordUserId);
      if (!released) {
        return NextResponse.redirect(new URL(`/dashboard?discord_error=discord_owned_by_another_whop`, request.url));
      }
      console.log("[discord/callback] relink: moved Discord link to a new Whop user", {
        discordUserId,
        fromWhopUserId: binding.fromWhopUserId,
        toWhopUserId: session.whopUserId,
        tier,
        planId,
      });
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
          roles: roleIds,
        }),
      }
    );

    // 201 = added successfully. 204 = already in server (Discord ignores body when member exists).
    // If already in server, we need a separate call to assign the role.
    if (addRes.status === 201) {
      // Fresh join: the role rode along in the PUT body, so the grant succeeded.
      await recordConnection({ whopUserId: session.whopUserId, discordUserId, discordUsername, tier, roleId });
      // Drop them straight into the server they just entered.
      return NextResponse.redirect(`https://discord.com/channels/${guildId}`);
    }

    if (addRes.status === 204) {
      // User is already in the server. Assign each role separately; a failure
      // on one role is logged and the rest are still attempted. The primary
      // role failing is the only outcome reported as role_failed.
      let primaryFailed = false;
      for (const id of roleIds) {
        const roleRes = await fetch(
          `https://discord.com/api/guilds/${guildId}/members/${discordUserId}/roles/${id}`,
          {
            method: "PUT",
            headers: { Authorization: `Bot ${botToken}` },
          }
        );

        if (!roleRes.ok && roleRes.status !== 204) {
          const errText = await roleRes.text();
          console.error("Role assignment failed:", id, roleRes.status, errText);
          if (id === roleId) primaryFailed = true;
        }
      }
      if (primaryFailed) return redirectWithStatus("role_failed");

      await recordConnection({ whopUserId: session.whopUserId, discordUserId, discordUsername, tier, roleId });
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

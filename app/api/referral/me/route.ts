import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../../lib/session";
import { createAdminClient } from "../../../../lib/supabase/server";
import {
  createOrFindAffiliate,
  createStandardOverride,
  getAffiliate,
  getWhopUsername,
  listOverrides,
  WhopAffiliateError,
} from "../../../../lib/whop-affiliates";

// GET /api/referral/me
// Sets up (idempotently) the logged-in member's Whop affiliate record with a
// 50% first-payment commission on every purchasable plan, then returns their
// realventure.io referral link plus stats. Only ever ADDS overrides; existing
// ones are never modified or deleted.

export const dynamic = "force-dynamic";

const REFERRAL_LINK_BASE = "https://realventure.io/?a=";

// Purchasable plans on prod_6pHvfQMe6poD4. Legacy plans are deliberately absent.
const REFERRAL_PLAN_IDS = [
  "plan_2NqC2WJzV87QY", // Base $19.99/mo
  "plan_J8vFpCWME75W3", // Pro $49.99/mo
  "plan_9nyRNbuhQF0pk", // Pro $130/3mo
  "plan_tfYMBwmuOwuB0", // Pro $250/6mo
  "plan_mjpuBNS3KJqmw", // Ultra $249/mo
  "plan_MVEXluUMjBlxL", // Ultra $600/3mo
  "plan_8CGnZkflAnXOe", // Ultra $1,000/6mo
] as const;

const COMMISSION = {
  commission_value: 50,
  commission_type: "percentage",
  applies_to_payments: "first_payment",
} as const;

type ReferralResponse =
  | { status: "under_18" }
  | { status: "no_username" }
  | { status: "error" }
  | { status: "ok"; link: string; referrals: number; earnings_usd: string; active_referred: number };

// Best-effort per-member cache so a dashboard reload does not re-hit Whop.
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; body: ReferralResponse }>();

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const whopUserId = session.whopUserId;

  const cached = cache.get(whopUserId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json(cached.body);
  }

  const supabase = createAdminClient();
  const { data: profile, error } = await supabase
    .from("member_profiles")
    .select("whop_username, intake_age")
    .eq("whop_user_id", whopUserId)
    .maybeSingle();
  if (error) {
    console.error("[referral/me] member_profiles read failed", { whopUserId, message: error.message });
    return NextResponse.json({ status: "error" } satisfies ReferralResponse);
  }

  const age = typeof profile?.intake_age === "number" ? profile.intake_age : null;
  if (age !== null && age < 18) {
    return NextResponse.json({ status: "under_18" } satisfies ReferralResponse);
  }

  // Username: prefer the stored one; if the login callback left it null, look it
  // up on Whop (GET /users/{id}) and stamp only that column on this member's row.
  let username = typeof profile?.whop_username === "string" ? profile.whop_username.trim() : "";
  if (!username) {
    const fromWhop = await getWhopUsername(whopUserId);
    if (!fromWhop) {
      // Not cached: the next request retries the lookup.
      return NextResponse.json({ status: "no_username" } satisfies ReferralResponse);
    }
    username = fromWhop;
    const { error: saveError } = await supabase
      .from("member_profiles")
      .update({ whop_username: username })
      .eq("whop_user_id", whopUserId);
    if (saveError) {
      // Non-fatal: we still have the username for this response.
      console.error("[referral/me] whop_username save failed", { whopUserId, message: saveError.message });
    } else {
      console.log("[referral/me] filled missing whop_username from Whop", { whopUserId });
    }
  }

  const companyId = process.env.WHOP_COMPANY_ID;
  if (!companyId) {
    console.error("[referral/me] WHOP_COMPANY_ID unset");
    return NextResponse.json({ status: "error" } satisfies ReferralResponse);
  }

  try {
    // a. Create or find the affiliate (Whop treats this as idempotent).
    const affiliate = await createOrFindAffiliate(companyId, whopUserId);

    // b/c. Add the missing standard overrides only. Never touch existing ones.
    const existing = await listOverrides(affiliate.id);
    const byPlan = new Map<string, (typeof existing)[number]>();
    for (const o of existing) {
      if (o.override_type === "standard" && o.plan_id) byPlan.set(o.plan_id, o);
    }
    for (const planId of REFERRAL_PLAN_IDS) {
      const have = byPlan.get(planId);
      if (have) {
        const matches =
          have.commission_value === COMMISSION.commission_value &&
          have.commission_type === COMMISSION.commission_type &&
          have.applies_to_payments === COMMISSION.applies_to_payments;
        if (!matches) {
          console.warn("[referral/me] existing override differs from target; left untouched", {
            whopUserId,
            affiliateId: affiliate.id,
            overrideId: have.id,
            planId,
            commission_value: have.commission_value,
            commission_type: have.commission_type,
            applies_to_payments: have.applies_to_payments,
          });
        }
        continue;
      }
      await createStandardOverride(affiliate.id, { plan_id: planId, ...COMMISSION });
      console.log("[referral/me] created override", { whopUserId, affiliateId: affiliate.id, planId });
    }

    // d. Fresh stats.
    const fresh = await getAffiliate(affiliate.id);

    const body: ReferralResponse = {
      status: "ok",
      link: `${REFERRAL_LINK_BASE}${encodeURIComponent(username)}`,
      referrals: Number(fresh.total_referrals_count ?? 0),
      earnings_usd: String(fresh.total_referral_earnings_usd ?? "$0.00"),
      active_referred: Number(fresh.active_members_count ?? 0),
    };
    cache.set(whopUserId, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch (err) {
    // Server-side detail only; the client just sees status "error".
    if (err instanceof WhopAffiliateError) {
      console.error("[referral/me] Whop call failed", {
        whopUserId,
        op: err.message,
        httpStatus: err.status,
        body: err.body.slice(0, 500),
      });
    } else {
      console.error("[referral/me] unexpected failure", { whopUserId, err: err instanceof Error ? err.message : String(err) });
    }
    return NextResponse.json({ status: "error" } satisfies ReferralResponse);
  }
}

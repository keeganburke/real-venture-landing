// Thin fetch helpers for Whop's affiliate endpoints (no SDK in this repo;
// same plain fetch + Bearer pattern as lib/whop-member*.ts).
//
// Paths and body fields confirmed from @whop/sdk 0.0.39 compiled sources
// (resources/affiliates/affiliates.js, resources/affiliates/overrides.js):
//   POST /affiliates                       { company_id, user_identifier }   creates or finds
//   GET  /affiliates/{id}
//   GET  /affiliates/{id}/overrides        cursor page { data, page_info }
//   POST /affiliates/{id}/overrides        { override_type, plan_id, commission_value,
//                                            commission_type, applies_to_payments }
// Nothing here updates or deletes anything.

const WHOP_API_BASE = "https://api.whop.com/api/v1";

export type WhopAffiliate = {
  id: string;
  status: string | null;
  total_referrals_count: number;
  total_referral_earnings_usd: string;
  active_members_count: number;
  user: { id: string; name: string | null; username: string | null } | null;
};

export type WhopAffiliateOverride = {
  id: string;
  override_type: "standard" | "rev_share";
  plan_id: string | null;
  product_id: string | null;
  commission_type: "percentage" | "flat_fee";
  commission_value: number;
  applies_to_payments: string | null; // "first_payment" on everything we create
  checkout_direct_link: string | null;
  total_referral_earnings_usd: number;
};

export type StandardOverrideInput = {
  plan_id: string;
  commission_value: number;
  commission_type: "percentage" | "flat_fee";
  applies_to_payments: "first_payment";
};

export class WhopAffiliateError extends Error {
  status: number;
  body: string;
  constructor(op: string, status: number, body: string) {
    super(`[whop-affiliates] ${op} failed: HTTP ${status}`);
    this.name = "WhopAffiliateError";
    this.status = status;
    this.body = body;
  }
}

function apiKey(): string {
  const key = process.env.WHOP_API_KEY;
  if (!key) throw new WhopAffiliateError("config", 0, "WHOP_API_KEY unset");
  return key;
}

async function whopFetch<T>(op: string, path: string, init?: { method?: "GET" | "POST"; body?: unknown }): Promise<T> {
  const res = await fetch(`${WHOP_API_BASE}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      Accept: "application/json",
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new WhopAffiliateError(op, res.status, text.slice(0, 2000));
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new WhopAffiliateError(op, res.status, "non-JSON response");
  }
}

/** POST /affiliates. Idempotent on Whop's side: creates or returns the existing record. */
export async function createOrFindAffiliate(companyId: string, userIdentifier: string): Promise<WhopAffiliate> {
  return whopFetch<WhopAffiliate>("create affiliate", "/affiliates", {
    method: "POST",
    body: { company_id: companyId, user_identifier: userIdentifier },
  });
}

/** GET /affiliates/{id} */
export async function getAffiliate(affiliateId: string): Promise<WhopAffiliate> {
  return whopFetch<WhopAffiliate>("get affiliate", `/affiliates/${encodeURIComponent(affiliateId)}`);
}

/** GET /affiliates/{id}/overrides, following page_info.end_cursor until has_next_page is false. */
export async function listOverrides(affiliateId: string): Promise<WhopAffiliateOverride[]> {
  const out: WhopAffiliateOverride[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({ first: "100" });
    if (cursor) params.set("after", cursor);
    const res: { data?: WhopAffiliateOverride[]; page_info?: { end_cursor?: string | null; has_next_page?: boolean } } =
      await whopFetch("list overrides", `/affiliates/${encodeURIComponent(affiliateId)}/overrides?${params}`);
    out.push(...(res.data ?? []));
    if (!res.page_info?.has_next_page || !res.page_info.end_cursor) break;
    cursor = res.page_info.end_cursor;
  }
  return out;
}

/** POST /affiliates/{id}/overrides with override_type "standard" (per-plan commission). */
export async function createStandardOverride(
  affiliateId: string,
  input: StandardOverrideInput,
): Promise<WhopAffiliateOverride> {
  return whopFetch<WhopAffiliateOverride>("create override", `/affiliates/${encodeURIComponent(affiliateId)}/overrides`, {
    method: "POST",
    body: { override_type: "standard", ...input },
  });
}

/**
 * GET /users/{id} -> the user's public Whop username, or null when missing or on
 * any error (logged server-side). Confirmed from @whop/sdk 0.0.39
 * resources/users.js: retrieve(id) -> this._client.get(`/users/${id}`).
 */
export async function getWhopUsername(userId: string): Promise<string | null> {
  try {
    const user = await whopFetch<{ id?: string; username?: unknown }>(
      "get user",
      `/users/${encodeURIComponent(userId)}`,
    );
    const username = typeof user.username === "string" ? user.username.trim() : "";
    return username.length > 0 ? username : null;
  } catch (err) {
    console.error("[whop-affiliates] getWhopUsername failed", {
      userId,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

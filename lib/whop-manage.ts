import { WHOP_API_VERSION_DATE } from "../app/api/whop/whop-membership";

/**
 * The key for Whop WRITES that need member:manage (pause, resume). NOT the
 * general WHOP_API_KEY.
 *
 * WHOP_API_KEY is provisioned on Whop API version 2026-09-22, whose permission
 * vocabulary is membership:cancel / membership:transfer. There is no
 * member:manage scope in that model, so the v1 pause endpoint rejected it with
 * a 403 that no amount of granting could fix. WHOP_MANAGE_API_KEY is a separate
 * company key on 2026-10-15-1 with the Owner role.
 *
 * It deliberately does NOT fall back to WHOP_API_KEY: falling back would
 * silently reproduce the exact 403 this exists to avoid, and a loud config
 * error is far easier to read than a permissions one. Only two callers:
 * app/api/whop/pause/route.ts and lib/pause-resume.ts.
 */
export function requireWhopManageApiKey(): string {
  const key = process.env.WHOP_MANAGE_API_KEY;
  if (!key || key.trim() === "") {
    throw new Error("WHOP_MANAGE_API_KEY is unset or empty");
  }
  return key;
}

export function manageAuthHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${requireWhopManageApiKey()}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "Api-Version-Date": WHOP_API_VERSION_DATE,
  };
}

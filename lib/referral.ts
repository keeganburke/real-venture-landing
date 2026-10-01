// Referral capture for realventure.io/?a=<whop_username>.
//
// A member shares a link carrying their Whop username in ?a=. The landing page
// stores it in a first-party cookie so a friend who comes back later still
// credits the referrer, and passes it to the Whop checkout embed as
// affiliateCode (Whop appends it to its iframe URL as ?a=). Client-side only.

export const REFERRAL_COOKIE_NAME = "rv_ref";

const MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days
const CODE_PATTERN = /^[a-z0-9_.-]{1,40}$/;

/** Trim + lowercase; only [a-z0-9_.-], 1-40 chars. Anything else -> null. */
export function sanitizeReferralCode(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toLowerCase();
  return CODE_PATTERN.test(code) ? code : null;
}

/** Read the stored referral code from the rv_ref cookie (sanitized), or null. */
export function getReferralCode(): string | null {
  try {
    if (typeof document === "undefined") return null;
    const prefix = `${REFERRAL_COOKIE_NAME}=`;
    for (const part of document.cookie.split(";")) {
      const entry = part.trim();
      if (entry.startsWith(prefix)) {
        return sanitizeReferralCode(decodeURIComponent(entry.slice(prefix.length)));
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Store the code in rv_ref for 30 days. Last click wins. Never throws. */
export function setReferralCode(code: string): void {
  try {
    if (typeof document === "undefined") return;
    const clean = sanitizeReferralCode(code);
    if (!clean) return;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie =
      `${REFERRAL_COOKIE_NAME}=${encodeURIComponent(clean)}; path=/; max-age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  } catch {
    // Cookie writes can fail in locked-down browsers; referral capture is best-effort.
  }
}

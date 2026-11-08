// Client-safe helpers for the /free page's Discord door. No Buffer / Node
// built-ins, so this is cheap to pull into the LandingClient bundle.

// SMS joins must not see the "we're calling you" banner — nobody is calling an
// SMS lead. Exact match only: a stray/forged src never hides it.
export function isSmsSrc(src: string | null | undefined): boolean {
  return src === 'sms'
}

// The "Try again" button after a cancel/error re-enters the flow through
// /discord (not the raw OAuth start) so src and cid are re-attached to state.
export function discordEntryHref(
  attr: { src?: string | null; cid?: string | null } = {},
): string {
  const out = new URLSearchParams()
  const src = attr.src?.trim().slice(0, 100)
  if (src) out.set('src', src)
  const cid = attr.cid?.trim().slice(0, 100)
  if (cid) out.set('cid', cid)
  const qs = out.toString()
  return qs ? `/discord?${qs}` : '/discord'
}

// GHL contact ids are alphanumeric, 15-30 chars. A /d/[cid] value that does not
// match is treated as missing, so a bad or guessed link never carries a junk id
// into GHL — the alias still starts the SMS flow, just without a cid.
export function isValidGhlContactId(cid: string | null | undefined): boolean {
  return typeof cid === "string" && /^[A-Za-z0-9]{15,30}$/.test(cid)
}

// Where the short /d/[cid] alias sends the browser: exactly
// /discord?src=sms&cid=<cid> for a valid id, falling back to /discord?src=sms
// when the id is missing or malformed. /discord itself is unchanged.
export function dAliasTarget(cid: string | null | undefined): string {
  return discordEntryHref({ src: "sms", cid: isValidGhlContactId(cid) ? cid : null })
}

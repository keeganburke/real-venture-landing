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

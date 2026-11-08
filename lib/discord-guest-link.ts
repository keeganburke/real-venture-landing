// Plumbing for the free Discord door's attribution pass-through.
//
// The /discord entry point and the guest OAuth flow need to carry two values
// from the ad click all the way to the callback: `src` (traffic source label)
// and `cid` (the GHL contact id). OAuth only gives us one opaque round-trip
// field — `state` — which already doubles as the CSRF token. So we pack the
// CSRF nonce plus src/cid into `state`, and still store the whole string in the
// one-shot cookie, so the existing `state === cookie` check is unchanged.

export type GuestState = { nonce: string; src: string | null; cid: string | null }

// A crafted /discord URL could stuff huge values into src/cid, which would
// bloat the state, the OAuth URL, and the cookie. Trim and cap to 100 chars;
// empty becomes null.
function clean(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = String(value).trim().slice(0, 100)
  return trimmed.length > 0 ? trimmed : null
}

export function encodeGuestState(input: {
  nonce: string
  src?: string | null
  cid?: string | null
}): string {
  const payload: { n: string; s?: string; c?: string } = { n: input.nonce }
  const src = clean(input.src)
  if (src) payload.s = src
  const cid = clean(input.cid)
  if (cid) payload.c = cid
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

export function decodeGuestState(state: string | null | undefined): GuestState | null {
  if (!state) return null
  try {
    const json = Buffer.from(state, 'base64url').toString('utf8')
    const obj: unknown = JSON.parse(json)
    if (!obj || typeof obj !== 'object') return null
    const rec = obj as Record<string, unknown>
    if (typeof rec.n !== 'string' || rec.n.length === 0) return null
    return {
      nonce: rec.n,
      src: typeof rec.s === 'string' ? rec.s : null,
      cid: typeof rec.c === 'string' ? rec.c : null,
    }
  } catch {
    return null
  }
}

// The /discord route forwards ONLY the two known attribution params to the
// guest OAuth start route; everything else (utm_*, etc.) is dropped.
export function guestStartPath(search: URLSearchParams): string {
  const out = new URLSearchParams()
  const src = clean(search.get('src'))
  if (src) out.set('src', src)
  const cid = clean(search.get('cid'))
  if (cid) out.set('cid', cid)
  const qs = out.toString()
  return qs ? `/api/discord/guest/start?${qs}` : '/api/discord/guest/start'
}

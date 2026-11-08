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

// Where the guest callback sends the browser. `cancelled`/`error` carry src+cid
// so /free can render a "Try again" button that re-enters /discord with the
// same attribution; `joined`/`already` carry src so /free can hide the call
// banner for SMS joins.
export type FreeDiscordStatus = 'joined' | 'already' | 'error' | 'cancelled'

export function freeRedirectPath(
  status: FreeDiscordStatus,
  attr: { src?: string | null; cid?: string | null } = {},
): string {
  const out = new URLSearchParams({ discord: status })
  const src = clean(attr.src)
  if (src) out.set('src', src)
  const cid = clean(attr.cid)
  if (cid) out.set('cid', cid)
  return `/free?${out.toString()}`
}

// Decide what to do before any Discord call, from the callback's query:
//  - a Discord `error` param (user hit Cancel = access_denied, or any OAuth
//    error) -> 'cancelled' (friendly retry, never a raw error page)
//  - no code, or a state that fails the CSRF match -> 'error'
//  - a real code with a matching state -> 'proceed'
export function preAuthOutcome(input: {
  oauthError?: string | null
  hasCode: boolean
  csrfOk: boolean
}): 'cancelled' | 'error' | 'proceed' {
  if (input.oauthError) return 'cancelled'
  if (!input.hasCode || !input.csrfOk) return 'error'
  return 'proceed'
}

// Discord's guild-add status -> the /free status. 201 = fresh join, 204 =
// already in the server; anything else is a failure.
export function joinOutcome(addStatus: number): 'joined' | 'already' | 'error' {
  if (addStatus === 201) return 'joined'
  if (addStatus === 204) return 'already'
  return 'error'
}

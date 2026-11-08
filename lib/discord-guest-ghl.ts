// Tag a GHL contact "joined-free-discord" when a lead completes the free
// Discord OAuth. Mirrors the GoHighLevel approach used by rv-discord-gateway
// (src/ghl.js): same base, same Version header, same browser headers that get
// past the Cloudflare "Error 1010" bot check, and the same env var names
// (GHL_API_KEY, GHL_LOCATION_ID) so one token is shared across the stack.
//
// Tags are added through the dedicated /tags endpoint, never by PUT /contacts
// (a PUT with `tags` REPLACES the list and would wipe a closer's own tags).
//
// This is best-effort and must NEVER block or break the OAuth redirect: every
// path resolves to a result object, nothing throws, and the api key is never
// put into a log line.

const BASE = 'https://services.leadconnectorhq.com'
const VERSION = '2021-07-28'
const TAG = 'joined-free-discord'
const SMS_TAG = 'joined-discord-sms'

// Every join gets the base tag; SMS joins also get the source tag, so joins
// from the SMS nurture can be counted apart from /free-page joins.
function tagsForSrc(src?: string | null): string[] {
  return src === 'sms' ? [TAG, SMS_TAG] : [TAG]
}

// Copied verbatim from rv-discord-gateway/src/ghl.js — Cloudflare fronts the
// GHL API and rejects a non-browser fingerprint with Error 1010.
const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'identity',
}

export type TagResult = { tagged: boolean; contactId: string | null; reason?: string }

type Logger = { error?: (message: string, meta?: unknown) => void }

type Options = {
  cid?: string | null
  email?: string | null
  src?: string | null
  apiKey?: string
  locationId?: string
  fetchImpl?: typeof fetch
  logger?: Logger
}

function authHeaders(apiKey: string): Record<string, string> {
  return { ...BROWSER_HEADERS, Authorization: `Bearer ${apiKey}`, Version: VERSION }
}

async function findContactIdByEmail(
  fetchImpl: typeof fetch,
  apiKey: string,
  locationId: string,
  email: string,
): Promise<string | null> {
  const url = new URL(`${BASE}/contacts/search/duplicate`)
  url.searchParams.set('locationId', locationId)
  url.searchParams.set('email', email)
  const res = await fetchImpl(url.toString(), { method: 'GET', headers: authHeaders(apiKey) })
  if (!res.ok) throw new Error(`GHL lookup ${res.status}`)
  const data = (await res.json()) as { contact?: { id?: unknown } }
  const id = data?.contact?.id
  return typeof id === 'string' && id.length > 0 ? id : null
}

async function addTags(
  fetchImpl: typeof fetch,
  apiKey: string,
  contactId: string,
  tags: string[],
): Promise<void> {
  const res = await fetchImpl(`${BASE}/contacts/${encodeURIComponent(contactId)}/tags`, {
    method: 'POST',
    headers: { ...authHeaders(apiKey), 'Content-Type': 'application/json' },
    body: JSON.stringify({ tags }),
  })
  if (!res.ok) throw new Error(`GHL tag ${res.status}`)
}

export async function tagJoinedFreeDiscord(opts: Options): Promise<TagResult> {
  const apiKey = opts.apiKey ?? process.env.GHL_API_KEY
  const locationId = opts.locationId ?? process.env.GHL_LOCATION_ID
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  if (!apiKey || !locationId) {
    return { tagged: false, contactId: null, reason: 'no_credentials' }
  }

  try {
    let contactId = opts.cid ? String(opts.cid).trim() : ''
    if (!contactId) {
      const email = opts.email ? String(opts.email).trim() : ''
      if (!email) return { tagged: false, contactId: null, reason: 'no_cid_or_email' }
      const found = await findContactIdByEmail(fetchImpl, apiKey, locationId, email)
      if (!found) return { tagged: false, contactId: null, reason: 'contact_not_found' }
      contactId = found
    }
    await addTags(fetchImpl, apiKey, contactId, tagsForSrc(opts.src))
    return { tagged: true, contactId }
  } catch (err) {
    // Message only — never the api key, never the request.
    opts.logger?.error?.(
      '[discord/guest] GHL tag failed',
      err instanceof Error ? err.message : 'unknown',
    )
    return { tagged: false, contactId: null, reason: 'error' }
  }
}

// Compact label for the one-line auth log. ok = tagged, not_found = no GHL
// contact matched, failed = the GHL call errored, skipped = nothing to do
// (no credentials, or neither cid nor email).
export function tagResultLabel(result: TagResult): 'ok' | 'not_found' | 'failed' | 'skipped' {
  if (result.tagged) return 'ok'
  if (result.reason === 'contact_not_found') return 'not_found'
  if (result.reason === 'error') return 'failed'
  return 'skipped'
}

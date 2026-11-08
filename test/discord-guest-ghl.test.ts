import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tagJoinedFreeDiscord } from '../lib/discord-guest-ghl.ts'

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown }

// A fetch stand-in that records calls and answers from a scripted map keyed by
// "METHOD pathname". Dependency injection, not mocking the unit under test.
function makeFetch(script: Record<string, { ok?: boolean; status?: number; json?: unknown }>) {
  const calls: Call[] = []
  const fetchImpl = (async (input: string, init: RequestInit = {}) => {
    const url = new URL(String(input))
    const method = (init.method || 'GET').toUpperCase()
    calls.push({
      url: String(input),
      method,
      headers: (init.headers || {}) as Record<string, string>,
      body: init.body ? JSON.parse(String(init.body)) : null,
    })
    const key = `${method} ${url.pathname}`
    const res = script[key] ?? { ok: true, status: 200, json: {} }
    return {
      ok: res.ok ?? true,
      status: res.status ?? 200,
      json: async () => res.json ?? {},
      text: async () => JSON.stringify(res.json ?? {}),
    } as unknown as Response
  }) as unknown as typeof fetch
  return { fetchImpl, calls }
}

const CREDS = { apiKey: 'test-key', locationId: 'loc_1' }

test('with cid: tags that contact id directly, no email lookup', async () => {
  const { fetchImpl, calls } = makeFetch({})
  const r = await tagJoinedFreeDiscord({ cid: 'ghl_42', email: 'a@b.com', ...CREDS, fetchImpl })
  assert.deepEqual(r, { tagged: true, contactId: 'ghl_42' })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].method, 'POST')
  assert.match(calls[0].url, /\/contacts\/ghl_42\/tags$/)
  assert.deepEqual(calls[0].body, { tags: ['joined-free-discord'] })
  assert.equal(calls[0].headers['Authorization'], 'Bearer test-key')
  assert.equal(calls[0].headers['Version'], '2021-07-28')
})

test('without cid: looks up the contact by email, then tags it', async () => {
  const { fetchImpl, calls } = makeFetch({
    'GET /contacts/search/duplicate': { json: { contact: { id: 'found_7' } } },
  })
  const r = await tagJoinedFreeDiscord({ email: 'lead@x.com', ...CREDS, fetchImpl })
  assert.deepEqual(r, { tagged: true, contactId: 'found_7' })
  assert.equal(calls[0].method, 'GET')
  assert.match(calls[0].url, /\/contacts\/search\/duplicate/)
  assert.ok(calls[0].url.includes('email=lead%40x.com'))
  assert.equal(calls[1].method, 'POST')
  assert.match(calls[1].url, /\/contacts\/found_7\/tags$/)
})

test('without cid and no contact found by email: does not tag', async () => {
  const { fetchImpl, calls } = makeFetch({
    'GET /contacts/search/duplicate': { json: {} },
  })
  const r = await tagJoinedFreeDiscord({ email: 'ghost@x.com', ...CREDS, fetchImpl })
  assert.deepEqual(r, { tagged: false, contactId: null, reason: 'contact_not_found' })
  assert.equal(calls.length, 1)
})

test('no cid and no email: no network, no tag', async () => {
  const { fetchImpl, calls } = makeFetch({})
  const r = await tagJoinedFreeDiscord({ ...CREDS, fetchImpl })
  assert.deepEqual(r, { tagged: false, contactId: null, reason: 'no_cid_or_email' })
  assert.equal(calls.length, 0)
})

test('missing GHL credentials: no-op, no network', async () => {
  const { fetchImpl, calls } = makeFetch({})
  const r = await tagJoinedFreeDiscord({ cid: 'ghl_1', apiKey: '', locationId: '', fetchImpl })
  assert.deepEqual(r, { tagged: false, contactId: null, reason: 'no_credentials' })
  assert.equal(calls.length, 0)
})

test('never throws when the network fails', async () => {
  const fetchImpl = (async () => {
    throw new Error('ECONNRESET')
  }) as unknown as typeof fetch
  const r = await tagJoinedFreeDiscord({ cid: 'ghl_1', ...CREDS, fetchImpl })
  assert.deepEqual(r, { tagged: false, contactId: null, reason: 'error' })
})

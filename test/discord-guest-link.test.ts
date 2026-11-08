import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  encodeGuestState,
  decodeGuestState,
  guestStartPath,
  freeRedirectPath,
  preAuthOutcome,
  joinOutcome,
} from '../lib/discord-guest-link.ts'

test('encode -> decode round-trips nonce, src and cid', () => {
  const state = encodeGuestState({ nonce: 'abc123', src: 'instagram', cid: 'ghl_987' })
  const out = decodeGuestState(state)
  assert.deepEqual(out, { nonce: 'abc123', src: 'instagram', cid: 'ghl_987' })
})

test('src and cid are null when absent', () => {
  const out = decodeGuestState(encodeGuestState({ nonce: 'n1' }))
  assert.deepEqual(out, { nonce: 'n1', src: null, cid: null })
})

test('decodeGuestState returns null for garbage, empty, or a raw (unencoded) uuid', () => {
  assert.equal(decodeGuestState('not-base64url-$$$'), null)
  assert.equal(decodeGuestState(''), null)
  assert.equal(decodeGuestState(undefined), null)
  // A plain random CSRF nonce (old-style state) must not decode to a state.
  assert.equal(decodeGuestState('550e8400-e29b-41d4-a716-446655440000'), null)
})

test('oversized src/cid are capped to 100 chars (cookie/url safety)', () => {
  const long = 'x'.repeat(500)
  const out = decodeGuestState(encodeGuestState({ nonce: 'n', src: long, cid: long }))
  assert.equal(out?.src?.length, 100)
  assert.equal(out?.cid?.length, 100)
})

test('guestStartPath forwards only src and cid to the guest start route', () => {
  const p = guestStartPath(new URLSearchParams('src=tiktok&cid=ghl_1&utm_source=ads&foo=bar'))
  const url = new URL(p, 'https://realventure.io')
  assert.equal(url.pathname, '/api/discord/guest/start')
  assert.equal(url.searchParams.get('src'), 'tiktok')
  assert.equal(url.searchParams.get('cid'), 'ghl_1')
  assert.equal(url.searchParams.get('utm_source'), null)
  assert.equal(url.searchParams.get('foo'), null)
})

test('guestStartPath returns the bare path when no src/cid present', () => {
  assert.equal(guestStartPath(new URLSearchParams('utm_source=ads')), '/api/discord/guest/start')
})

// ── freeRedirectPath: where the callback sends the browser ──────────────────
test('freeRedirectPath carries the status and, when given, src and cid', () => {
  assert.equal(freeRedirectPath('joined', { src: 'sms' }), '/free?discord=joined&src=sms')
  assert.equal(
    freeRedirectPath('cancelled', { src: 'sms', cid: 'ghl_9' }),
    '/free?discord=cancelled&src=sms&cid=ghl_9',
  )
})

test('freeRedirectPath omits empty src/cid', () => {
  assert.equal(freeRedirectPath('already', {}), '/free?discord=already')
  assert.equal(freeRedirectPath('error', { src: null, cid: '' }), '/free?discord=error')
})

// ── preAuthOutcome: cancel vs error vs proceed, before any Discord call ──────
test('preAuthOutcome: a Discord error param (e.g. access_denied) is cancelled', () => {
  assert.equal(preAuthOutcome({ oauthError: 'access_denied', hasCode: false, csrfOk: true }), 'cancelled')
  assert.equal(preAuthOutcome({ oauthError: 'server_error', hasCode: false, csrfOk: true }), 'cancelled')
})

test('preAuthOutcome: missing code or failed CSRF is an error', () => {
  assert.equal(preAuthOutcome({ oauthError: null, hasCode: false, csrfOk: true }), 'error')
  assert.equal(preAuthOutcome({ oauthError: null, hasCode: true, csrfOk: false }), 'error')
})

test('preAuthOutcome: a valid code with matching state proceeds', () => {
  assert.equal(preAuthOutcome({ oauthError: null, hasCode: true, csrfOk: true }), 'proceed')
})

// ── joinOutcome: Discord guild-add status -> redirect status ────────────────
test('joinOutcome maps guild-add status to a redirect status', () => {
  assert.equal(joinOutcome(201), 'joined')
  assert.equal(joinOutcome(204), 'already')
  assert.equal(joinOutcome(403), 'error')
  assert.equal(joinOutcome(500), 'error')
})

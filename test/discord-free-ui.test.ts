import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isSmsSrc,
  discordEntryHref,
  isValidGhlContactId,
  dAliasTarget,
} from '../lib/discord-free-ui.ts'

test('isSmsSrc is true only for the exact "sms" source', () => {
  assert.equal(isSmsSrc('sms'), true)
  assert.equal(isSmsSrc('SMS'), false)
  assert.equal(isSmsSrc('free_page'), false)
  assert.equal(isSmsSrc(null), false)
  assert.equal(isSmsSrc(undefined), false)
})

test('discordEntryHref points the retry button back to /discord with src and cid', () => {
  assert.equal(discordEntryHref({ src: 'sms', cid: 'ghl_9' }), '/discord?src=sms&cid=ghl_9')
})

test('discordEntryHref omits missing params and is bare when none', () => {
  assert.equal(discordEntryHref({ src: 'sms' }), '/discord?src=sms')
  assert.equal(discordEntryHref({ cid: 'ghl_9' }), '/discord?cid=ghl_9')
  assert.equal(discordEntryHref({}), '/discord')
  assert.equal(discordEntryHref({ src: null, cid: '' }), '/discord')
})

// ── /d/[cid] alias: cid validation + fallback ──────────────────────────────
test('isValidGhlContactId accepts 15-30 char alphanumeric only', () => {
  assert.equal(isValidGhlContactId('a1b2c3d4e5f6g7h'), true) // 15
  assert.equal(isValidGhlContactId('abc123DEF456ghi789JKL012mno345'), true) // 30
  assert.equal(isValidGhlContactId('seHhv9x8K2mNqRs7Tuv'), true)
})

test('isValidGhlContactId rejects wrong length, non-alphanumeric, empty', () => {
  assert.equal(isValidGhlContactId('a1b2c3d4e5f6g7'), false) // 14, too short
  assert.equal(isValidGhlContactId('a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p'), false) // 31, too long
  assert.equal(isValidGhlContactId('abc-123-def-456-789'), false) // dashes
  assert.equal(isValidGhlContactId('abc 123 def 456 789'), false) // spaces
  assert.equal(isValidGhlContactId('ghl_contact_id_1234'), false) // underscores
  assert.equal(isValidGhlContactId(''), false)
  assert.equal(isValidGhlContactId(null), false)
  assert.equal(isValidGhlContactId(undefined), false)
})

test('dAliasTarget: valid cid -> /discord?src=sms&cid=<cid>', () => {
  assert.equal(
    dAliasTarget('abc123DEF456ghi'),
    '/discord?src=sms&cid=abc123DEF456ghi',
  )
})

test('dAliasTarget: invalid cid falls back to /discord?src=sms (no cid)', () => {
  assert.equal(dAliasTarget('short'), '/discord?src=sms')
  assert.equal(dAliasTarget('has-a-dash-in-the-id'), '/discord?src=sms')
  assert.equal(dAliasTarget(''), '/discord?src=sms')
  assert.equal(dAliasTarget(undefined), '/discord?src=sms')
})

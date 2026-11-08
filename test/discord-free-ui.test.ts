import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isSmsSrc, discordEntryHref } from '../lib/discord-free-ui.ts'

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

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { guardPII } from './redactor.js'

// --- HARD BLOCKS ------------------------------------------------------------

test('blocks labeled numeric codes (code: 1234)', () => {
  const r = guardPII('Use code: 4729 to log in.')
  assert.equal(r.blocked, true)
  assert.match(r.blockReason, /access code/i)
})

test('blocks pin: 5678', () => {
  const r = guardPII('pin: 5678')
  assert.equal(r.blocked, true)
})

test('blocks password = 90123', () => {
  const r = guardPII('password = 90123')
  assert.equal(r.blocked, true)
})

test('blocks alarm code label without digits', () => {
  const r = guardPII('Please remind me of the alarm code when I arrive.')
  assert.equal(r.blocked, true)
  assert.match(r.blockReason, /physical access credential/i)
})

test('blocks garage code reference', () => {
  const r = guardPII('Need the garage code for tomorrow.')
  assert.equal(r.blocked, true)
})

test('blocks door pin and gate password references', () => {
  for (const phrase of ['door pin', 'gate password', 'keypad code', 'safe passcode']) {
    const r = guardPII(`What is the ${phrase}?`)
    assert.equal(r.blocked, true, `expected block for "${phrase}"`)
  }
})

test('blocks wifi password references', () => {
  for (const phrase of [
    'wifi password = letmein',
    'wifi key: hunter2',
    'network password = abc123',
    'wpa2 password: longpass',
    'psk: mysecret',
  ]) {
    const r = guardPII(phrase)
    assert.equal(r.blocked, true, `expected block for "${phrase}"`)
    assert.match(r.blockReason, /WiFi password|network credential/i)
  }
})

// --- PASS-THROUGH -----------------------------------------------------------

test('does not block ordinary uses of "code"', () => {
  assert.equal(guardPII('I wrote some code today.').blocked, false)
})

test('lets names pass through', () => {
  assert.equal(guardPII('John Smith called about the install.').blocked, false)
})

test('lets addresses pass through', () => {
  assert.equal(guardPII('Visit them at 123 Pine Street tomorrow.').blocked, false)
})

test('lets phones, emails, IPs, MACs, SSIDs pass through', () => {
  for (const phrase of [
    'Call 503-555-0100 please.',
    'Email jane@example.com about it.',
    'Router at 192.168.1.1.',
    'MAC aa:bb:cc:dd:ee:ff.',
    'SSID: HomeNet_5G',
  ]) {
    assert.equal(guardPII(phrase).blocked, false, `should pass: "${phrase}"`)
  }
})

test('handles empty / null input', () => {
  assert.deepEqual(guardPII(''), { blocked: false, blockReason: null })
  assert.deepEqual(guardPII(null), { blocked: false, blockReason: null })
})

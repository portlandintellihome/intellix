// EMAIL_ENABLED must be fail-closed: only the exact string "true" enables
// client email; anything else (unset, empty, typos) keeps it off.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isEmailEnabled } from './email.js'

test('isEmailEnabled is off unless EMAIL_ENABLED is "true"', () => {
  const prev = process.env.EMAIL_ENABLED
  try {
    for (const v of [undefined, '', 'false', '1', 'yes', 'on', 'tru']) {
      if (v === undefined) delete process.env.EMAIL_ENABLED
      else process.env.EMAIL_ENABLED = v
      assert.equal(isEmailEnabled(), false, `EMAIL_ENABLED=${v} must be off`)
    }
    for (const v of ['true', ' TRUE ', 'True']) {
      process.env.EMAIL_ENABLED = v
      assert.equal(isEmailEnabled(), true, `EMAIL_ENABLED=${v} must be on`)
    }
  } finally {
    if (prev === undefined) delete process.env.EMAIL_ENABLED
    else process.env.EMAIL_ENABLED = prev
  }
})

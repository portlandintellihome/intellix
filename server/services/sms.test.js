// Tests for the SMS service — pure helpers plus the opt-out guardrail that
// must reliably suppress the (most promotional) review request even after it's
// been queued. No network, no DB: query is a hand-rolled fake.
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  normalizePhone, renderTemplate, isWithinQuietHours, nextAllowedSendTime,
  isSmsConfigured, processMessage, enqueueMessage, isSmsEnabled, sendViaTwilio,
} from './sms.js'

test('normalizePhone coerces formats + scientific notation to E.164', () => {
  assert.equal(normalizePhone('3104097655'), '+13104097655')
  assert.equal(normalizePhone('(310) 409-7655'), '+13104097655')
  assert.equal(normalizePhone('13104097655'), '+13104097655')
  assert.equal(normalizePhone('+44 20 7946 0000'), '+442079460000')
  assert.equal(normalizePhone('3.104098e+09'), '+13104098000')
  assert.equal(normalizePhone(''), null)
  assert.equal(normalizePhone('   '), null)
  assert.equal(normalizePhone('123'), null)
})

test('renderTemplate substitutes merge fields and blanks unknowns', () => {
  const out = renderTemplate('Hi {client_name}, {employee_name} from {company} is on the way{eta}.', {
    client_name: 'Sam', employee_name: 'Jordan', company: 'IntelliHome', eta: ' (ETA 3:30 PM)',
  })
  assert.equal(out, 'Hi Sam, Jordan from IntelliHome is on the way (ETA 3:30 PM).')
  // Unknown/blank fields render empty, never as a literal {token}.
  assert.equal(renderTemplate('Hi {client_name}{eta}!', { client_name: 'Sam' }), 'Hi Sam!')
})

test('quiet hours: overnight window 21..8', () => {
  const opts = { start: 21, end: 8, timezone: 'UTC' }
  assert.equal(isWithinQuietHours(new Date('2026-07-27T23:00:00Z'), opts), true)
  assert.equal(isWithinQuietHours(new Date('2026-07-27T05:00:00Z'), opts), true)
  assert.equal(isWithinQuietHours(new Date('2026-07-27T12:00:00Z'), opts), false)
  // next allowed time from 11pm UTC lands outside the window (>= 8am).
  const next = nextAllowedSendTime(new Date('2026-07-27T23:00:00Z'), opts)
  assert.equal(isWithinQuietHours(next, opts), false)
})

test('start===end disables quiet hours', () => {
  assert.equal(isWithinQuietHours(new Date('2026-07-27T03:00:00Z'), { start: 0, end: 0, timezone: 'UTC' }), false)
})

// A fake query that serves rows by matching the SQL text.
function fakeDb(state) {
  return async (sql) => {
    if (/FROM sms_messages WHERE id/.test(sql)) return { rows: [state.msg] }
    if (/COALESCE\(sms_opt_out, FALSE\) AS opt_out FROM clients/.test(sql)) {
      return { rows: [{ opt_out: state.optOut }] }
    }
    if (/UPDATE sms_messages SET status = 'canceled'/.test(sql)) {
      state.msg = { ...state.msg, status: 'canceled', error: 'client opted out of SMS' }
      return { rows: [state.msg] }
    }
    if (/SELECT \* FROM settings/.test(sql)) return { rows: [{ sms_quiet_hours_start: 21, sms_quiet_hours_end: 8, sms_timezone: 'UTC' }] }
    if (/UPDATE sms_messages SET/.test(sql)) {
      state.msg = { ...state.msg, status: 'sent' }
      return { rows: [state.msg] }
    }
    return { rows: [] }
  }
}

test('processMessage cancels a queued review when the client has opted out', async () => {
  const state = {
    optOut: true,
    msg: { id: 5, client_id: 1, template_key: 'review', to_number: '+13104097655', status: 'queued', body: 'x' },
  }
  const query = fakeDb(state)
  const r = await processMessage(query, 5, { now: new Date('2026-07-27T18:00:00Z') })
  assert.equal(r.status, 'canceled')
  assert.match(r.error, /opted out/)
})

test('enqueueMessage records an opted-out client as skipped (audit row, never sent)', async () => {
  const inserted = []
  const query = async (sql, params) => {
    if (/SELECT \* FROM settings/.test(sql)) return { rows: [{ company_name: 'IntelliHome', sms_template_completed: 'Hi {client_name}, done.' }] }
    if (/INSERT INTO sms_messages/.test(sql)) {
      const row = { id: 1, status: params[5], error: params[6], body: params[4] }
      inserted.push(row)
      return { rows: [row] }
    }
    return { rows: [] }
  }
  const row = await enqueueMessage(query, {
    client_id: 1, template_key: 'completed', values: { client_name: 'Sam' },
    clientPhone: '3104097655', optedOut: true,
  })
  assert.equal(row.status, 'skipped')
  assert.match(row.error, /opted out/)
})

test('isSmsConfigured reflects env presence', () => {
  const saved = { ...process.env }
  delete process.env.TWILIO_ACCOUNT_SID
  delete process.env.TWILIO_AUTH_TOKEN
  delete process.env.TWILIO_FROM_NUMBER
  assert.equal(isSmsConfigured(), false)
  process.env.TWILIO_ACCOUNT_SID = 'AC1'
  process.env.TWILIO_AUTH_TOKEN = 'tok'
  process.env.TWILIO_FROM_NUMBER = '+15035550123'
  assert.equal(isSmsConfigured(), true)
  Object.assign(process.env, saved)
  if (!saved.TWILIO_ACCOUNT_SID) delete process.env.TWILIO_ACCOUNT_SID
  if (!saved.TWILIO_AUTH_TOKEN) delete process.env.TWILIO_AUTH_TOKEN
  if (!saved.TWILIO_FROM_NUMBER) delete process.env.TWILIO_FROM_NUMBER
})


// --- A2P kill switch -------------------------------------------------------
// Outbound client SMS must be impossible while SMS_ENABLED is not "true".

test('isSmsEnabled fails closed for missing/empty/malformed values', () => {
  const prev = process.env.SMS_ENABLED
  for (const v of [undefined, '', '  ', 'false', 'TRUE_ISH', '1', 'yes', 'on']) {
    if (v === undefined) delete process.env.SMS_ENABLED
    else process.env.SMS_ENABLED = v
    assert.equal(isSmsEnabled(), false, `expected disabled for ${JSON.stringify(v)}`)
  }
  for (const v of ['true', 'TRUE', ' True ']) {
    process.env.SMS_ENABLED = v
    assert.equal(isSmsEnabled(), true, `expected enabled for ${JSON.stringify(v)}`)
  }
  if (prev === undefined) delete process.env.SMS_ENABLED; else process.env.SMS_ENABLED = prev
})

test('sendViaTwilio refuses to send while disabled, even with valid credentials', async () => {
  const prev = process.env.SMS_ENABLED
  delete process.env.SMS_ENABLED
  process.env.TWILIO_ACCOUNT_SID = 'AC1'
  process.env.TWILIO_AUTH_TOKEN = 'tok'
  process.env.TWILIO_FROM_NUMBER = '+15035550123'
  // Trip-wire: a real send would hit fetch. If it is ever called, fail loudly.
  const realFetch = globalThis.fetch
  globalThis.fetch = () => { throw new Error('NETWORK CALL ESCAPED THE KILL SWITCH') }
  try {
    await assert.rejects(
      () => sendViaTwilio({ to: '+13105550123', body: 'hi' }),
      err => err.code === 'sms_disabled',
    )
  } finally {
    globalThis.fetch = realFetch
    if (prev === undefined) delete process.env.SMS_ENABLED; else process.env.SMS_ENABLED = prev
  }
})

test('processMessage blocks a queued text while disabled and never sends', async () => {
  const prev = process.env.SMS_ENABLED
  delete process.env.SMS_ENABLED
  const rows = { 1: { id: 1, client_id: 7, to_number: '+13105550123', body: 'hi', status: 'queued' } }
  const query = async (sql, params) => {
    if (/FROM sms_messages WHERE id/i.test(sql)) return { rows: [rows[1]] }
    if (/FROM clients WHERE id/i.test(sql)) return { rows: [{ opt_out: false }] }
    if (/FROM settings/i.test(sql)) return { rows: [{}] }
    if (/UPDATE sms_messages/i.test(sql)) {
      assert.doesNotMatch(sql, /status = 'sent'/, 'must never mark sent while disabled')
      rows[1] = { ...rows[1], error: params[1] ?? rows[1].error }
      return { rows: [rows[1]] }
    }
    return { rows: [] }
  }
  const realFetch = globalThis.fetch
  globalThis.fetch = () => { throw new Error('NETWORK CALL ESCAPED THE KILL SWITCH') }
  try {
    const out = await processMessage(query, 1)
    assert.equal(out.status, 'queued', 'row stays queued, nothing lost')
  } finally {
    globalThis.fetch = realFetch
    if (prev === undefined) delete process.env.SMS_ENABLED; else process.env.SMS_ENABLED = prev
  }
})

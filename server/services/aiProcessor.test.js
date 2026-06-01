import { test } from 'node:test'
import assert from 'node:assert/strict'

import { processAIRequest, generateCheckinEmail } from './aiProcessor.js'

// --- helpers ----------------------------------------------------------------

function makeQueryFn(rows = []) {
  const calls = []
  let idx = 0
  const fn = async (sql, params) => {
    calls.push({ sql, params })
    if (sql.startsWith('SELECT ai_opt_out')) {
      return { rows: rows.shift() ? [{ ai_opt_out: true }] : [{ ai_opt_out: false }] }
    }
    // INSERT into ai_interactions
    return { rows: [] }
  }
  fn.calls = calls
  return fn
}

function makeAnthropic({ text = 'ok', input = 10, output = 5 } = {}) {
  return {
    messages: {
      create: async () => ({
        content: [{ type: 'text', text }],
        stop_reason: 'end_turn',
        usage: { input_tokens: input, output_tokens: output },
      }),
    },
  }
}

// --- tests ------------------------------------------------------------------

test('refuses when client has ai_opt_out = true', async () => {
  const queryFn = makeQueryFn([true])
  const anthropic = makeAnthropic()
  await assert.rejects(
    processAIRequest(
      { taskType: 'assist_chat', userId: 1, clientId: 42, prompt: 'hi' },
      { queryFn, anthropic },
    ),
    err => err.code === 'opt_out' && /opt[- ]?ed? out/i.test(err.message),
  )
  // First call is the opt-out lookup, second call is the audit-log INSERT
  assert.equal(queryFn.calls[0].sql.startsWith('SELECT ai_opt_out'), true)
  assert.match(queryFn.calls[1].sql, /INSERT INTO ai_interactions/)
})

test('blocks input containing an alarm code reference', async () => {
  const queryFn = makeQueryFn()
  const anthropic = makeAnthropic()
  await assert.rejects(
    processAIRequest(
      { taskType: 'assist_chat', userId: 1, prompt: 'What is the alarm code?' },
      { queryFn, anthropic },
    ),
    err => err.code === 'blocked',
  )
  // Should have logged a blocked row
  assert.ok(queryFn.calls.some(c => /INSERT INTO ai_interactions/.test(c.sql)))
})

test('blocks labeled wifi password', async () => {
  const queryFn = makeQueryFn()
  await assert.rejects(
    processAIRequest(
      { taskType: 'assist_chat', userId: 1, prompt: 'wifi password = letmein' },
      { queryFn, anthropic: makeAnthropic() },
    ),
    err => err.code === 'blocked',
  )
})

test('passes safe prompt through and logs ok', async () => {
  const queryFn = makeQueryFn()
  const anthropic = makeAnthropic({ text: 'hello back', input: 7, output: 3 })
  const result = await processAIRequest(
    { taskType: 'assist_chat', userId: 1, prompt: 'Hello there' },
    { queryFn, anthropic },
  )
  assert.equal(result.reply, 'hello back')
  assert.equal(result.usage.input_tokens, 7)
  assert.equal(result.usage.output_tokens, 3)
  // Audit row written with status=ok
  const insert = queryFn.calls.find(c => /INSERT INTO ai_interactions/.test(c.sql))
  assert.ok(insert, 'expected an audit-log INSERT')
  // status param is the 11th positional ($11)
  assert.equal(insert.params[10], 'ok')
})

test('honors messages[] input shape', async () => {
  const queryFn = makeQueryFn()
  const anthropic = makeAnthropic({ text: 'reply' })
  const result = await processAIRequest(
    {
      taskType: 'assist_chat',
      userId: 1,
      messages: [
        { role: 'user', content: 'one' },
        { role: 'assistant', content: 'two' },
        { role: 'user', content: 'three' },
      ],
    },
    { queryFn, anthropic },
  )
  assert.equal(result.reply, 'reply')
})

test('rejects empty input AND logs invalid_input row', async () => {
  const queryFn = makeQueryFn()
  await assert.rejects(
    processAIRequest(
      { taskType: 'assist_chat', userId: 1 },
      { queryFn, anthropic: makeAnthropic() },
    ),
    err => err.code === 'invalid_input',
  )
  const insert = queryFn.calls.find(c => /INSERT INTO ai_interactions/.test(c.sql))
  assert.ok(insert, 'expected an audit-log row even on invalid_input')
  assert.equal(insert.params[10], 'invalid_input')
})

test('rejects when conversation does not end with user AND logs', async () => {
  const queryFn = makeQueryFn()
  await assert.rejects(
    processAIRequest(
      {
        taskType: 'assist_chat',
        userId: 1,
        messages: [
          { role: 'user', content: 'hi' },
          { role: 'assistant', content: 'hello' },
        ],
      },
      { queryFn, anthropic: makeAnthropic() },
    ),
    err => err.code === 'invalid_input',
  )
  const insert = queryFn.calls.find(c => /INSERT INTO ai_interactions/.test(c.sql))
  assert.ok(insert)
  assert.equal(insert.params[10], 'invalid_input')
})

test('logs missing_key row when ANTHROPIC_API_KEY is unset', async () => {
  const queryFn = makeQueryFn()
  // No anthropic client and no env key — production "key missing" path.
  const prevKey = process.env.ANTHROPIC_API_KEY
  delete process.env.ANTHROPIC_API_KEY
  try {
    await assert.rejects(
      processAIRequest(
        { taskType: 'assist_chat', userId: 1, prompt: 'hi' },
        { queryFn },
      ),
      err => err.code === 'missing_key',
    )
    const insert = queryFn.calls.find(c => /INSERT INTO ai_interactions/.test(c.sql))
    assert.ok(insert, 'expected an audit-log row when key is missing')
    assert.equal(insert.params[10], 'missing_key')
  } finally {
    if (prevKey !== undefined) process.env.ANTHROPIC_API_KEY = prevKey
  }
})

test('does not check opt-out when clientId is null', async () => {
  const queryFn = makeQueryFn()
  await processAIRequest(
    { taskType: 'assist_chat', userId: 1, prompt: 'hi' },
    { queryFn, anthropic: makeAnthropic() },
  )
  assert.equal(
    queryFn.calls.some(c => c.sql.startsWith('SELECT ai_opt_out')),
    false,
  )
})

// --- generateCheckinEmail ---------------------------------------------------

const CHECKIN_CTX = {
  client: { id: 5, name: 'Jamie Reyes', address: '742 Evergreen Terrace' },
  job: { id: 9, name: 'Theater install', scope: 'Control4 EA-3, Sonos Arc' },
  location: { google_review_url: 'https://g.page/r/abc/review' },
  days_since_install: 1,
  tone: 'warm',
}

test('generateCheckinEmail returns {subject, html_body} parsed from AI JSON', async () => {
  const queryFn = makeQueryFn()
  const anthropic = makeAnthropic({ text: JSON.stringify({ subject: 'Thanks, Jamie!', html_body: '<p>Hi Jamie</p>' }) })
  const out = await generateCheckinEmail(CHECKIN_CTX, { queryFn, anthropic })
  assert.equal(out.subject, 'Thanks, Jamie!')
  assert.equal(out.html_body, '<p>Hi Jamie</p>')
})

test('generateCheckinEmail strips code fences around the JSON', async () => {
  const queryFn = makeQueryFn()
  const fenced = '```json\n{"subject":"S","html_body":"<p>B</p>"}\n```'
  const anthropic = makeAnthropic({ text: fenced })
  const out = await generateCheckinEmail(CHECKIN_CTX, { queryFn, anthropic })
  assert.equal(out.subject, 'S')
  assert.equal(out.html_body, '<p>B</p>')
})

test('generateCheckinEmail throws upstream when AI returns non-JSON', async () => {
  const queryFn = makeQueryFn()
  const anthropic = makeAnthropic({ text: 'Sorry, here is your email: Hi Jamie...' })
  await assert.rejects(
    generateCheckinEmail(CHECKIN_CTX, { queryFn, anthropic }),
    err => err.code === 'upstream',
  )
})

test('generateCheckinEmail surfaces missing_key when ANTHROPIC_API_KEY is unset', async () => {
  const queryFn = makeQueryFn()
  const prevKey = process.env.ANTHROPIC_API_KEY
  delete process.env.ANTHROPIC_API_KEY
  try {
    await assert.rejects(
      generateCheckinEmail(CHECKIN_CTX, { queryFn }), // no injected client → real key path
      err => err.code === 'missing_key',
    )
  } finally {
    if (prevKey !== undefined) process.env.ANTHROPIC_API_KEY = prevKey
  }
})

test('generateCheckinEmail assembles prompt with client/job context and skips PII guard', async () => {
  const queryFn = makeQueryFn()
  let captured = null
  const anthropic = {
    messages: {
      create: async (args) => {
        captured = args
        return { content: [{ type: 'text', text: '{"subject":"x","html_body":"<p>y</p>"}' }], stop_reason: 'end_turn', usage: {} }
      },
    },
  }
  // A phone-number-like string in scope would trip the PII guard if not skipped.
  await generateCheckinEmail(
    { ...CHECKIN_CTX, job: { ...CHECKIN_CTX.job, scope: 'alarm code 1234 programmed' } },
    { queryFn, anthropic },
  )
  const userMsg = captured.messages[captured.messages.length - 1].content
  assert.match(userMsg, /Jamie Reyes/)
  assert.match(userMsg, /g\.page\/r\/abc\/review/)
  assert.match(userMsg, /alarm code 1234/) // not blocked → skipPiiGuard works
})

test('generateCheckinEmail sign-off uses ONLY the provided location contact', async () => {
  const queryFn = makeQueryFn()
  let captured = null
  const anthropic = {
    messages: { create: async (args) => { captured = args; return { content: [{ type: 'text', text: '{"subject":"x","html_body":"<p>y</p>"}' }], stop_reason: 'end_turn', usage: {} } } },
  }
  await generateCheckinEmail({
    ...CHECKIN_CTX,
    location: { name: 'Portland', phone: '(503) 500-0180', email: 'pdx@x.com', google_review_url: 'https://g.page/r/abc/review' },
  }, { queryFn, anthropic })
  const userMsg = captured.messages[captured.messages.length - 1].content
  assert.match(userMsg, /IntelliHome AV Portland/)
  assert.match(userMsg, /\(503\) 500-0180/)
  assert.match(userMsg, /pdx@x\.com/)
  // No other office (e.g. the LA number) should be injected by our code.
  assert.doesNotMatch(userMsg, /310/)
  // System prompt forbids emojis + character-level formatting.
  assert.match(captured.system, /Do not use any emojis/i)
  assert.match(captured.system, /plain paragraphs/i)
})

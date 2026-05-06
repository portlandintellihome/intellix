import { test } from 'node:test'
import assert from 'node:assert/strict'

import { processAIRequest } from './aiProcessor.js'

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

test('rejects empty input', async () => {
  await assert.rejects(
    processAIRequest(
      { taskType: 'assist_chat', userId: 1 },
      { queryFn: makeQueryFn(), anthropic: makeAnthropic() },
    ),
    err => err.code === 'invalid_input',
  )
})

test('rejects when conversation does not end with user', async () => {
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
      { queryFn: makeQueryFn(), anthropic: makeAnthropic() },
    ),
    err => err.code === 'invalid_input',
  )
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

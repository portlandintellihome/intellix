// Central AI gateway. Every Claude call in Intellix routes through here so
// we have one place that:
//   - Holds the ANTHROPIC_API_KEY (no other module imports the SDK directly)
//   - Enforces the per-client ai_opt_out flag
//   - Runs the hard-block PII guard on every user-supplied input
//   - Writes an audit row to ai_interactions for every attempt (success,
//     refused, error)
//
// Public API:
//   processAIRequest({ taskType, userId, clientId?, jobId?, ticketId?,
//                       prompt? | messages?, systemPrompt?, model? }) → { reply, usage }
//   isAIConfigured() → boolean
//
// Errors:
//   throws Error with .code in { 'opt_out', 'blocked', 'missing_key',
//                                 'invalid_input', 'upstream' }

import Anthropic from '@anthropic-ai/sdk'
import { query as defaultQuery } from '../db.js'
import { guardPII } from './redactor.js'

const DEFAULT_MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 4096

export function isAIConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

function makeError(code, message, status) {
  const err = new Error(message)
  err.code = code
  if (status) err.status = status
  return err
}

async function logInteraction(queryFn, row) {
  try {
    await queryFn(
      `INSERT INTO ai_interactions
         (user_id, task_type, client_id, job_id, ticket_id,
          redacted_prompt, raw_response, model,
          tokens_input, tokens_output, status, error_message)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        row.userId ?? null,
        row.taskType,
        row.clientId ?? null,
        row.jobId ?? null,
        row.ticketId ?? null,
        row.prompt ?? null,
        row.response ?? null,
        row.model ?? null,
        row.tokensInput ?? null,
        row.tokensOutput ?? null,
        row.status,
        row.errorMessage ?? null,
      ],
    )
  } catch (logErr) {
    // Never let an audit-log failure break the user-facing request.
    console.error('[aiProcessor] failed to write audit row', logErr)
  }
}

export async function processAIRequest(opts, deps = {}) {
  const queryFn = deps.queryFn || defaultQuery
  const anthropicClient = deps.anthropic // injected client for tests

  const {
    taskType,
    userId = null,
    clientId = null,
    jobId = null,
    ticketId = null,
    prompt = null,
    messages = null,
    systemPrompt = null,
    model = DEFAULT_MODEL,
  } = opts || {}

  if (!taskType) throw makeError('invalid_input', 'taskType is required', 400)

  // Normalize input into a messages[] array for Anthropic.
  let convo
  let invalidReason = null
  if (Array.isArray(messages) && messages.length > 0) {
    convo = messages
      .filter(m => (m.role === 'user' || m.role === 'assistant')
        && typeof m.content === 'string' && m.content.trim())
      .map(m => ({ role: m.role, content: m.content }))
    if (convo.length === 0 || convo[convo.length - 1].role !== 'user') {
      invalidReason = 'conversation must end with a user message'
    }
  } else if (typeof prompt === 'string' && prompt.trim()) {
    convo = [{ role: 'user', content: prompt }]
  } else {
    invalidReason = 'prompt or messages is required'
  }
  if (invalidReason) {
    await logInteraction(queryFn, {
      userId, taskType, clientId, jobId, ticketId,
      prompt: convo ? combinedText(convo) : null,
      model,
      status: 'invalid_input',
      errorMessage: invalidReason,
    })
    throw makeError('invalid_input', invalidReason, 400)
  }

  // Per-client opt-out: refuse before anything else.
  if (clientId != null) {
    const r = await queryFn('SELECT ai_opt_out FROM clients WHERE id = $1', [clientId])
    if (r.rows[0]?.ai_opt_out) {
      await logInteraction(queryFn, {
        userId, taskType, clientId, jobId, ticketId,
        prompt: combinedText(convo),
        model,
        status: 'refused_opt_out',
        errorMessage: 'Client has opted out of AI processing',
      })
      throw makeError('opt_out', 'This client has opted out of AI processing.', 403)
    }
  }

  // Hard-block PII guard on every user-authored message in the convo.
  for (const m of convo) {
    if (m.role !== 'user') continue
    const guard = guardPII(m.content)
    if (guard.blocked) {
      await logInteraction(queryFn, {
        userId, taskType, clientId, jobId, ticketId,
        prompt: combinedText(convo),
        model,
        status: 'blocked',
        errorMessage: guard.blockReason,
      })
      throw makeError('blocked', guard.blockReason, 422)
    }
  }

  if (!isAIConfigured() && !anthropicClient) {
    await logInteraction(queryFn, {
      userId, taskType, clientId, jobId, ticketId,
      prompt: combinedText(convo),
      model,
      status: 'missing_key',
      errorMessage: 'ANTHROPIC_API_KEY is not configured on the backend',
    })
    throw makeError('missing_key', 'AI is not configured. Set ANTHROPIC_API_KEY on the backend.', 503)
  }

  const client = anthropicClient || new Anthropic()

  let response
  try {
    response = await client.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: convo,
    })
  } catch (err) {
    await logInteraction(queryFn, {
      userId, taskType, clientId, jobId, ticketId,
      prompt: combinedText(convo),
      model,
      status: 'error',
      errorMessage: err?.message || 'unknown upstream error',
    })
    err.code = err.code || 'upstream'
    throw err
  }

  const reply = (response.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')

  await logInteraction(queryFn, {
    userId, taskType, clientId, jobId, ticketId,
    prompt: combinedText(convo),
    response: reply,
    model,
    tokensInput: response.usage?.input_tokens ?? null,
    tokensOutput: response.usage?.output_tokens ?? null,
    status: 'ok',
  })

  return {
    reply,
    usage: {
      input_tokens: response.usage?.input_tokens ?? null,
      output_tokens: response.usage?.output_tokens ?? null,
    },
    stop_reason: response.stop_reason,
  }
}

function combinedText(convo) {
  return convo.map(m => `${m.role}: ${m.content}`).join('\n\n')
}

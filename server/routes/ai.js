import { Router } from 'express'

import { query } from '../db.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { processAIRequest, isAIConfigured } from '../services/aiProcessor.js'

const router = Router()

// Public configuration probe — no key material exposed.
router.get('/status', (_req, res) => {
  res.json({ connected: isAIConfigured() })
})

// Single AI gateway. Every Intellix surface that talks to Claude posts here.
router.post('/process', requireAuth, async (req, res, next) => {
  const start = Date.now()
  const {
    taskType, clientId, jobId, ticketId,
    prompt, messages, systemPrompt, model,
  } = req.body || {}

  console.log('[ai] request', {
    taskType,
    userId: req.user?.id,
    clientId: clientId ?? null,
    hasMessages: Array.isArray(messages) ? messages.length : 0,
    hasPrompt: typeof prompt === 'string' && prompt.length > 0,
  })

  try {
    const result = await processAIRequest({
      taskType,
      userId: req.user?.id ?? null,
      clientId: clientId ?? null,
      jobId: jobId ?? null,
      ticketId: ticketId ?? null,
      prompt,
      messages,
      systemPrompt,
      model,
    })
    console.log('[ai] ok', {
      taskType,
      ms: Date.now() - start,
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
    })
    res.json(result)
  } catch (err) {
    console.error('[ai] error', {
      taskType,
      code: err.code,
      message: err.message,
      status: err.status,
    })
    if (err.code === 'invalid_input') return res.status(400).json({ error: err.message })
    if (err.code === 'opt_out')      return res.status(403).json({ error: err.message })
    if (err.code === 'blocked')      return res.status(422).json({ error: err.message, blocked: true })
    if (err.code === 'missing_key')  return res.status(503).json({ error: err.message })
    if (err.status)                  return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

// Admin audit log. Filters: user, client, task_type, from, to, limit.
router.get('/audit', requireAuth, requireAdmin, async (req, res, next) => {
  const { user, client, task_type, from, to } = req.query
  const limit = Math.min(Number(req.query.limit) || 100, 500)

  const where = []
  const params = []
  const add = (clause, value) => { params.push(value); where.push(clause.replace('?', `$${params.length}`)) }

  if (user)      add('ai.user_id = ?', Number(user))
  if (client)    add('ai.client_id = ?', Number(client))
  if (task_type) add('ai.task_type = ?', task_type)
  if (from)      add('ai.created_at >= ?', from)
  if (to)        add('ai.created_at <= ?', to)

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  params.push(limit)

  try {
    const { rows } = await query(
      `SELECT ai.id, ai.created_at, ai.task_type, ai.status, ai.model,
              ai.tokens_input, ai.tokens_output, ai.error_message,
              ai.redacted_prompt,
              ai.user_id, u.name AS user_name,
              ai.client_id, c.name AS client_name
         FROM ai_interactions ai
         LEFT JOIN users   u ON u.id = ai.user_id
         LEFT JOIN clients c ON c.id = ai.client_id
         ${whereSql}
         ORDER BY ai.created_at DESC
         LIMIT $${params.length}`,
      params,
    )
    res.json({ rows })
  } catch (err) { next(err) }
})

export default router

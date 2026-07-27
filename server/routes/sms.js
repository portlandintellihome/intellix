// Client SMS routes. Two audiences:
//   - Techs (JWT auth): POST /on-the-way, POST /scheduled fire a text now.
//   - The external cron (X-Internal-Key): GET/POST /process-due flushes the
//     outbox (24h review sends + quiet-hours-deferred completion/review texts).
// The "completed" + delayed "review" texts are fired from routes/jobs.js on the
// status→completed transition, not here.

import { Router } from 'express'
import { query as defaultQuery } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import {
  isSmsConfigured, processDue, onJobOnTheWay, onJobScheduled,
} from '../services/sms.js'

function requireInternalKey(req, res, next) {
  const expected = process.env.INTELLIX_INTERNAL_KEY
  if (!expected) return res.status(503).json({ error: 'INTELLIX_INTERNAL_KEY is not configured on the backend' })
  if (req.headers['x-internal-key'] !== expected) {
    return res.status(401).json({ error: 'Invalid or missing internal key' })
  }
  next()
}

export function makeRouter(query = defaultQuery) {
  const r = Router()

  // Whether Twilio is wired. Safe to expose (boolean only) so Settings can show
  // an "SMS not configured" hint.
  r.get('/status', async (_req, res) => {
    res.json({ configured: isSmsConfigured() })
  })

  // Cron entrypoint — flush everything now due. GET and POST both accepted.
  const flush = async (_req, res, next) => {
    try {
      const summary = await processDue(query, {})
      res.json({ ok: true, ...summary })
    } catch (err) { next(err) }
  }
  r.get('/process-due', requireInternalKey, flush)
  r.post('/process-due', requireInternalKey, flush)

  // Tech taps "On the way" in the header. Not automatic. Includes ETA if given.
  r.post('/on-the-way', requireAuth, async (req, res, next) => {
    try {
      const jobId = req.body?.job_id
      if (!jobId) return res.status(400).json({ error: 'job_id is required' })
      const u = await query('SELECT name FROM users WHERE id = $1', [req.user.id])
      const employee_name = u.rows[0]?.name || ''
      const msg = await onJobOnTheWay(query, jobId, { employee_name, eta: req.body?.eta || '' })
      if (!msg) return res.status(404).json({ error: 'Job or client not found' })
      res.json({ ok: true, message: msg })
    } catch (err) { next(err) }
  })

  // Fired by the Calendar when a job is given a date/assignment.
  r.post('/scheduled', requireAuth, async (req, res, next) => {
    try {
      const jobId = req.body?.job_id
      if (!jobId) return res.status(400).json({ error: 'job_id is required' })
      const msg = await onJobScheduled(query, jobId)
      if (!msg) return res.status(404).json({ error: 'Job or client not found' })
      res.json({ ok: true, message: msg })
    } catch (err) { next(err) }
  })

  return r
}

const router = Router()
router.use(makeRouter())
export default router

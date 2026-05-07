// Google review check-in routes. Distinct from /api/check-ins (the
// recurring client check-in feature) — this one drives the post-job
// "How's your IntelliHome system working?" follow-up.
//
//   GET  /api/checkins/due           — jobs ready to receive the email
//   POST /api/checkins/:job_id/sent  — mark a job as sent
//
// Both endpoints are intended for the n8n workflow runner (or any other
// internal automation), so they're protected by a shared-secret header
// (X-Internal-Key matching INTELLIX_INTERNAL_KEY) rather than the user
// JWT auth used elsewhere.

import { Router } from 'express'
import { query } from '../db.js'

const router = Router()

function requireInternalKey(req, res, next) {
  const expected = process.env.INTELLIX_INTERNAL_KEY
  if (!expected) {
    return res.status(503).json({ error: 'INTELLIX_INTERNAL_KEY is not configured on the backend' })
  }
  const got = req.headers['x-internal-key']
  if (got !== expected) {
    return res.status(401).json({ error: 'Invalid or missing internal key' })
  }
  next()
}

function firstName(fullName) {
  if (!fullName) return 'there'
  const part = String(fullName).trim().split(/\s+/)[0]
  return part || 'there'
}

function substitute(template, values) {
  if (!template) return ''
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) =>
    values[key] != null ? String(values[key]) : `{{${key}}}`
  )
}

// GET /api/checkins/due
router.get('/due', requireInternalKey, async (_req, res, next) => {
  try {
    const settingsRes = await query('SELECT * FROM settings WHERE id = 1')
    const settings = settingsRes.rows[0] || {}
    const delayDays = Number.isFinite(Number(settings.checkin_delay_days))
      ? Number(settings.checkin_delay_days) : 3
    const reviewUrl = settings.google_review_url || settings.google_review_link || ''
    const subjectTpl = settings.checkin_email_subject || "How's your IntelliHome system working?"
    const bodyTpl = settings.checkin_email_body || ''
    const supportUrl = (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '') + '/support'

    const { rows } = await query(
      `SELECT j.id           AS job_id,
              j.name         AS job_name,
              j.address      AS job_address,
              j.completed_at,
              c.id           AS client_id,
              c.name         AS client_name,
              c.email        AS client_email,
              c.address      AS client_address
         FROM jobs j
         JOIN clients c ON c.id = j.client_id
        WHERE j.status = 'Complete'
          AND j.completed_at IS NOT NULL
          AND j.completed_at < NOW() - ($1::int * INTERVAL '1 day')
          AND j.checkin_sent_at IS NULL
          AND COALESCE(c.ai_opt_out, FALSE) = FALSE
          AND c.email IS NOT NULL
          AND c.email <> ''
        ORDER BY j.completed_at ASC`,
      [delayDays],
    )

    const result = rows.map(r => {
      const values = {
        first_name: firstName(r.client_name),
        full_name: r.client_name || '',
        address: r.client_address || r.job_address || '',
        review_url: reviewUrl,
        support_url: supportUrl,
        job_name: r.job_name || '',
      }
      return {
        job_id: r.job_id,
        client_id: r.client_id,
        client_name_first: values.first_name,
        client_email: r.client_email,
        client_address: values.address,
        completed_at: r.completed_at,
        subject: substitute(subjectTpl, values),
        html_body: substitute(bodyTpl, values),
      }
    })

    res.json({
      delay_days: delayDays,
      configured: Boolean(reviewUrl) && Boolean(bodyTpl),
      count: result.length,
      jobs: result,
    })
  } catch (err) { next(err) }
})

// POST /api/checkins/:job_id/sent
router.post('/:job_id/sent', requireInternalKey, async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE jobs SET checkin_sent_at = NOW()
         WHERE id = $1
         RETURNING id, checkin_sent_at`,
      [req.params.job_id],
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Job not found' })
    res.json(rows[0])
  } catch (err) { next(err) }
})

export default router

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
import { generateCheckinEmail, isAIConfigured } from '../services/aiProcessor.js'

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
    const tone = settings.checkin_tone || 'warm'
    // Static template kept ONLY as a fallback when AI generation isn't
    // available/fails (so the n8n batch still sends something sensible).
    const subjectTpl = settings.checkin_email_subject || "How's your IntelliHome system working?"
    const bodyTpl = settings.checkin_email_body || ''
    const supportUrl = (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '') + '/support'
    const aiOn = isAIConfigured()

    const { rows } = await query(
      `SELECT j.id           AS job_id,
              j.name         AS job_name,
              j.address      AS job_address,
              j.scope        AS job_scope,
              j.assigned     AS job_assigned,
              j.completed_at,
              j.location_id  AS job_location_id,
              c.id           AS client_id,
              c.name         AS client_name,
              c.email        AS client_email,
              c.address      AS client_address,
              c.notes        AS client_notes,
              loc.id         AS location_id,
              loc.name       AS location_name,
              loc.support_phone AS location_phone,
              loc.support_email AS location_email,
              loc.google_review_url AS location_review_url
         FROM jobs j
         JOIN clients c ON c.id = j.client_id
         LEFT JOIN locations loc ON loc.id = j.location_id
        WHERE j.status = 'completed'
          AND j.completed_at IS NOT NULL
          AND j.completed_at < NOW() - ($1::int * INTERVAL '1 day')
          AND j.checkin_sent_at IS NULL
          AND COALESCE(c.ai_opt_out, FALSE) = FALSE
          AND c.email IS NOT NULL
          AND c.email <> ''
        ORDER BY j.completed_at ASC`,
      [delayDays],
    )

    const skipped = []
    const result = []
    for (const r of rows) {
      const reviewUrl = r.location_review_url || ''
      if (!reviewUrl) {
        console.warn('[checkins] skipping job', {
          job_id: r.job_id,
          reason: 'location has no google_review_url',
          location_id: r.job_location_id,
          location_name: r.location_name,
        })
        skipped.push({
          job_id: r.job_id,
          location_id: r.job_location_id,
          location_name: r.location_name,
          reason: 'location has no google_review_url',
        })
        continue
      }
      const values = {
        first_name: firstName(r.client_name),
        full_name: r.client_name || '',
        address: r.client_address || r.job_address || '',
        review_url: reviewUrl,
        support_url: supportUrl,
        job_name: r.job_name || '',
        location_name: r.location_name || '',
      }

      // Days since install, for the AI prompt.
      const daysSince = r.completed_at
        ? Math.max(1, Math.round((Date.now() - new Date(r.completed_at).getTime()) / 86400000))
        : null

      // Per-send AI personalization. Falls back to the static template if AI
      // is unconfigured or generation fails, so the n8n batch never breaks.
      let subject = substitute(subjectTpl, values)
      let html_body = substitute(bodyTpl, values)
      let source = 'template'
      if (aiOn) {
        try {
          const gen = await generateCheckinEmail({
            client: { id: r.client_id, name: r.client_name, address: values.address },
            job: { id: r.job_id, name: r.job_name, scope: r.job_scope, notes: r.client_notes, assigned: r.job_assigned },
            location: {
              name: r.location_name,
              phone: r.location_phone,
              email: r.location_email,
              google_review_url: reviewUrl,
            },
            days_since_install: daysSince,
            tone,
          })
          subject = gen.subject
          html_body = gen.html_body
          source = 'ai'
          // Audit log of the email we're handing to the sender.
          await query(
            `INSERT INTO checkin_emails_sent (job_id, client_id, subject, html_body) VALUES ($1,$2,$3,$4)`,
            [r.job_id, r.client_id, subject, html_body],
          ).catch(logErr => console.error('[checkins] failed to log sent email', logErr?.message))
        } catch (genErr) {
          console.error('[checkins] AI generation failed; using template fallback', { job_id: r.job_id, error: genErr?.message })
        }
      }

      result.push({
        job_id: r.job_id,
        client_id: r.client_id,
        location_id: r.location_id,
        location_name: r.location_name,
        client_name_first: values.first_name,
        client_email: r.client_email,
        client_address: values.address,
        completed_at: r.completed_at,
        source,
        subject,
        html_body,
      })
    }

    res.json({
      delay_days: delayDays,
      ai_personalized: aiOn,
      configured: aiOn || Boolean(bodyTpl),
      count: result.length,
      skipped_count: skipped.length,
      skipped,
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

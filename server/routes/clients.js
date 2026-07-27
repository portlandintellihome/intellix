import { Router } from 'express'
import { query } from '../db.js'

const router = Router()

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM clients ORDER BY created_at DESC')
    res.json(rows)
  } catch (err) { next(err) }
})

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM clients WHERE id = $1', [req.params.id])
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err) { next(err) }
})

// General PATCH for the columns the UI lets users edit. Distinct from
// the specialized /homedoc and /plan handlers below, which keep their
// own validation paths.
const PATCHABLE = ['name', 'email', 'phone', 'address', 'status', 'notes', 'location_id', 'ai_opt_out', 'sms_opt_out']

router.patch('/:id', async (req, res, next) => {
  try {
    const body = req.body || {}
    const setClauses = []
    const values = []
    for (const key of PATCHABLE) {
      if (key in body) {
        let v = body[key]
        if (key === 'location_id') v = (v === '' || v == null) ? null : (Number(v) || null)
        else if (key === 'ai_opt_out' || key === 'sms_opt_out') v = Boolean(v)
        values.push(v)
        setClauses.push(`${key} = $${values.length}`)
      }
    }
    // When SMS opt-out is toggled, stamp/clear the timestamp alongside it.
    if ('sms_opt_out' in body) {
      setClauses.push(body.sms_opt_out ? 'sms_opt_out_at = NOW()' : 'sms_opt_out_at = NULL')
    }
    if (setClauses.length === 0) {
      const { rows } = await query('SELECT * FROM clients WHERE id = $1', [req.params.id])
      if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
      return res.json(rows[0])
    }
    values.push(req.params.id)
    const { rows } = await query(
      `UPDATE clients SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values,
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
    // Opting a client out also cancels any texts still queued for them (the
    // delayed review request is the important one to suppress).
    if ('sms_opt_out' in body && Boolean(body.sms_opt_out)) {
      await query(
        `UPDATE sms_messages SET status = 'canceled', error = 'client opted out of SMS'
           WHERE client_id = $1 AND status = 'queued'`,
        [req.params.id],
      ).catch(err => console.error('[clients] failed to cancel queued SMS', err?.message))
    }
    res.json(rows[0])
  } catch (err) { next(err) }
})

// Per-client SMS audit trail — every text queued/sent/skipped for this client.
router.get('/:id/sms', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, job_id, template_key, to_number, body, status, error, twilio_sid,
              send_after, sent_at, created_at
         FROM sms_messages WHERE client_id = $1
         ORDER BY created_at DESC LIMIT 200`,
      [req.params.id],
    )
    res.json(rows)
  } catch (err) { next(err) }
})

router.patch('/:id/homedoc', async (req, res, next) => {
  try {
    const { homedoc, notes } = req.body || {}
    if (!homedoc || typeof homedoc !== 'object') {
      return res.status(400).json({ error: 'homedoc object is required' })
    }
    const { rows } = await query(
      `UPDATE clients
       SET homedoc = $1,
           notes = COALESCE($2, notes)
       WHERE id = $3
       RETURNING *`,
      [homedoc, typeof notes === 'string' ? notes : null, req.params.id]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err) { next(err) }
})

router.patch('/:id/plan', async (req, res, next) => {
  try {
    const { plan_tier, plan_start_date, plan_renewal_date } = req.body || {}
    if (!plan_tier) return res.status(400).json({ error: 'plan_tier is required' })
    const { rows } = await query(
      `UPDATE clients
       SET plan_tier = $1,
           plan_start_date = $2,
           plan_renewal_date = $3
       WHERE id = $4
       RETURNING *`,
      [plan_tier, plan_start_date || null, plan_renewal_date || null, req.params.id]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err) { next(err) }
})

export default router

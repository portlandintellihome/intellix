import { Router } from 'express'
import { query } from '../db.js'

const router = Router()

const JOB_SELECT = `
  SELECT j.*, c.name AS client_name
  FROM jobs j
  LEFT JOIN clients c ON c.id = j.client_id
`

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query(`${JOB_SELECT} ORDER BY j.created_at DESC`)
    res.json(rows)
  } catch (err) { next(err) }
})

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(`${JOB_SELECT} WHERE j.id = $1`, [req.params.id])
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err) { next(err) }
})

// Patch a job. The only field this handler is feature-aware about is
// `status` — when it transitions to 'Complete' and completed_at is still
// NULL, we stamp completed_at = NOW() so the Google review check-in flow
// can pick the job up at the right time.
const PATCHABLE = ['name', 'client_id', 'address', 'phase', 'status', 'priority', 'scope', 'start_date', 'end_date', 'location_id']

// POST /api/jobs — creates a job and defaults location_id from:
//   1. body.location_id if explicitly provided
//   2. body.proposal_id → proposals.location_id  (job created from accepted proposal)
//   3. body.client_id → clients.location_id      (job created from existing client)
//   4. id = 1 fallback
router.post('/', async (req, res, next) => {
  try {
    const body = req.body || {}
    if (!body.name) return res.status(400).json({ error: 'name is required' })

    let locationId = body.location_id ? Number(body.location_id) : null
    if (!locationId && body.proposal_id) {
      const r = await query('SELECT location_id FROM proposals WHERE id = $1', [body.proposal_id])
      locationId = r.rows[0]?.location_id || null
    }
    if (!locationId && body.client_id) {
      const r = await query('SELECT location_id FROM clients WHERE id = $1', [body.client_id])
      locationId = r.rows[0]?.location_id || null
    }
    if (!locationId) locationId = 1

    const { rows } = await query(
      `INSERT INTO jobs (name, client_id, address, phase, status, priority, scope,
                         start_date, end_date, location_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        body.name, body.client_id || null, body.address || null,
        body.phase || null, body.status || 'Scheduled',
        body.priority || 'Normal', body.scope || null,
        body.start_date || null, body.end_date || null,
        locationId,
      ],
    )
    res.status(201).json(rows[0])
  } catch (err) { next(err) }
})

router.patch('/:id', async (req, res, next) => {
  try {
    const { rows: existing } = await query(
      'SELECT id, status, completed_at FROM jobs WHERE id = $1', [req.params.id],
    )
    if (existing.length === 0) return res.status(404).json({ error: 'Not found' })
    const before = existing[0]

    const body = req.body || {}
    const setClauses = []
    const values = []
    for (const key of PATCHABLE) {
      if (key in body) { values.push(body[key]); setClauses.push(`${key} = $${values.length}`) }
    }

    // Status-transition stamp: only set completed_at on the transition
    // (not every PATCH that happens to include status='Complete').
    const becomingComplete = 'status' in body
      && body.status === 'Complete'
      && before.status !== 'Complete'
      && before.completed_at == null
    if (becomingComplete) setClauses.push('completed_at = NOW()')

    if (setClauses.length === 0) return res.json(before)
    values.push(req.params.id)
    const { rows } = await query(
      `UPDATE jobs SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values,
    )
    res.json(rows[0])
  } catch (err) { next(err) }
})

export default router

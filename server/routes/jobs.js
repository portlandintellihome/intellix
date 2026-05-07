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
const PATCHABLE = ['name', 'client_id', 'address', 'phase', 'status', 'priority', 'scope', 'start_date', 'end_date']

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

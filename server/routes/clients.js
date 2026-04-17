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

router.patch('/:id/intellifile', async (req, res, next) => {
  try {
    const { intellifile, notes } = req.body || {}
    if (!intellifile || typeof intellifile !== 'object') {
      return res.status(400).json({ error: 'intellifile object is required' })
    }
    const { rows } = await query(
      `UPDATE clients
       SET intellifile = $1,
           notes = COALESCE($2, notes)
       WHERE id = $3
       RETURNING *`,
      [intellifile, typeof notes === 'string' ? notes : null, req.params.id]
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

import { Router } from 'express'
import { query } from '../db.js'

const router = Router()

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM check_ins ORDER BY client_id, interval_days')
    res.json(rows)
  } catch (err) { next(err) }
})

// Upsert — records (or re-records) a send for a given client + interval.
router.post('/', async (req, res, next) => {
  try {
    const { client_id, interval_days, scheduled_for } = req.body || {}
    if (!client_id || !interval_days) {
      return res.status(400).json({ error: 'client_id and interval_days are required' })
    }
    const { rows } = await query(
      `INSERT INTO check_ins (client_id, interval_days, scheduled_for, sent_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (client_id, interval_days)
       DO UPDATE SET sent_at = NOW(), scheduled_for = EXCLUDED.scheduled_for
       RETURNING *`,
      [client_id, interval_days, scheduled_for || null]
    )
    res.json(rows[0])
  } catch (err) { next(err) }
})

export default router

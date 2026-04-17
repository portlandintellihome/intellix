import { Router } from 'express'
import { query } from '../db.js'

const router = Router()

const TEAM_COLS = 'id, name, email, role, phone, initials, status, created_at'

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query(`SELECT ${TEAM_COLS} FROM users ORDER BY created_at DESC`)
    res.json(rows)
  } catch (err) { next(err) }
})

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT ${TEAM_COLS} FROM users WHERE id = $1`, [req.params.id])
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err) { next(err) }
})

export default router

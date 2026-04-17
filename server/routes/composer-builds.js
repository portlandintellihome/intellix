import { Router } from 'express'
import { query } from '../db.js'

const router = Router()

const SELECT = `
  SELECT b.*, c.name AS client_name, j.name AS job_name
  FROM composer_builds b
  LEFT JOIN clients c ON c.id = b.client_id
  LEFT JOIN jobs j ON j.id = b.job_id
`

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query(`${SELECT} ORDER BY b.created_at DESC`)
    res.json(rows)
  } catch (err) { next(err) }
})

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(`${SELECT} WHERE b.id = $1`, [req.params.id])
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err) { next(err) }
})

export default router

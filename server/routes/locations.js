import { Router } from 'express'

import { query } from '../db.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

const router = Router()

const FIELDS = ['name', 'slug', 'google_review_url', 'support_email', 'support_phone', 'address']

function slugify(s) {
  return String(s || '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM locations ORDER BY id ASC')
    res.json(rows)
  } catch (err) { next(err) }
})

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM locations WHERE id = $1', [req.params.id])
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err) { next(err) }
})

router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const body = req.body || {}
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return res.status(400).json({ error: 'name is required' })
    const slug = (typeof body.slug === 'string' && body.slug.trim()) ? slugify(body.slug) : slugify(name)
    const { rows } = await query(
      `INSERT INTO locations (name, slug, google_review_url, support_email, support_phone, address)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        name, slug,
        body.google_review_url || null,
        body.support_email || null,
        body.support_phone || null,
        body.address || null,
      ],
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A location with that slug already exists' })
    }
    next(err)
  }
})

router.patch('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const body = req.body || {}
    const setClauses = []
    const values = []
    for (const key of FIELDS) {
      if (key in body) {
        let v = body[key]
        if (key === 'slug' && typeof v === 'string') v = slugify(v)
        if (key === 'name' && typeof v === 'string') v = v.trim()
        values.push(v == null || v === '' ? null : v)
        setClauses.push(`${key} = $${values.length}`)
      }
    }
    if (setClauses.length === 0) {
      const { rows } = await query('SELECT * FROM locations WHERE id = $1', [req.params.id])
      if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
      return res.json(rows[0])
    }
    values.push(req.params.id)
    const { rows } = await query(
      `UPDATE locations SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values,
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A location with that slug already exists' })
    }
    next(err)
  }
})

router.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const refs = await query(
      `SELECT
         (SELECT COUNT(*)::int FROM clients   WHERE location_id = $1) AS clients,
         (SELECT COUNT(*)::int FROM jobs      WHERE location_id = $1) AS jobs,
         (SELECT COUNT(*)::int FROM proposals WHERE location_id = $1) AS proposals`,
      [id],
    )
    const { clients, jobs, proposals } = refs.rows[0]
    if (clients + jobs + proposals > 0) {
      return res.status(409).json({
        error: 'Location is in use and cannot be deleted',
        references: { clients, jobs, proposals },
      })
    }
    const del = await query('DELETE FROM locations WHERE id = $1 RETURNING id', [id])
    if (del.rows.length === 0) return res.status(404).json({ error: 'Not found' })
    res.json({ deleted: true, id })
  } catch (err) { next(err) }
})

export default router

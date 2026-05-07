import { Router } from 'express'
import { query } from '../db.js'

const router = Router()

const SELECT = `
  SELECT p.*, c.name AS client_name
  FROM proposals p
  LEFT JOIN clients c ON c.id = p.client_id
`

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query(`${SELECT} ORDER BY p.created_at DESC`)
    res.json(rows)
  } catch (err) { next(err) }
})

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(`${SELECT} WHERE p.id = $1`, [req.params.id])
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err) { next(err) }
})

const PATCHABLE = ['client_id', 'portal_id', 'address', 'scope', 'devices', 'rooms',
  'labor', 'materials', 'total', 'status', 'assigned_to', 'location_id']

// POST /api/proposals — defaults location_id from client.location_id if
// not explicitly provided, falling back to id=1.
router.post('/', async (req, res, next) => {
  try {
    const body = req.body || {}
    let locationId = body.location_id ? Number(body.location_id) : null
    if (!locationId && body.client_id) {
      const r = await query('SELECT location_id FROM clients WHERE id = $1', [body.client_id])
      locationId = r.rows[0]?.location_id || null
    }
    if (!locationId) locationId = 1

    const { rows } = await query(
      `INSERT INTO proposals (client_id, portal_id, address, scope, devices, rooms,
                              labor, materials, total, status, assigned_to, location_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        body.client_id || null, body.portal_id || null, body.address || null,
        body.scope || null, body.devices || null, body.rooms || null,
        body.labor || null, body.materials || null, body.total || null,
        body.status || 'Draft', body.assigned_to || null, locationId,
      ],
    )
    res.status(201).json(rows[0])
  } catch (err) { next(err) }
})

router.patch('/:id', async (req, res, next) => {
  try {
    const body = req.body || {}
    const setClauses = []
    const values = []
    for (const key of PATCHABLE) {
      if (key in body) {
        let v = body[key]
        if (key === 'location_id') v = (v === '' || v == null) ? null : (Number(v) || null)
        values.push(v)
        setClauses.push(`${key} = $${values.length}`)
      }
    }
    if (setClauses.length === 0) {
      const { rows } = await query(`${SELECT} WHERE p.id = $1`, [req.params.id])
      if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
      return res.json(rows[0])
    }
    values.push(req.params.id)
    const { rows } = await query(
      `UPDATE proposals SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values,
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err) { next(err) }
})

export default router

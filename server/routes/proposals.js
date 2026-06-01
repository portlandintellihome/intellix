import { Router } from 'express'
import { query as defaultQuery } from '../db.js'

const router = Router()

const SELECT = `
  SELECT p.*, c.name AS client_name
  FROM proposals p
  LEFT JOIN clients c ON c.id = p.client_id
`

// Columns a client may set on create/update. Every entry here MUST exist as a
// real column on the proposals table (see server/db/schema.sql). location_id
// is added via ALTER in schema.sql, so a database that has not been migrated
// will be missing it — see normalizeError() below, which turns the resulting
// Postgres 42703 ("undefined_column") into an actionable 400 instead of an
// opaque 500.
const PATCHABLE = ['client_id', 'portal_id', 'address', 'scope', 'devices', 'rooms',
  'labor', 'materials', 'total', 'status', 'assigned_to', 'location_id']

// Map low-level DB errors to a clear client response + a loud server log,
// so a schema/migration drift on the deployed DB is diagnosable from the
// 400 body rather than hidden behind a generic 500.
function normalizeError(err, res) {
  // 42703 undefined_column, 42P01 undefined_table — almost always a pending
  // migration on the target database.
  if (err && (err.code === '42703' || err.code === '42P01')) {
    console.error('[proposals] schema mismatch — is the DB migrated?', {
      code: err.code, message: err.message,
    })
    return res.status(400).json({
      error: 'Proposal could not be saved: the database schema is out of date (run db:migrate). ' + err.message,
      code: err.code,
    })
  }
  return null
}

export function makeRouter(query = defaultQuery) {
  const r = Router()

  r.get('/', async (_req, res, next) => {
    try {
      const { rows } = await query(`${SELECT} ORDER BY p.created_at DESC`)
      res.json(rows)
    } catch (err) { next(err) }
  })

  r.get('/:id', async (req, res, next) => {
    try {
      const { rows } = await query(`${SELECT} WHERE p.id = $1`, [req.params.id])
      if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
      res.json(rows[0])
    } catch (err) { next(err) }
  })

  // POST /api/proposals — defaults location_id from client.location_id if
  // not explicitly provided, falling back to id=1.
  r.post('/', async (req, res, next) => {
    try {
      const body = req.body || {}
      let locationId = body.location_id ? Number(body.location_id) : null
      if (!locationId && body.client_id) {
        const cr = await query('SELECT location_id FROM clients WHERE id = $1', [body.client_id])
        locationId = cr.rows[0]?.location_id || null
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
    } catch (err) {
      if (normalizeError(err, res)) return
      next(err)
    }
  })

  r.patch('/:id', async (req, res, next) => {
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
    } catch (err) {
      if (normalizeError(err, res)) return
      next(err)
    }
  })

  return r
}

// Default router uses the real db query; tests build their own via makeRouter.
router.use(makeRouter())

export default router
export { PATCHABLE, normalizeError }

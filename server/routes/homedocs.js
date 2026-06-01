import { Router } from 'express'
import { query as defaultQuery } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { generateDocument, DOC_TYPES } from '../services/aiProcessor.js'

const SELECT = `
  SELECT h.*, c.name AS client_name, j.name AS job_name, u.name AS generated_by_name
  FROM homedocs h
  LEFT JOIN clients c ON c.id = h.client_id
  LEFT JOIN jobs    j ON j.id = h.job_id
  LEFT JOIN users   u ON u.id = h.generated_by_user_id
`

// Same diagnostic pattern as the proposals route: turn a missing-column /
// missing-table DB error into an actionable 400 instead of an opaque 500.
function normalizeError(err, res) {
  if (err && (err.code === '42703' || err.code === '42P01')) {
    console.error('[homedocs] schema mismatch — is the DB migrated?', { code: err.code, message: err.message })
    return res.status(400).json({
      error: 'Could not save document: the database schema is out of date (run db:migrate). ' + err.message,
      code: err.code,
    })
  }
  return null
}

// deps lets tests inject { query, generate }. Production uses the real ones.
export function makeRouter({ query = defaultQuery, generate = generateDocument } = {}) {
  const r = Router()

  // POST /api/homedocs/generate — generate + persist a document.
  r.post('/generate', requireAuth, async (req, res, next) => {
    try {
      const { client_id, job_id = null, doc_type, form_data = {}, details_text = '' } = req.body || {}

      if (!DOC_TYPES.includes(doc_type)) {
        return res.status(400).json({ error: `doc_type must be one of: ${DOC_TYPES.join(', ')}` })
      }
      if (!client_id) {
        return res.status(400).json({ error: 'client_id is required' })
      }

      let html
      try {
        const out = await generate(doc_type, {
          form_data, details_text,
          userId: req.user?.id ?? null,
          clientId: client_id,
          jobId: job_id,
        })
        html = out.html
      } catch (genErr) {
        // Surface AI-layer errors with their intended status (opt_out/blocked/
        // missing_key/upstream) rather than a blanket 500.
        const status = genErr.status || (genErr.code === 'missing_key' ? 503 : 502)
        return res.status(status).json({ error: genErr.message, code: genErr.code })
      }

      const { rows: inserted } = await query(
        `INSERT INTO homedocs
           (client_id, job_id, doc_type, form_data, details_text, generated_html, generated_by_user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id`,
        [client_id, job_id || null, doc_type, form_data || {}, details_text || null, html, req.user?.id ?? null],
      )
      const { rows } = await query(`${SELECT} WHERE h.id = $1`, [inserted[0].id])
      res.status(201).json(rows[0])
    } catch (err) {
      if (normalizeError(err, res)) return
      next(err)
    }
  })

  // GET /api/homedocs?client_id=X — list, newest first.
  r.get('/', requireAuth, async (req, res, next) => {
    try {
      const params = []
      let where = ''
      if (req.query.client_id) {
        params.push(Number(req.query.client_id))
        where = `WHERE h.client_id = $${params.length}`
      }
      const { rows } = await query(`${SELECT} ${where} ORDER BY h.created_at DESC`, params)
      res.json(rows)
    } catch (err) {
      if (normalizeError(err, res)) return
      next(err)
    }
  })

  // GET /api/homedocs/:id — single doc (incl. generated_html).
  r.get('/:id', requireAuth, async (req, res, next) => {
    try {
      const { rows } = await query(`${SELECT} WHERE h.id = $1`, [req.params.id])
      if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
      res.json(rows[0])
    } catch (err) {
      if (normalizeError(err, res)) return
      next(err)
    }
  })

  // DELETE /api/homedocs/:id — admin OR the user who generated it.
  r.delete('/:id', requireAuth, async (req, res, next) => {
    try {
      const { rows } = await query('SELECT generated_by_user_id FROM homedocs WHERE id = $1', [req.params.id])
      if (rows.length === 0) return res.status(404).json({ error: 'Not found' })

      const isOwner = rows[0].generated_by_user_id === req.user?.id
      let isAdmin = false
      if (!isOwner) {
        const u = await query('SELECT role FROM users WHERE id = $1', [req.user?.id])
        isAdmin = u.rows[0]?.role === 'Admin'
      }
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: 'Only an admin or the document creator can delete this.' })
      }

      await query('DELETE FROM homedocs WHERE id = $1', [req.params.id])
      res.json({ ok: true, id: Number(req.params.id) })
    } catch (err) {
      if (normalizeError(err, res)) return
      next(err)
    }
  })

  return r
}

const router = Router()
router.use(makeRouter())
export default router

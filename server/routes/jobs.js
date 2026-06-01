import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { Router } from 'express'
import multer from 'multer'
import { query as defaultQuery } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

// Job photos share the same /uploads volume as support photos, in a jobs/
// subdirectory. Resolution mirrors support.js so the static mount in
// index.js serves them at /uploads/jobs/<file>.
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.join(path.dirname(process.env.UPLOAD_DIR), 'jobs')
  : (fs.existsSync('/uploads') ? '/uploads/jobs' : path.resolve(process.cwd(), 'uploads', 'jobs'))

try {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
} catch (err) {
  console.error('[jobs] failed to create upload dir', UPLOAD_DIR, err.message)
}

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/heif'])
const ALLOWED_EXT  = new Set(['.jpg', '.jpeg', '.png', '.heic', '.heif'])
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase()
      const safeExt = ALLOWED_EXT.has(ext) ? ext : '.bin'
      cb(null, `${crypto.randomUUID()}${safeExt}`)
    },
  }),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true)
    cb(new Error('Only JPG, PNG, or HEIC images are allowed'))
  },
})

const JOB_SELECT = `
  SELECT j.*, c.name AS client_name
  FROM jobs j
  LEFT JOIN clients c ON c.id = j.client_id
`

// Canonical job lifecycle. `phase` is deprecated (see schema.sql) — status is
// the single source of truth for where a job is in its lifecycle.
//   pending | scheduled | in_progress | completed | cancelled
const PATCHABLE = ['name', 'client_id', 'address', 'status', 'priority', 'scope', 'start_date', 'end_date', 'location_id']

export function makeRouter(query = defaultQuery) {
  const r = Router()

  r.get('/', async (_req, res, next) => {
    try {
      const { rows } = await query(`${JOB_SELECT} ORDER BY j.created_at DESC`)
      res.json(rows)
    } catch (err) { next(err) }
  })

  r.get('/:id', async (req, res, next) => {
    try {
      const { rows } = await query(`${JOB_SELECT} WHERE j.id = $1`, [req.params.id])
      if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
      res.json(rows[0])
    } catch (err) { next(err) }
  })

  // POST /api/jobs — creates a job and defaults location_id from:
  //   1. body.location_id if explicitly provided
  //   2. body.proposal_id → proposals.location_id  (job created from accepted proposal)
  //   3. body.client_id → clients.location_id      (job created from existing client)
  //   4. id = 1 fallback
  r.post('/', async (req, res, next) => {
    try {
      const body = req.body || {}
      if (!body.name) return res.status(400).json({ error: 'name is required' })

      let locationId = body.location_id ? Number(body.location_id) : null
      if (!locationId && body.proposal_id) {
        const pr = await query('SELECT location_id FROM proposals WHERE id = $1', [body.proposal_id])
        locationId = pr.rows[0]?.location_id || null
      }
      if (!locationId && body.client_id) {
        const cr = await query('SELECT location_id FROM clients WHERE id = $1', [body.client_id])
        locationId = cr.rows[0]?.location_id || null
      }
      if (!locationId) locationId = 1

      const { rows } = await query(
        `INSERT INTO jobs (name, client_id, address, status, priority, scope,
                           start_date, end_date, location_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          body.name, body.client_id || null, body.address || null,
          body.status || 'pending',
          body.priority || 'Normal', body.scope || null,
          body.start_date || null, body.end_date || null,
          locationId,
        ],
      )
      res.status(201).json(rows[0])
    } catch (err) { next(err) }
  })

  // Patch a job. The only field this handler is feature-aware about is
  // `status` — when it transitions to 'completed' and completed_at is still
  // NULL, we stamp completed_at = NOW() so the Google review check-in flow
  // can pick the job up at the right time.
  r.patch('/:id', async (req, res, next) => {
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
      // (not every PATCH that happens to include status='completed').
      const becomingComplete = 'status' in body
        && body.status === 'completed'
        && before.status !== 'completed'
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

  // --- Job photos -----------------------------------------------------------

  // GET /api/jobs/:id/photos — list photos for a job, newest first.
  r.get('/:id/photos', requireAuth, async (req, res, next) => {
    try {
      const { rows } = await query(
        `SELECT p.*, u.name AS uploaded_by_name
           FROM job_photos p
           LEFT JOIN users u ON u.id = p.uploaded_by_user_id
          WHERE p.job_id = $1
          ORDER BY p.created_at DESC`,
        [req.params.id],
      )
      res.json(rows)
    } catch (err) { next(err) }
  })

  // POST /api/jobs/:id/photos — upload one photo (multipart, field "photo").
  r.post('/:id/photos', requireAuth, (req, res, next) => {
    upload.single('photo')(req, res, async (uploadErr) => {
      try {
        if (uploadErr) {
          if (uploadErr.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'Photo must be 10 MB or smaller.' })
          }
          return res.status(400).json({ error: uploadErr.message || 'Upload failed' })
        }
        if (!req.file) return res.status(400).json({ error: 'No photo uploaded' })

        const job = await query('SELECT id FROM jobs WHERE id = $1', [req.params.id])
        if (job.rows.length === 0) {
          // Clean up the orphaned upload before bailing.
          fs.unlink(req.file.path, () => {})
          return res.status(404).json({ error: 'Job not found' })
        }

        const filePath = `/uploads/jobs/${req.file.filename}`
        const { rows } = await query(
          `INSERT INTO job_photos (job_id, file_path, uploaded_by_user_id)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [req.params.id, filePath, req.user?.id ?? null],
        )
        res.status(201).json(rows[0])
      } catch (err) { next(err) }
    })
  })

  // DELETE /api/jobs/:id/photos/:photo_id — admin OR the uploader may delete.
  r.delete('/:id/photos/:photo_id', requireAuth, async (req, res, next) => {
    try {
      const { rows } = await query(
        'SELECT * FROM job_photos WHERE id = $1 AND job_id = $2',
        [req.params.photo_id, req.params.id],
      )
      if (rows.length === 0) return res.status(404).json({ error: 'Photo not found' })
      const photo = rows[0]

      const isUploader = photo.uploaded_by_user_id === req.user?.id
      let isAdmin = false
      if (!isUploader) {
        const u = await query('SELECT role FROM users WHERE id = $1', [req.user?.id])
        isAdmin = u.rows[0]?.role === 'Admin'
      }
      if (!isUploader && !isAdmin) {
        return res.status(403).json({ error: 'Only an admin or the uploader can delete this photo.' })
      }

      await query('DELETE FROM job_photos WHERE id = $1', [photo.id])
      // Best-effort file cleanup; the row is already gone either way.
      const abs = path.join(path.dirname(UPLOAD_DIR), 'jobs', path.basename(photo.file_path))
      fs.unlink(abs, () => {})
      res.json({ ok: true, id: photo.id })
    } catch (err) { next(err) }
  })

  return r
}

// Default router uses the real db query; tests build their own via makeRouter.
const router = Router()
router.use(makeRouter())

export default router
export { PATCHABLE }

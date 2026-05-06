// Public support intake. Mounted at /api/support — NO requireAuth.
//
// Lifecycle:
//   1. multer parses multipart/form-data, writes any photo to UPLOAD_DIR
//   2. honeypot check — silently accept if "website" field is filled
//   3. rate-limit by IP (in-memory, 3/hour)
//   4. validate required fields
//   5. match an existing client by email → phone → address (first hit wins)
//   6. INSERT support_tickets row with intake_source = 'form' or 'form_unmatched'
//   7. fire-and-forget POST to SUPPORT_INTAKE_WEBHOOK_URL if set
//   8. return { ticket_id, reference_number, client_matched }

import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { Router } from 'express'
import multer from 'multer'

import { query } from '../db.js'

const router = Router()

// Persistent volume on Railway is conventionally mounted at /uploads.
// Override with UPLOAD_DIR env var if Railway uses a different mount path.
// On local dev fall back to a repo-relative directory.
const UPLOAD_DIR = process.env.UPLOAD_DIR
  || (fs.existsSync('/uploads') ? '/uploads/support' : path.resolve(process.cwd(), 'uploads', 'support'))

try {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
} catch (err) {
  console.error('[support] failed to create upload dir', UPLOAD_DIR, err.message)
}

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/heif'])
const ALLOWED_EXT  = new Set(['.jpg', '.jpeg', '.png', '.heic', '.heif'])
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase()
    const safeExt = ALLOWED_EXT.has(ext) ? ext : '.bin'
    cb(null, `${crypto.randomUUID()}${safeExt}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true)
    cb(new Error('Only JPG, PNG, or HEIC images are allowed'))
  },
})

// --- in-memory rate limiter: 3 submissions per IP per rolling hour ----------

const RATE_LIMIT = 3
const WINDOW_MS = 60 * 60 * 1000
const ipHits = new Map() // ip → number[] timestamps

function rateCheck(ip) {
  const now = Date.now()
  const cutoff = now - WINDOW_MS
  const arr = (ipHits.get(ip) || []).filter(t => t > cutoff)
  if (arr.length >= RATE_LIMIT) {
    ipHits.set(ip, arr)
    return false
  }
  arr.push(now)
  ipHits.set(ip, arr)
  return true
}

// Periodic cleanup so the map doesn't grow unbounded.
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS
  for (const [ip, arr] of ipHits) {
    const fresh = arr.filter(t => t > cutoff)
    if (fresh.length === 0) ipHits.delete(ip)
    else ipHits.set(ip, fresh)
  }
}, 10 * 60 * 1000).unref?.()

// --- helpers ----------------------------------------------------------------

function generateReference() {
  // INT-XXXXXXXX (8 hex chars) — short enough to read aloud, large enough
  // to make collisions vanishingly rare for the volume we expect.
  return `INT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
}

function normalizePhone(s) {
  return String(s || '').replace(/\D/g, '')
}

async function findExistingClient({ email, phone, address }) {
  // 1. Exact email match (case-insensitive).
  if (email) {
    const r = await query('SELECT id FROM clients WHERE LOWER(email) = LOWER($1) LIMIT 1', [email])
    if (r.rows[0]) return { id: r.rows[0].id, matched_on: 'email' }
  }
  // 2. Phone digits match — strip non-digits both sides.
  const digits = normalizePhone(phone)
  if (digits.length >= 7) {
    const r = await query(
      `SELECT id FROM clients
         WHERE regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') = $1
         LIMIT 1`,
      [digits],
    )
    if (r.rows[0]) return { id: r.rows[0].id, matched_on: 'phone' }
  }
  // 3. Address — case-insensitive exact match.
  if (address) {
    const r = await query(
      'SELECT id FROM clients WHERE LOWER(address) = LOWER($1) LIMIT 1',
      [address],
    )
    if (r.rows[0]) return { id: r.rows[0].id, matched_on: 'address' }
  }
  return null
}

async function fireWebhook(payload) {
  const url = process.env.SUPPORT_INTAKE_WEBHOOK_URL
  if (!url) return
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      console.warn('[support] webhook non-2xx', { status: res.status, url })
    }
  } catch (err) {
    console.warn('[support] webhook failed', err.message)
  }
}

// --- POST /api/support/intake ----------------------------------------------

router.post('/intake', (req, res, next) => {
  upload.single('photo')(req, res, async (uploadErr) => {
    try {
      if (uploadErr) {
        if (uploadErr.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'Photo must be 5MB or smaller.' })
        }
        return res.status(400).json({ error: uploadErr.message || 'Upload failed' })
      }

      const ip = (req.headers['x-forwarded-for']?.split(',')[0]?.trim()) || req.ip || 'unknown'

      // 1. Honeypot — silently succeed without touching the DB.
      if (req.body.website && String(req.body.website).trim() !== '') {
        if (req.file) fs.unlink(req.file.path, () => {})
        console.log('[support] honeypot tripped', { ip })
        return res.status(200).json({
          ticket_id: null,
          reference_number: generateReference(),
          client_matched: false,
        })
      }

      // 2. Rate limit per IP.
      if (!rateCheck(ip)) {
        if (req.file) fs.unlink(req.file.path, () => {})
        return res.status(429).json({ error: 'Too many submissions from this network. Try again in an hour.' })
      }

      // 3. Required-field validation.
      const name    = String(req.body.name || '').trim()
      const email   = String(req.body.email || '').trim()
      const phone   = String(req.body.phone || '').trim()
      const address = String(req.body.address || '').trim()
      const issue   = String(req.body.issue || '').trim()

      const missing = []
      if (!name)    missing.push('name')
      if (!email)   missing.push('email')
      if (!phone)   missing.push('phone')
      if (!address) missing.push('address')
      if (!issue)   missing.push('issue')
      if (missing.length) {
        if (req.file) fs.unlink(req.file.path, () => {})
        return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` })
      }
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        if (req.file) fs.unlink(req.file.path, () => {})
        return res.status(400).json({ error: 'Email looks invalid.' })
      }

      // 4. Build attachment URL (public path served by express.static).
      let attachmentUrl = null
      if (req.file) {
        attachmentUrl = `/uploads/support/${req.file.filename}`
      }

      // 5. Match existing client.
      const match = await findExistingClient({ email, phone, address })
      const clientMatched = Boolean(match)
      const intakeSource = clientMatched ? 'form' : 'form_unmatched'

      // 6. Generate ticket reference and insert.
      let referenceNumber = generateReference()
      // Guard against the (vanishingly rare) collision on ticket_id UNIQUE.
      for (let attempt = 0; attempt < 3; attempt++) {
        const exists = await query('SELECT 1 FROM support_tickets WHERE ticket_id = $1', [referenceNumber])
        if (exists.rows.length === 0) break
        referenceNumber = generateReference()
      }

      const rawPayload = {
        name, email, phone, address, issue,
        ip,
        user_agent: req.headers['user-agent'] || null,
        matched_on: match?.matched_on || null,
        submitted_at: new Date().toISOString(),
      }

      const insert = await query(
        `INSERT INTO support_tickets
           (ticket_id, client_id, contact, phone, issue, type, priority, status,
            intake_source, contact_name, contact_email, contact_phone,
            contact_address, attachment_url, raw_payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING id, ticket_id`,
        [
          referenceNumber,
          match?.id || null,
          name,            // contact (legacy column — keeps existing UI working)
          phone,           // phone (legacy)
          issue,
          'Public intake',
          'Normal',
          'Open',
          intakeSource,
          name,
          email,
          phone,
          address,
          attachmentUrl,
          rawPayload,
        ],
      )
      const ticketDbId = insert.rows[0].id

      console.log('[support] intake', {
        ticket_id: referenceNumber,
        client_matched: clientMatched,
        matched_on: match?.matched_on,
        has_photo: Boolean(attachmentUrl),
      })

      // 7. Fire webhook (don't block response on it). Field names match the
      // documented intake contract used by downstream integrations
      // (n8n "Support intake flow", etc.) — keep them stable.
      const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`
      const fullAttachmentUrl = attachmentUrl ? `${baseUrl}${attachmentUrl}` : null
      fireWebhook({
        ticket_id: ticketDbId,                 // DB primary key (integer)
        reference_number: referenceNumber,     // user-facing INT-XXXXXXXX
        client_id: match?.id || null,
        client_matched: clientMatched,
        matched_on: match?.matched_on || null,
        contact_name: name,
        contact_email: email,
        contact_phone: phone,
        contact_address: address,
        description: issue,
        attachment_url: fullAttachmentUrl,
        intake_source: intakeSource,
        submitted_at: rawPayload.submitted_at,
      }).catch(() => {})

      return res.status(201).json({
        ticket_id: ticketDbId,
        reference_number: referenceNumber,
        client_matched: clientMatched,
      })
    } catch (err) {
      console.error('[support] intake error', err)
      if (req.file) fs.unlink(req.file.path, () => {})
      next(err)
    }
  })
})

export default router

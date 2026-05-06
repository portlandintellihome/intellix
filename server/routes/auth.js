import crypto from 'node:crypto'
import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { query } from '../db.js'
import { JWT_SECRET, requireAuth, requireAdmin } from '../middleware/auth.js'

const router = Router()

const TOKEN_TTL = '7d'
const BCRYPT_ROUNDS = 10

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_TTL })
}

function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    phone: u.phone,
    initials: u.initials,
    status: u.status,
    must_change_password: u.must_change_password,
  }
}

function computeInitials(name) {
  return (name || '').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}

// Read-aloud-friendly random temp password — no 0/O, 1/l/I confusables.
function generateTempPassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = crypto.randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length]
  return out
}

// TODO: wire up SMTP / Resend / SendGrid. For now we log to the server
// console so a developer can hand-deliver the reset link during setup.
function sendResetEmail({ email, name, resetUrl }) {
  console.log('======= PASSWORD RESET EMAIL (not actually sent) =======')
  console.log('to:      ', email)
  console.log('name:    ', name)
  console.log('reset:   ', resetUrl)
  console.log('=========================================================')
}

router.post('/register', requireAuth, requireAdmin, async (req, res, next) => {
  console.log('[auth:register] request', {
    by_user_id: req.user?.id,
    name: req.body?.name,
    email: req.body?.email,
    role: req.body?.role,
    has_password: Boolean(req.body?.password),
  })
  try {
    const { name, email, password, role } = req.body || {}
    if (!name || !email || !password) {
      console.log('[auth:register] 400 missing field', { name: !!name, email: !!email, password: !!password })
      return res.status(400).json({ error: 'name, email, and password are required' })
    }
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    try {
      const { rows } = await query(
        `INSERT INTO users (name, email, password_hash, role, initials, must_change_password)
         VALUES ($1, $2, $3, COALESCE($4, 'Employee'), $5, FALSE)
         RETURNING *`,
        [name, email.toLowerCase(), hash, role, computeInitials(name)]
      )
      console.log('[auth:register] ok', { id: rows[0].id, email: rows[0].email, role: rows[0].role })
      res.json({ user: publicUser(rows[0]) })
    } catch (err) {
      console.error('[auth:register] db error', {
        code: err?.code, message: err?.message, detail: err?.detail, column: err?.column, table: err?.table,
      })
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Email already registered' })
      }
      if (err.code === '42703') {
        return res.status(500).json({ error: `Schema out of date — users.${err.column || 'column'} is missing. Re-apply server/db/schema.sql on Railway.` })
      }
      throw err
    }
  } catch (err) {
    console.error('[auth:register] error', { name: err?.name, message: err?.message, code: err?.code, stack: err?.stack })
    next(err)
  }
})

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {}
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' })
    }
    const { rows } = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()])
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' })
    const user = rows[0]
    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
    res.json({ token: signToken(user), user: publicUser(user) })
  } catch (err) { next(err) }
})

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.user.id])
    if (rows.length === 0) return res.status(401).json({ error: 'User no longer exists' })
    res.json(publicUser(rows[0]))
  } catch (err) { next(err) }
})

// Admin-only: create a team-member account with a temp password.
router.post('/invite', requireAuth, requireAdmin, async (req, res, next) => {
  console.log('[auth:invite] request', {
    by_user_id: req.user?.id,
    name: req.body?.name,
    email: req.body?.email,
    role: req.body?.role,
    has_password: Boolean(req.body?.password),
    has_phone: Boolean(req.body?.phone),
  })
  try {
    const { name, email, role, password, phone } = req.body || {}
    if (!name || !email || !password) {
      console.log('[auth:invite] 400 missing field', { name: !!name, email: !!email, password: !!password })
      return res.status(400).json({ error: 'name, email, and password are required' })
    }
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    try {
      const { rows } = await query(
        `INSERT INTO users (name, email, password_hash, role, phone, initials, must_change_password)
         VALUES ($1, $2, $3, COALESCE($4, 'Employee'), $5, $6, TRUE)
         RETURNING *`,
        [name, email.toLowerCase(), hash, role, phone || null, computeInitials(name)]
      )
      console.log('[auth:invite] ok', { id: rows[0].id, email: rows[0].email, role: rows[0].role })
      res.json({ user: publicUser(rows[0]) })
    } catch (err) {
      console.error('[auth:invite] db error', {
        code: err?.code, message: err?.message, detail: err?.detail, column: err?.column, table: err?.table,
      })
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Email already registered' })
      }
      if (err.code === '42703') {
        return res.status(500).json({ error: `Schema out of date — users.${err.column || 'column'} is missing. Re-apply server/db/schema.sql on Railway.` })
      }
      throw err
    }
  } catch (err) {
    console.error('[auth:invite] error', { name: err?.name, message: err?.message, code: err?.code, stack: err?.stack })
    next(err)
  }
})

router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body || {}
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'current_password and new_password are required' })
    }
    if (new_password.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' })
    }
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.user.id])
    if (rows.length === 0) return res.status(401).json({ error: 'User no longer exists' })
    const user = rows[0]
    const ok = await bcrypt.compare(current_password, user.password_hash)
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' })
    const newHash = await bcrypt.hash(new_password, BCRYPT_ROUNDS)
    const { rows: updated } = await query(
      `UPDATE users SET password_hash = $1, must_change_password = FALSE WHERE id = $2 RETURNING *`,
      [newHash, req.user.id]
    )
    res.json({ user: publicUser(updated[0]) })
  } catch (err) { next(err) }
})

// Public — start a password-reset flow. Always returns 200 so the
// endpoint doesn't reveal which emails exist.
router.post('/forgot-password', async (req, res, next) => {
  console.log('[auth:forgot] request', { email: req.body?.email })
  try {
    const { email } = req.body || {}
    if (typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'email is required' })
    }
    const lowered = email.toLowerCase().trim()

    const { rows } = await query('SELECT id, name, email FROM users WHERE lower(email) = $1', [lowered])
    if (rows.length > 0) {
      const user = rows[0]
      const token = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      // Invalidate any prior unused tokens for this user (single-active-token policy)
      await query('UPDATE password_reset_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE', [user.id])

      await query(
        `INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)`,
        [token, user.id, expiresAt]
      )

      const baseUrl = process.env.FRONTEND_URL
        || `${req.headers['x-forwarded-proto'] || req.protocol}://${req.get('host')}`
      const resetUrl = `${baseUrl}/reset-password?token=${token}`
      sendResetEmail({ email: user.email, name: user.name, resetUrl })

      console.log('[auth:forgot] token issued', { user_id: user.id, expires_at: expiresAt.toISOString() })
    } else {
      // Match real-flow timing roughly — don't bail instantly when the email is unknown.
      console.log('[auth:forgot] no user; returning generic success')
    }

    res.json({ ok: true, message: 'If that email exists, a reset link has been sent.' })
  } catch (err) {
    console.error('[auth:forgot] error', { name: err?.name, message: err?.message, code: err?.code, stack: err?.stack })
    next(err)
  }
})

// Public — finish a password reset.
router.post('/reset-password', async (req, res, next) => {
  console.log('[auth:reset] request', { has_token: Boolean(req.body?.token), has_password: Boolean(req.body?.new_password) })
  try {
    const { token, new_password } = req.body || {}
    if (!token || !new_password) {
      return res.status(400).json({ error: 'token and new_password are required' })
    }
    if (new_password.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' })
    }

    const { rows } = await query(
      `SELECT token, user_id, expires_at, used FROM password_reset_tokens WHERE token = $1`,
      [token]
    )
    if (rows.length === 0) return res.status(400).json({ error: 'Invalid or expired reset link' })
    const t = rows[0]
    if (t.used) return res.status(400).json({ error: 'This reset link has already been used' })
    if (new Date(t.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This reset link has expired' })
    }

    const newHash = await bcrypt.hash(new_password, BCRYPT_ROUNDS)

    // Update password + clear must_change_password + mark token used.
    await query(
      `UPDATE users SET password_hash = $1, must_change_password = FALSE WHERE id = $2`,
      [newHash, t.user_id]
    )
    await query(`UPDATE password_reset_tokens SET used = TRUE WHERE token = $1`, [token])

    console.log('[auth:reset] ok', { user_id: t.user_id })
    res.json({ ok: true })
  } catch (err) {
    console.error('[auth:reset] error', { name: err?.name, message: err?.message, code: err?.code, stack: err?.stack })
    next(err)
  }
})

// Admin-only — reset an existing team member's password to a temp value
// and force them to change it on next login.
router.post('/admin-reset', requireAuth, requireAdmin, async (req, res, next) => {
  console.log('[auth:admin-reset] request', { by_user_id: req.user?.id, target_user_id: req.body?.user_id })
  try {
    const { user_id } = req.body || {}
    if (!user_id) return res.status(400).json({ error: 'user_id is required' })

    const tempPassword = generateTempPassword(12)
    const hash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS)

    const { rows } = await query(
      `UPDATE users
       SET password_hash = $1, must_change_password = TRUE
       WHERE id = $2
       RETURNING id, name, email, role, phone, initials, status, must_change_password`,
      [hash, user_id]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' })

    // Invalidate any outstanding self-serve reset tokens too.
    await query('UPDATE password_reset_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE', [user_id])

    console.log('[auth:admin-reset] ok', { target_user_id: user_id })
    res.json({ user: rows[0], tempPassword })
  } catch (err) {
    console.error('[auth:admin-reset] error', { name: err?.name, message: err?.message, code: err?.code, stack: err?.stack })
    next(err)
  }
})

export default router

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

export default router

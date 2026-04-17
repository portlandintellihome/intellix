import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { query } from '../db.js'
import { JWT_SECRET, requireAuth } from '../middleware/auth.js'

const router = Router()

const TOKEN_TTL = '7d'
const BCRYPT_ROUNDS = 10

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_TTL })
}

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role }
}

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body || {}
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, and password are required' })
    }
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    try {
      const { rows } = await query(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1, $2, $3, COALESCE($4, 'Employee'))
         RETURNING *`,
        [name, email.toLowerCase(), hash, role]
      )
      const user = rows[0]
      res.json({ token: signToken(user), user: publicUser(user) })
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Email already registered' })
      }
      throw err
    }
  } catch (err) { next(err) }
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

export default router

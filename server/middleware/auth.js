import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { query } from '../db.js'

let secret = process.env.JWT_SECRET
if (!secret) {
  if (process.env.NODE_ENV === 'production') {
    console.error('JWT_SECRET is required in production. Refusing to start.')
    process.exit(1)
  }
  console.warn('JWT_SECRET not set — using an ephemeral dev secret. Tokens invalidate on restart.')
  secret = crypto.randomBytes(32).toString('hex')
}

export const JWT_SECRET = secret

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed token' })
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export async function requireAdmin(req, res, next) {
  try {
    const { rows } = await query('SELECT role FROM users WHERE id = $1', [req.user.id])
    if (rows.length === 0 || rows[0].role !== 'Admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }
    next()
  } catch (err) { next(err) }
}

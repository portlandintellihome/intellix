// Employee clock-in / job-linked time tracking.
//   GET  /api/time-entries/current      — my open punch + today's suggested job
//   POST /api/time-entries/clock-in     — open a punch against a job
//   POST /api/time-entries/clock-out    — close my open punch
//   GET  /api/time-entries?employee_id=&job_id=  — list punches (self, or any for Admin)
//   PATCH/DELETE /api/time-entries/:id  — Admin-only corrections
//
// employee_id references team_members(id) — the team roster. The authenticated
// user (a users row) is mapped to their team_member at clock-in (by email, then
// initials, auto-provisioned if absent). team_members.initials is what
// jobs.assigned (TEXT[] of initials) matches against for the auto-suggest. A
// Technician may clock themselves in/out; only an Admin may edit/delete a past
// entry (edited_by_user_id records the Admin, a users row).

import { Router } from 'express'
import { query as defaultQuery } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const ENTRY_SELECT = `
  SELECT te.*, j.name AS job_name, c.name AS client_name,
         u.name AS employee_name, u.initials AS employee_initials,
         eu.name AS edited_by_name
  FROM time_entries te
  LEFT JOIN jobs j ON j.id = te.job_id
  LEFT JOIN clients c ON c.id = j.client_id
  LEFT JOIN team_members u ON u.id = te.employee_id
  LEFT JOIN users eu ON eu.id = te.edited_by_user_id
`

async function isAdmin(query, userId) {
  const { rows } = await query('SELECT role FROM users WHERE id = $1', [userId])
  return rows[0]?.role === 'Admin'
}

function computeInitials(name) {
  return (name || '').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}

// Look up the team_members row for an authenticated user (users row) WITHOUT
// creating one. Match by email, then initials. Returns { user, member }.
async function findTeamMember(query, userId) {
  const u = (await query('SELECT id, name, email, initials, role, phone FROM users WHERE id = $1', [userId])).rows[0]
  if (!u) return { user: null, member: null }
  let member = null
  if (u.email) {
    member = (await query('SELECT id, initials FROM team_members WHERE lower(email) = lower($1) LIMIT 1', [u.email])).rows[0] || null
  }
  if (!member && u.initials) {
    member = (await query('SELECT id, initials FROM team_members WHERE initials = $1 LIMIT 1', [u.initials])).rows[0] || null
  }
  return { user: u, member }
}

// As above, but provision a team_member from the user when none exists, so a
// clock-in never hard-fails for someone not yet on the roster. Returns
// { id, initials } or null if the user doesn't exist. Used by the action
// endpoints (clock-in/out/current) — NOT by the read-only list.
async function resolveTeamMember(query, userId) {
  const { user, member } = await findTeamMember(query, userId)
  if (!user) return null
  if (member) return member
  const initials = user.initials || computeInitials(user.name)
  console.warn('[time-entries] no team_member for user', { user_id: user.id, email: user.email, provisioning: initials })
  const ins = await query(
    `INSERT INTO team_members (initials, name, role, phone, email) VALUES ($1, $2, $3, $4, $5)
     RETURNING id, initials`,
    [initials, user.name, user.role, user.phone || null, user.email || null])
  return ins.rows[0]
}

// Non-creating team_member id for a user (read-only paths).
async function findTeamMemberId(query, userId) {
  const { member } = await findTeamMember(query, userId)
  return member?.id || null
}

export function makeRouter(query = defaultQuery) {
  const r = Router()

  // My current open punch + a one-tap job suggestion from today's assignment.
  r.get('/current', requireAuth, async (req, res, next) => {
    try {
      const member = await resolveTeamMember(query, req.user.id)
      if (!member) return res.status(401).json({ error: 'User no longer exists' })
      const open = await query(
        `${ENTRY_SELECT} WHERE te.employee_id = $1 AND te.clock_out_at IS NULL
         ORDER BY te.clock_in_at DESC LIMIT 1`, [member.id])
      const entry = open.rows[0] || null

      let suggested = null
      if (!entry) {
        const initials = member.initials
        if (initials) {
          const s = await query(
            `SELECT j.id, j.name, j.address, j.start_date, c.name AS client_name
               FROM jobs j LEFT JOIN clients c ON c.id = j.client_id
              WHERE $1 = ANY(j.assigned)
                AND COALESCE(j.status, 'pending') NOT IN ('completed', 'cancelled')
                AND (j.start_date = CURRENT_DATE OR j.start_date IS NULL)
              ORDER BY (j.start_date = CURRENT_DATE) DESC NULLS LAST, j.start_date DESC NULLS LAST
              LIMIT 1`, [initials])
          suggested = s.rows[0] || null
        }
      }
      res.json({ entry, suggested_job: suggested })
    } catch (err) { next(err) }
  })

  // Open a punch. One open punch per employee at a time.
  r.post('/clock-in', requireAuth, async (req, res, next) => {
    try {
      const member = await resolveTeamMember(query, req.user.id)
      if (!member) return res.status(401).json({ error: 'User no longer exists' })
      const jobId = req.body?.job_id ? Number(req.body.job_id) : null
      const openRes = await query(
        'SELECT id FROM time_entries WHERE employee_id = $1 AND clock_out_at IS NULL LIMIT 1', [member.id])
      if (openRes.rows.length) {
        return res.status(409).json({ error: 'Already clocked in. Clock out first.' })
      }
      const ins = await query(
        `INSERT INTO time_entries (employee_id, job_id, clock_in_at) VALUES ($1, $2, NOW()) RETURNING id`,
        [member.id, jobId])
      const { rows } = await query(`${ENTRY_SELECT} WHERE te.id = $1`, [ins.rows[0].id])
      res.status(201).json(rows[0])
    } catch (err) { next(err) }
  })

  // Close my open punch.
  r.post('/clock-out', requireAuth, async (req, res, next) => {
    try {
      const member = await resolveTeamMember(query, req.user.id)
      if (!member) return res.status(401).json({ error: 'User no longer exists' })
      const { rows } = await query(
        `UPDATE time_entries SET clock_out_at = NOW()
          WHERE id = (SELECT id FROM time_entries WHERE employee_id = $1 AND clock_out_at IS NULL
                      ORDER BY clock_in_at DESC LIMIT 1)
          RETURNING id`, [member.id])
      if (!rows.length) return res.status(404).json({ error: 'Not currently clocked in' })
      const full = await query(`${ENTRY_SELECT} WHERE te.id = $1`, [rows[0].id])
      res.json(full.rows[0])
    } catch (err) { next(err) }
  })

  // List punches. Non-admins can only see their own. Admins may scope to a
  // person via ?user_id=<users.id> (resolved to their team_member) or a raw
  // ?employee_id=<team_members.id>; omit both for everyone.
  r.get('/', requireAuth, async (req, res, next) => {
    try {
      const admin = await isAdmin(query, req.user.id)
      const filters = []
      const params = []
      let teamMemberId = null
      if (!admin) {
        teamMemberId = await findTeamMemberId(query, req.user.id) ?? -1 // self only; -1 = no roster row → empty
      } else if (req.query.user_id) {
        teamMemberId = await findTeamMemberId(query, Number(req.query.user_id)) ?? -1
      } else if (req.query.employee_id) {
        teamMemberId = Number(req.query.employee_id) // raw team_member id
      }
      if (teamMemberId != null) { params.push(teamMemberId); filters.push(`te.employee_id = $${params.length}`) }
      if (req.query.job_id) { params.push(Number(req.query.job_id)); filters.push(`te.job_id = $${params.length}`) }
      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
      const { rows } = await query(`${ENTRY_SELECT} ${where} ORDER BY te.clock_in_at DESC LIMIT 500`, params)
      res.json(rows)
    } catch (err) { next(err) }
  })

  // Admin-only correction of a past entry.
  r.patch('/:id', requireAuth, async (req, res, next) => {
    try {
      if (!await isAdmin(query, req.user.id)) {
        return res.status(403).json({ error: 'Only an admin can edit time entries' })
      }
      const body = req.body || {}
      const PATCHABLE = ['job_id', 'clock_in_at', 'clock_out_at', 'note']
      const setClauses = []
      const values = []
      for (const key of PATCHABLE) {
        if (key in body) {
          let v = body[key]
          if (key === 'job_id') v = (v === '' || v == null) ? null : (Number(v) || null)
          if ((key === 'clock_in_at' || key === 'clock_out_at') && (v === '' )) v = null
          values.push(v); setClauses.push(`${key} = $${values.length}`)
        }
      }
      if (!setClauses.length) return res.status(400).json({ error: 'No editable fields provided' })
      values.push(req.user.id); setClauses.push(`edited_by_user_id = $${values.length}`)
      values.push(req.params.id)
      const upd = await query(
        `UPDATE time_entries SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING id`, values)
      if (!upd.rows.length) return res.status(404).json({ error: 'Not found' })
      const full = await query(`${ENTRY_SELECT} WHERE te.id = $1`, [upd.rows[0].id])
      res.json(full.rows[0])
    } catch (err) { next(err) }
  })

  r.delete('/:id', requireAuth, async (req, res, next) => {
    try {
      if (!await isAdmin(query, req.user.id)) {
        return res.status(403).json({ error: 'Only an admin can delete time entries' })
      }
      const { rows } = await query('DELETE FROM time_entries WHERE id = $1 RETURNING id', [req.params.id])
      if (!rows.length) return res.status(404).json({ error: 'Not found' })
      res.json({ ok: true, id: rows[0].id })
    } catch (err) { next(err) }
  })

  return r
}

const router = Router()
router.use(makeRouter())
export default router

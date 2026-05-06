import { Router } from 'express'
import { query } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

const ALLOWED_PATCH = [
  'title', 'description',
  'assigned_to', 'job_id', 'client_id', 'ticket_id',
  'priority', 'status', 'due_date',
]

const SELECT_TODO = `
  SELECT
    t.*,
    j.name        AS job_name,
    c.name        AS client_name,
    st.ticket_id  AS ticket_short_id,
    st.issue      AS ticket_issue,
    a.name        AS assigned_name,
    a.initials    AS assigned_initials,
    a.email       AS assigned_email,
    cb.name       AS created_by_name
  FROM todos t
  LEFT JOIN jobs            j  ON j.id  = t.job_id
  LEFT JOIN clients         c  ON c.id  = t.client_id
  LEFT JOIN support_tickets st ON st.id = t.ticket_id
  LEFT JOIN users           a  ON a.id  = t.assigned_to
  LEFT JOIN users           cb ON cb.id = t.created_by
`

async function getRole(userId) {
  const { rows } = await query('SELECT role FROM users WHERE id = $1', [userId])
  return rows[0]?.role
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const role = await getRole(req.user.id)
    const isAdmin = role === 'Admin'

    const { status, priority, job_id, due, all } = req.query
    const assignedToParam = req.query.assigned_to

    const conditions = []
    const params = []

    // Scope: admins can request all-team or filter by assigned_to;
    // everyone else is limited to todos assigned to them.
    if (isAdmin && all === '1') {
      // no scope filter — team view
    } else if (isAdmin && assignedToParam) {
      params.push(Number(assignedToParam))
      conditions.push(`t.assigned_to = $${params.length}`)
    } else {
      params.push(req.user.id)
      conditions.push(`t.assigned_to = $${params.length}`)
    }

    if (status) {
      params.push(String(status))
      conditions.push(`t.status = $${params.length}`)
    }
    if (priority) {
      params.push(String(priority))
      conditions.push(`t.priority = $${params.length}`)
    }
    if (job_id) {
      params.push(Number(job_id))
      conditions.push(`t.job_id = $${params.length}`)
    }
    if (due === 'today') {
      conditions.push(`t.due_date = CURRENT_DATE`)
    } else if (due === 'upcoming') {
      conditions.push(`t.due_date > CURRENT_DATE`)
    } else if (due === 'overdue') {
      conditions.push(`t.due_date < CURRENT_DATE AND t.status <> 'done'`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const sql = `${SELECT_TODO} ${where}
                 ORDER BY
                   CASE WHEN t.status = 'done' THEN 1 ELSE 0 END,
                   t.due_date NULLS LAST,
                   t.created_at DESC`

    const { rows } = await query(sql, params)
    res.json(rows)
  } catch (err) {
    console.error('[todos:list] error', { code: err?.code, message: err?.message })
    next(err)
  }
})

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(`${SELECT_TODO} WHERE t.id = $1`, [req.params.id])
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err) { next(err) }
})

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const role = await getRole(req.user.id)
    const isAdmin = role === 'Admin'

    const {
      title, description,
      assigned_to, job_id, client_id, ticket_id,
      priority, status, due_date,
    } = req.body || {}

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'title is required' })
    }

    // Non-admins can only assign to themselves.
    let resolvedAssignedTo = assigned_to ?? req.user.id
    if (!isAdmin && Number(resolvedAssignedTo) !== req.user.id) {
      resolvedAssignedTo = req.user.id
    }

    const insertSql = `
      INSERT INTO todos (
        title, description, assigned_to, created_by,
        job_id, client_id, ticket_id,
        priority, status, due_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7,
              COALESCE($8, 'normal'),
              COALESCE($9, 'open'),
              $10)
      RETURNING id`

    const { rows: inserted } = await query(insertSql, [
      title.trim(),
      description || null,
      resolvedAssignedTo || null,
      req.user.id,
      job_id || null,
      client_id || null,
      ticket_id || null,
      priority || null,
      status || null,
      due_date || null,
    ])

    const { rows } = await query(`${SELECT_TODO} WHERE t.id = $1`, [inserted[0].id])
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('[todos:create] error', { code: err?.code, message: err?.message, detail: err?.detail })
    next(err)
  }
})

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const role = await getRole(req.user.id)
    const isAdmin = role === 'Admin'

    const { rows: existing } = await query('SELECT * FROM todos WHERE id = $1', [req.params.id])
    if (existing.length === 0) return res.status(404).json({ error: 'Not found' })
    const todo = existing[0]

    // Edit allowed for: admin, creator, or current assignee.
    const canEdit = isAdmin || todo.created_by === req.user.id || todo.assigned_to === req.user.id
    if (!canEdit) return res.status(403).json({ error: 'Not allowed to edit this to-do' })

    // Non-admins can't reassign to a different user.
    const body = { ...(req.body || {}) }
    if (!isAdmin && 'assigned_to' in body && Number(body.assigned_to) !== req.user.id) {
      delete body.assigned_to
    }

    const sets = []
    const values = []
    for (const f of ALLOWED_PATCH) {
      if (f in body) {
        values.push(body[f] === '' ? null : body[f])
        sets.push(`${f} = $${values.length}`)
      }
    }

    // completed_at follows status transitions to/from 'done'.
    if ('status' in body) {
      if (body.status === 'done') sets.push(`completed_at = NOW()`)
      else                        sets.push(`completed_at = NULL`)
    }
    sets.push(`updated_at = NOW()`)

    if (values.length === 0 && !('status' in body)) {
      return res.status(400).json({ error: 'no updatable fields provided' })
    }

    values.push(req.params.id)
    const sql = `UPDATE todos SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING id`
    const { rows: updated } = await query(sql, values)
    if (updated.length === 0) return res.status(404).json({ error: 'Not found' })

    const { rows } = await query(`${SELECT_TODO} WHERE t.id = $1`, [updated[0].id])
    res.json(rows[0])
  } catch (err) {
    console.error('[todos:patch] error', { code: err?.code, message: err?.message, detail: err?.detail })
    next(err)
  }
})

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const role = await getRole(req.user.id)
    const isAdmin = role === 'Admin'

    const { rows: existing } = await query('SELECT created_by FROM todos WHERE id = $1', [req.params.id])
    if (existing.length === 0) return res.status(404).json({ error: 'Not found' })

    const isCreator = existing[0].created_by === req.user.id
    if (!isAdmin && !isCreator) {
      return res.status(403).json({ error: 'Only the creator or an admin can delete this to-do' })
    }

    await query('DELETE FROM todos WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch (err) { next(err) }
})

export default router

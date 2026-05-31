import { useState, useEffect, useMemo } from 'react'
import { colorForInitials, initialsOf } from './lib/color'
import { getToken } from './lib/auth'
import * as haptics from './lib/haptics'
import { usePullToRefresh, PullIndicator } from './lib/usePullToRefresh'

const TOKEN_KEY = 'intellix_token'
const PRIORITIES = [
  { id: 'low',    label: 'Low',    color: '#aeaeb2' },
  { id: 'normal', label: 'Normal', color: '#0066cc' },
  { id: 'high',   label: 'High',   color: '#ff3b30' },
]
const STATUSES = [
  { id: 'open',        label: 'Open' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'done',        label: 'Done' },
]
const FILTERS = [
  { id: 'all',      label: 'All' },
  { id: 'today',    label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'overdue',  label: 'Overdue' },
  { id: 'done',     label: 'Done' },
]

const lbl = { fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5 }
const inp = { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 11px', fontSize: 12.5, color: 'var(--text)', fontFamily: 'var(--font)', outline: 'none' }
const primaryBtn = { padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#1d1d1f', color: '#fff', fontFamily: 'var(--font)' }
const ghostBtn = { padding: '7px 12px', borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontFamily: 'var(--font)' }

const BASE = import.meta.env.VITE_API_URL || ''

function authedFetch(path, init = {}) {
  const token = getToken()
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}

async function authedJson(path, init) {
  const res = await authedFetch(path, init)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `${res.status}`)
  return data
}

function pillBtn(active) {
  return {
    padding: '5px 11px', borderRadius: 7, fontSize: 11.5, fontWeight: 600,
    cursor: 'pointer', border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
    background: active ? 'rgba(0,102,204,0.08)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text2)',
    fontFamily: 'var(--font)',
  }
}

function priorityColor(p) { return (PRIORITIES.find(x => x.id === p) || PRIORITIES[1]).color }
function priorityLabel(p) { return (PRIORITIES.find(x => x.id === p) || PRIORITIES[1]).label }
function statusLabel(s) { return (STATUSES.find(x => x.id === s) || STATUSES[0]).label }

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : '2-digit' })
}

// Locale-aware time-of-day, e.g. "3:00 PM".
function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

// A due_at timestamp is "overdue" once it's in the past and not completed.
function isOverdueAt(dueAt, completedAt) {
  if (!dueAt || completedAt) return false
  const d = new Date(dueAt)
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now()
}

// <input type="time"> value ("HH:MM") → ISO timestamp on today's date, or
// null when cleared. Local time → UTC instant via toISOString.
function timeToISO(timeStr) {
  if (!timeStr) return null
  const [h, m] = timeStr.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

// ISO timestamp → "HH:MM" local time for an <input type="time"> value.
function isoToTimeInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function dueState(iso, status) {
  if (!iso || status === 'done') return 'none'
  const today = new Date(); today.setHours(0,0,0,0)
  const d = new Date(iso); d.setHours(0,0,0,0)
  if (d < today) return 'overdue'
  if (d.getTime() === today.getTime()) return 'today'
  return 'future'
}

function Chip({ color, children, dim }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 5, fontSize: 10.5, fontWeight: 700,
      background: color ? `${color}18` : 'var(--bg4)',
      color: color || 'var(--text2)',
      opacity: dim ? 0.6 : 1,
      maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    }}>{children}</span>
  )
}

function Avatar({ initials, name, size = 22 }) {
  const init = initials || initialsOf(name)
  return (
    <div style={{
      width: size, height: size, minWidth: size, borderRadius: '50%',
      background: colorForInitials(init), color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 700,
    }}>{init}</div>
  )
}

function TodoCard({ todo, onClick, onToggle, draggable, onDragStart, onDragEnd, dragging, compact }) {
  const due = dueState(todo.due_date, todo.status)
  const dueColor = due === 'overdue' ? '#d70015' : due === 'today' ? '#c93400' : 'var(--text3)'

  return (
    <div
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border2)',
        borderRadius: 10,
        padding: '10px 12px',
        cursor: draggable ? 'grab' : 'pointer',
        opacity: dragging ? 0.4 : (todo.status === 'done' ? 0.6 : 1),
        marginBottom: compact ? 8 : 0,
        transition: 'border-color 0.1s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onToggle(todo) }}
          aria-label={todo.status === 'done' ? 'Mark not done' : 'Mark done'}
          style={{
            width: 18, height: 18, minWidth: 18, marginTop: 2,
            borderRadius: 5,
            border: '1.5px solid ' + (todo.status === 'done' ? '#34c759' : 'var(--border)'),
            background: todo.status === 'done' ? '#34c759' : 'transparent',
            cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {todo.status === 'done' && (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          )}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: priorityColor(todo.priority), flexShrink: 0 }} title={`Priority: ${priorityLabel(todo.priority)}`} />
            <div style={{
              fontSize: 12.5, fontWeight: 600, color: 'var(--text)', flex: 1, minWidth: 0,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              textDecoration: todo.status === 'done' ? 'line-through' : 'none',
            }}>{todo.title}</div>
            {todo.assigned_initials && <Avatar initials={todo.assigned_initials} name={todo.assigned_name} size={20} />}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {todo.due_date && (
              <span style={{ fontSize: 10.5, fontWeight: 600, color: dueColor }}>
                {due === 'overdue' ? 'Overdue · ' : due === 'today' ? 'Today · ' : ''}
                {fmtDate(todo.due_date)}
              </span>
            )}
            {/* Time-of-day "due by" + completion metadata (subtle). */}
            {todo.completed_at ? (
              <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text3)' }}>
                Completed at {fmtTime(todo.completed_at)}
              </span>
            ) : todo.due_at && (
              <>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: isOverdueAt(todo.due_at, todo.completed_at) ? '#d70015' : 'var(--text3)' }}>
                  Due by {fmtTime(todo.due_at)}
                </span>
                {isOverdueAt(todo.due_at, todo.completed_at) && (
                  <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(255,59,48,0.1)', color: '#d70015' }}>Overdue</span>
                )}
              </>
            )}
            {todo.job_name && <Chip color="#0066cc">Job · {todo.job_name}</Chip>}
            {todo.client_name && <Chip color="#534AB7">{todo.client_name}</Chip>}
            {todo.ticket_short_id && <Chip color="#ff9500">{todo.ticket_short_id || `#${todo.ticket_id}`}</Chip>}
          </div>
        </div>
      </div>
    </div>
  )
}

function ListView({ todos, onSelect, onToggle }) {
  if (todos.length === 0) {
    return (
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '40px 24px', textAlign: 'center', margin: '16px 24px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>No to-dos here</div>
        <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>Use “New to-do” above to add one.</div>
      </div>
    )
  }
  return (
    <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {todos.map(t => (
        <TodoCard key={t.id} todo={t} onClick={() => onSelect(t)} onToggle={onToggle} />
      ))}
    </div>
  )
}

function KanbanView({ todos, onSelect, onToggle, onMove }) {
  const [draggingId, setDraggingId] = useState(null)
  const [overCol, setOverCol] = useState(null)

  const grouped = useMemo(() => STATUSES.map(c => ({
    ...c,
    items: todos.filter(t => (t.status || 'open') === c.id),
  })), [todos])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: '16px 24px 24px' }}>
      {grouped.map(col => (
        <div
          key={col.id}
          onDragOver={e => { e.preventDefault(); setOverCol(col.id) }}
          onDragLeave={() => setOverCol(o => o === col.id ? null : o)}
          onDrop={e => {
            e.preventDefault()
            const id = Number(e.dataTransfer.getData('text/plain'))
            setOverCol(null)
            setDraggingId(null)
            if (id) onMove(id, col.id)
          }}
          style={{
            background: overCol === col.id ? 'rgba(0,102,204,0.06)' : 'var(--bg3)',
            border: '1px solid ' + (overCol === col.id ? 'var(--accent)' : 'var(--border2)'),
            borderRadius: 12, padding: '10px 10px 4px',
            transition: 'background 0.1s, border-color 0.1s',
            minHeight: 120,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 4px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{col.label}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>{col.items.length}</div>
          </div>
          {col.items.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', padding: '14px 0 18px' }}>—</div>
          )}
          {col.items.map(t => (
            <TodoCard
              key={t.id}
              todo={t}
              compact
              onClick={() => onSelect(t)}
              onToggle={onToggle}
              draggable
              onDragStart={e => { e.dataTransfer.setData('text/plain', String(t.id)); setDraggingId(t.id) }}
              onDragEnd={() => { setDraggingId(null); setOverCol(null) }}
              dragging={draggingId === t.id}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function NewTodoModal({ onClose, onCreated, isAdmin, currentUserId, users, jobs, clients, tickets }) {
  const [form, setForm] = useState({
    title: '', description: '',
    assigned_to: currentUserId,
    priority: 'normal', status: 'open',
    due_date: '', due_time: '',
    job_id: '', client_id: '', ticket_id: '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!form.title.trim() || submitting) return
    setSubmitting(true); setError('')
    try {
      const body = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        assigned_to: isAdmin ? Number(form.assigned_to) : currentUserId,
        priority: form.priority,
        status: form.status,
        due_date: form.due_date || null,
        due_at: timeToISO(form.due_time),
        job_id: form.job_id ? Number(form.job_id) : null,
        client_id: form.client_id ? Number(form.client_id) : null,
        ticket_id: form.ticket_id ? Number(form.ticket_id) : null,
      }
      const created = await authedJson('/api/todos', { method: 'POST', body: JSON.stringify(body) })
      haptics.medium() // to-do created
      onCreated(created)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <form onSubmit={submit} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 14, width: 540, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px', borderBottom: '1px solid var(--border2)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>New to-do</div>
          <button type="button" onClick={onClose} style={{ background: 'var(--bg4)', border: 'none', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', color: 'var(--text2)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        <div style={{ padding: '18px 22px' }}>
          <div style={{ marginBottom: 12 }}>
            <div style={lbl}>Title</div>
            <input style={inp} placeholder="What needs doing?" value={form.title} onChange={e => set('title', e.target.value)} autoFocus required />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={lbl}>Description</div>
            <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} placeholder="Optional notes…" value={form.description} onChange={e => set('description', e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={lbl}>Priority</div>
              <select style={inp} value={form.priority} onChange={e => set('priority', e.target.value)}>
                {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <div style={lbl}>Status</div>
              <select style={inp} value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={lbl}>Due date</div>
              <input style={inp} type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
            </div>
            <div>
              <div style={lbl}>Due by (optional)</div>
              <input style={inp} type="time" value={form.due_time} onChange={e => { set('due_time', e.target.value); if (e.target.value) haptics.light() }} />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={lbl}>Assignee</div>
            {isAdmin ? (
              <select style={inp} value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)}>
                {users.map(u => <option key={u.id} value={u.id}>{u.name} {u.id === currentUserId ? '(me)' : ''}</option>)}
              </select>
            ) : (
              <input style={{ ...inp, opacity: 0.7 }} value={users.find(u => u.id === currentUserId)?.name || 'Me'} readOnly disabled />
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <div style={lbl}>Linked job</div>
              <select style={inp} value={form.job_id} onChange={e => set('job_id', e.target.value)}>
                <option value="">— None —</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            </div>
            <div>
              <div style={lbl}>Linked client</div>
              <select style={inp} value={form.client_id} onChange={e => set('client_id', e.target.value)}>
                <option value="">— None —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <div style={lbl}>Linked ticket</div>
              <select style={inp} value={form.ticket_id} onChange={e => set('ticket_id', e.target.value)}>
                <option value="">— None —</option>
                {tickets.map(t => <option key={t.id} value={t.id}>{t.ticket_id || `#${t.id}`} · {t.issue?.slice(0, 32)}</option>)}
              </select>
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 12, background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.25)', borderRadius: 8, padding: '9px 12px', fontSize: 11.5, color: '#d70015', fontWeight: 500 }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border2)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} style={ghostBtn}>Cancel</button>
          <button type="submit" disabled={!form.title.trim() || submitting} style={{ ...primaryBtn, opacity: (!form.title.trim() || submitting) ? 0.5 : 1, cursor: (!form.title.trim() || submitting) ? 'not-allowed' : 'pointer' }}>
            {submitting ? 'Saving…' : 'Create to-do'}
          </button>
        </div>
      </form>
    </div>
  )
}

function SidePanel({ todo, onClose, onUpdate, onDelete, isAdmin, currentUserId, users, jobs, clients, tickets }) {
  const [form, setForm] = useState(() => ({
    title: todo.title || '',
    description: todo.description || '',
    assigned_to: todo.assigned_to || currentUserId,
    priority: todo.priority || 'normal',
    status: todo.status || 'open',
    due_date: todo.due_date ? String(todo.due_date).slice(0, 10) : '',
    due_time: isoToTimeInput(todo.due_at),
    job_id: todo.job_id || '',
    client_id: todo.client_id || '',
    ticket_id: todo.ticket_id || '',
  }))
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const canDelete = isAdmin || todo.created_by === currentUserId

  const save = async () => {
    setSaving(true); setError('')
    try {
      const body = {
        title: form.title,
        description: form.description || null,
        assigned_to: isAdmin ? Number(form.assigned_to) : currentUserId,
        priority: form.priority,
        status: form.status,
        due_date: form.due_date || null,
        due_at: form.due_time ? timeToISO(form.due_time) : null,
        job_id: form.job_id ? Number(form.job_id) : null,
        client_id: form.client_id ? Number(form.client_id) : null,
        ticket_id: form.ticket_id ? Number(form.ticket_id) : null,
      }
      const updated = await authedJson(`/api/todos/${todo.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      haptics.medium() // to-do saved
      onUpdate(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!confirm(`Delete “${todo.title}”?`)) return
    haptics.heavy() // irreversible delete
    setDeleting(true); setError('')
    try {
      await authedJson(`/api/todos/${todo.id}`, { method: 'DELETE' })
      onDelete(todo.id)
    } catch (err) {
      setError(err.message); setDeleting(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', justifyContent: 'flex-end', zIndex: 100 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 'min(440px, 100%)', height: '100%', background: 'var(--bg2)',
        borderLeft: '1px solid var(--border2)', boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>To-do detail</div>
          <button onClick={onClose} style={{ background: 'var(--bg4)', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', color: 'var(--text2)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px' }}>
          <div style={{ marginBottom: 12 }}>
            <div style={lbl}>Title</div>
            <input style={inp} value={form.title} onChange={e => set('title', e.target.value)} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={lbl}>Description</div>
            <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' }} value={form.description} onChange={e => set('description', e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={lbl}>Status</div>
              <select style={inp} value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <div style={lbl}>Priority</div>
              <select style={inp} value={form.priority} onChange={e => set('priority', e.target.value)}>
                {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={lbl}>Assignee</div>
              {isAdmin ? (
                <select style={inp} value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)}>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              ) : (
                <input style={{ ...inp, opacity: 0.7 }} value={todo.assigned_name || 'Me'} readOnly disabled />
              )}
            </div>
            <div>
              <div style={lbl}>Due date</div>
              <input style={inp} type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={lbl}>Due by (optional)</div>
            <input style={inp} type="time" value={form.due_time} onChange={e => { set('due_time', e.target.value); if (e.target.value) haptics.light() }} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={lbl}>Linked job</div>
            <select style={inp} value={form.job_id} onChange={e => set('job_id', e.target.value)}>
              <option value="">— None —</option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={lbl}>Linked client</div>
            <select style={inp} value={form.client_id} onChange={e => set('client_id', e.target.value)}>
              <option value="">— None —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={lbl}>Linked ticket</div>
            <select style={inp} value={form.ticket_id} onChange={e => set('ticket_id', e.target.value)}>
              <option value="">— None —</option>
              {tickets.map(t => <option key={t.id} value={t.id}>{t.ticket_id || `#${t.id}`} · {t.issue?.slice(0, 32)}</option>)}
            </select>
          </div>

          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border2)', fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 }}>
            Created by {todo.created_by_name || '—'} · {fmtDate(todo.created_at)}
            {todo.completed_at && <> · Completed {fmtDate(todo.completed_at)} at {fmtTime(todo.completed_at)}</>}
          </div>

          {error && (
            <div style={{ marginTop: 12, background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.25)', borderRadius: 8, padding: '9px 12px', fontSize: 11.5, color: '#d70015', fontWeight: 500 }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderTop: '1px solid var(--border2)', flexShrink: 0, gap: 8 }}>
          {canDelete ? (
            <button onClick={remove} disabled={deleting} style={{ padding: '8px 14px', borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(255,59,48,0.3)', background: 'transparent', color: '#d70015', fontFamily: 'var(--font)', opacity: deleting ? 0.6 : 1 }}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          ) : <div />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={ghostBtn}>Close</button>
            <button onClick={save} disabled={saving || !form.title.trim()} style={{ ...primaryBtn, opacity: (saving || !form.title.trim()) ? 0.5 : 1 }}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Todos() {
  const [me, setMe] = useState(null)
  const [view, setView] = useState('list')
  const [filter, setFilter] = useState('all')
  const [teamView, setTeamView] = useState(false)
  const [assignedFilter, setAssignedFilter] = useState('me')

  const [todos, setTodos] = useState([])
  const [users, setUsers] = useState([])
  const [jobs, setJobs] = useState([])
  const [clients, setClients] = useState([])
  const [tickets, setTickets] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    authedJson('/api/auth/me')
      .then(setMe)
      .catch(err => setError(`Couldn't load user: ${err.message}`))
  }, [])

  // Fetch reference data once.
  useEffect(() => {
    Promise.all([
      authedJson('/api/team').catch(() => []),
      authedJson('/api/jobs').catch(() => []),
      authedJson('/api/clients').catch(() => []),
      authedJson('/api/tickets').catch(() => []),
    ]).then(([t, j, c, tk]) => {
      setUsers(t)
      setJobs(j)
      setClients(c)
      setTickets(tk)
    })
  }, [])

  const isAdmin = me?.role === 'Admin'

  const fetchTodos = async () => {
    if (!me) return
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams()
      if (filter === 'done') params.set('status', 'done')
      else if (filter === 'today') params.set('due', 'today')
      else if (filter === 'upcoming') params.set('due', 'upcoming')
      else if (filter === 'overdue') params.set('due', 'overdue')

      if (isAdmin && teamView) params.set('all', '1')
      else if (isAdmin && assignedFilter && assignedFilter !== 'me') params.set('assigned_to', assignedFilter)

      const data = await authedJson(`/api/todos?${params.toString()}`)
      setTodos(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTodos() }, [me, filter, teamView, assignedFilter])

  const ptr = usePullToRefresh(fetchTodos)

  const handleToggleComplete = async (todo) => {
    const next = todo.status === 'done' ? 'open' : 'done'
    if (next === 'done') haptics.success() // completing a task
    else haptics.light()                   // un-completing
    try {
      const updated = await authedJson(`/api/todos/${todo.id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) })
      setTodos(ts => ts.map(t => t.id === updated.id ? updated : t))
      if (selected?.id === updated.id) setSelected(updated)
    } catch (err) {
      haptics.error()
      alert(`Couldn't update: ${err.message}`)
    }
  }

  const handleMove = async (id, status) => {
    const todo = todos.find(t => t.id === id)
    if (!todo || todo.status === status) return
    // Optimistic
    setTodos(ts => ts.map(t => t.id === id ? { ...t, status } : t))
    try {
      const updated = await authedJson(`/api/todos/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      setTodos(ts => ts.map(t => t.id === updated.id ? updated : t))
    } catch (err) {
      // Revert
      setTodos(ts => ts.map(t => t.id === id ? todo : t))
      alert(`Couldn't move: ${err.message}`)
    }
  }

  const handleCreated = (created) => {
    setTodos(ts => [created, ...ts])
  }
  const handleUpdate = (updated) => {
    setTodos(ts => ts.map(t => t.id === updated.id ? updated : t))
    setSelected(updated)
  }
  const handleDelete = (id) => {
    setTodos(ts => ts.filter(t => t.id !== id))
    setSelected(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '13px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>To-dos</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {isAdmin && (
            <button onClick={() => setTeamView(v => !v)} style={pillBtn(teamView)}>
              {teamView ? '👥 Team view' : 'Team view'}
            </button>
          )}
          <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 7, border: '1px solid var(--border)', overflow: 'hidden' }}>
            {['list', 'kanban'].map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding: '6px 12px', border: 'none', background: view === v ? 'var(--bg2)' : 'transparent', color: view === v ? 'var(--text)' : 'var(--text2)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', textTransform: 'capitalize' }}>{v}</button>
            ))}
          </div>
          <button onClick={() => setShowNew(true)} style={primaryBtn}>+ New to-do</button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={pillBtn(filter === f.id)}>{f.label}</button>
        ))}
        {isAdmin && teamView && (
          <>
            <div style={{ width: 1, height: 18, background: 'var(--border2)', margin: '0 4px' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>Assigned:</span>
            <select value={assignedFilter} onChange={e => setAssignedFilter(e.target.value)} style={{ ...inp, width: 'auto', padding: '5px 10px', fontSize: 11.5 }}>
              <option value="me">Anyone</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </>
        )}
      </div>

      <div {...ptr.handlers} style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
        <PullIndicator pull={ptr.pull} refreshing={ptr.refreshing} />
        {error && (
          <div style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.25)', borderRadius: 10, padding: '10px 14px', margin: '14px 24px', fontSize: 12, color: '#d70015' }}>
            {error}
          </div>
        )}
        {loading && !todos.length ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
        ) : view === 'list' ? (
          <ListView todos={todos} onSelect={setSelected} onToggle={handleToggleComplete} />
        ) : (
          <KanbanView todos={todos} onSelect={setSelected} onToggle={handleToggleComplete} onMove={handleMove} />
        )}
      </div>

      {showNew && me && (
        <NewTodoModal
          onClose={() => setShowNew(false)}
          onCreated={handleCreated}
          isAdmin={isAdmin}
          currentUserId={me.id}
          users={users}
          jobs={jobs}
          clients={clients}
          tickets={tickets}
        />
      )}

      {selected && me && (
        <SidePanel
          todo={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          isAdmin={isAdmin}
          currentUserId={me.id}
          users={users}
          jobs={jobs}
          clients={clients}
          tickets={tickets}
        />
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { apiGet } from './lib/api'
import { colorForInitials, initialsOf } from './lib/color'
import { getToken } from './lib/auth'

const statusStyle = {
  'On site':   { bg: 'rgba(52,199,89,0.09)',  color: '#248a3d', dot: '#34c759' },
  Available:   { bg: 'rgba(52,199,89,0.09)',  color: '#248a3d', dot: '#34c759' },
  Office:      { bg: 'rgba(0,102,204,0.08)',  color: '#0066cc', dot: '#0066cc' },
  Remote:      { bg: 'rgba(83,74,183,0.09)',  color: '#534AB7', dot: '#534AB7' },
}

const ROLES = ['Admin', 'Programmer', 'Technician']
const STATUSES = ['On site', 'Remote']

const lbl = { fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5 }
const inp = { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 11px', fontSize: 12.5, color: 'var(--text)', fontFamily: 'var(--font)', outline: 'none' }
const primaryBtn = { padding: '8px 18px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#1d1d1f', color: '#fff', fontFamily: 'var(--font)' }
const ghostBtn = { padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontFamily: 'var(--font)' }

const colorFor = colorForInitials

function StatusBadge({ status }) {
  const st = statusStyle[status] || { bg: 'var(--bg4)', color: 'var(--text2)', dot: 'var(--text3)' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 5, fontSize: 10.5, fontWeight: 700, background: st.bg, color: st.color }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.dot }} />
      {status}
    </span>
  )
}

function fmtWhen(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
function fmtDuration(a, b) {
  if (!a) return '—'
  if (!b) return 'in progress'
  const mins = Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000))
  const h = Math.floor(mins / 60), m = mins % 60
  return h ? `${h}h ${m}m` : `${m}m`
}
// datetime-local <-> ISO (preserves the actual instant across the server's tz).
function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso); const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
function fromLocalInput(v) { return v ? new Date(v).toISOString() : null }

function TimesheetModal({ emp, isAdmin, onClose }) {
  const [rows, setRows] = useState(null)
  const [jobs, setJobs] = useState([])
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // entry id being edited
  const [draft, setDraft] = useState({})
  const [busy, setBusy] = useState(false)

  const load = async () => {
    try {
      const data = await apiGet(`/api/time-entries?user_id=${emp.id}`)
      setRows(data)
    } catch (err) { setError(err.message); setRows([]) }
  }
  useEffect(() => { load(); apiGet('/api/jobs').then(setJobs).catch(() => {}) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const startEdit = (r) => {
    setEditing(r.id)
    setDraft({ clock_in_at: toLocalInput(r.clock_in_at), clock_out_at: toLocalInput(r.clock_out_at), job_id: r.job_id || '' })
  }

  const saveEdit = async (id) => {
    setBusy(true)
    try {
      const base = import.meta.env.VITE_API_URL || ''
      const token = getToken()
      const res = await fetch(`${base}/api/time-entries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          clock_in_at: fromLocalInput(draft.clock_in_at),
          clock_out_at: fromLocalInput(draft.clock_out_at),
          job_id: draft.job_id === '' ? null : Number(draft.job_id),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `${res.status}`)
      setEditing(null); await load()
    } catch (err) { alert(err.message) } finally { setBusy(false) }
  }

  const removeEntry = async (id) => {
    if (!confirm('Delete this time entry? This cannot be undone.')) return
    setBusy(true)
    try {
      const base = import.meta.env.VITE_API_URL || ''
      const token = getToken()
      const res = await fetch(`${base}/api/time-entries/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `${res.status}`) }
      await load()
    } catch (err) { alert(err.message) } finally { setBusy(false) }
  }

  const totalMins = (rows || []).reduce((acc, r) => acc + (r.clock_out_at ? Math.max(0, (new Date(r.clock_out_at) - new Date(r.clock_in_at)) / 60000) : 0), 0)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 14, width: 640, maxWidth: '100%', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px', borderBottom: '1px solid var(--border2)' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Timesheet — {emp.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{rows ? `${rows.length} punches · ${(totalMins / 60).toFixed(1)}h total` : 'Loading…'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'var(--bg4)', border: 'none', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', color: 'var(--text2)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        <div style={{ padding: '14px 22px' }}>
          {error && <div style={{ fontSize: 12, color: '#d70015', marginBottom: 10 }}>{error}</div>}
          {rows && rows.length === 0 && <div style={{ fontSize: 12, color: 'var(--text3)', padding: '20px 0', textAlign: 'center' }}>No time entries yet.</div>}

          {rows && rows.map(r => (
            <div key={r.id} style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 9, padding: '11px 14px', marginBottom: 7 }}>
              {editing === r.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <div style={{ ...lbl, marginBottom: 3 }}>Clock in</div>
                      <input type="datetime-local" style={inp} value={draft.clock_in_at} onChange={e => setDraft(d => ({ ...d, clock_in_at: e.target.value }))} />
                    </div>
                    <div>
                      <div style={{ ...lbl, marginBottom: 3 }}>Clock out</div>
                      <input type="datetime-local" style={inp} value={draft.clock_out_at} onChange={e => setDraft(d => ({ ...d, clock_out_at: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <div style={{ ...lbl, marginBottom: 3 }}>Job</div>
                    <select style={inp} value={draft.job_id} onChange={e => setDraft(d => ({ ...d, job_id: e.target.value }))}>
                      <option value="">— No job —</option>
                      {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditing(null)} style={{ ...ghostBtn, padding: '6px 12px', fontSize: 11.5 }}>Cancel</button>
                    <button onClick={() => saveEdit(r.id)} disabled={busy} style={{ ...primaryBtn, padding: '6px 14px', fontSize: 11.5, opacity: busy ? 0.6 : 1 }}>Save</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.job_name || 'No job'}{r.client_name ? ` · ${r.client_name}` : ''}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                      {fmtWhen(r.clock_in_at)} → {r.clock_out_at ? fmtWhen(r.clock_out_at) : <span style={{ color: '#248a3d', fontWeight: 600 }}>in progress</span>}
                      {r.edited_by_name && <span style={{ marginLeft: 6, fontStyle: 'italic' }}>· edited by {r.edited_by_name}</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: r.clock_out_at ? 'var(--text)' : '#248a3d', flexShrink: 0 }}>{fmtDuration(r.clock_in_at, r.clock_out_at)}</div>
                  {isAdmin && (
                    <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                      <button onClick={() => startEdit(r)} style={{ ...ghostBtn, padding: '5px 10px', fontSize: 11 }}>Edit</button>
                      <button onClick={() => removeEntry(r.id)} style={{ ...ghostBtn, padding: '5px 10px', fontSize: 11, borderColor: 'rgba(255,59,48,0.3)', color: '#d70015' }}>Delete</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function EmployeeCard({ emp, onResetPassword, resetting, onTimesheet }) {
  const bg = colorFor(emp.initials)
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 42, height: 42, minWidth: 42, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>
          {emp.initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 2 }}>{emp.role}</div>
        </div>
        <StatusBadge status={emp.status} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text2)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          <span style={{ color: 'var(--text)' }}>{emp.phone}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text2)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          <span style={{ color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.email}</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid var(--border2)', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Current job</div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: emp.job === '—' ? 'var(--text3)' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.job}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => onTimesheet(emp)}
            style={{ padding: '6px 11px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontFamily: 'var(--font)' }}
          >
            Timesheet
          </button>
          <button
            onClick={() => onResetPassword(emp)}
            disabled={resetting}
            style={{ padding: '6px 11px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: resetting ? 'wait' : 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontFamily: 'var(--font)', opacity: resetting ? 0.6 : 1 }}
          >
            {resetting ? 'Resetting…' : 'Reset password'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ResetPasswordResultModal({ user, tempPassword, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 14, width: 460, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px', borderBottom: '1px solid var(--border2)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Password reset</div>
          <button onClick={onClose} style={{ background: 'var(--bg4)', border: 'none', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', color: 'var(--text2)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ padding: '18px 22px' }}>
          <div style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 14, lineHeight: 1.5 }}>
            Share this temporary password with <strong style={{ color: 'var(--text)' }}>{user.name}</strong>. They'll be required to set a new one on next sign-in. <strong style={{ color: 'var(--text)' }}>This password will not be shown again.</strong>
          </div>
          <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Email</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{user.email}</div>
          </div>
          <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Temporary password</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', userSelect: 'all' }}>{tempPassword}</div>
          </div>
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border2)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={primaryBtn}>Done</button>
        </div>
      </div>
    </div>
  )
}

function AddTeamMemberModal({ onClose, onAdded }) {
  const [form, setForm] = useState({ name: '', email: '', role: 'Technician', password: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(null)

  const canSubmit = form.name.trim() && form.email.trim() && form.password.length >= 8

  const submit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const base = import.meta.env.VITE_API_URL || ''
      const token = getToken()
      const res = await fetch(`${base}/api/auth/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          password: form.password,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      setCreated({ user: data.user, tempPassword: form.password })
      onAdded(data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 14, width: 500, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px', borderBottom: '1px solid var(--border2)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{created ? 'Team member added' : 'Add team member'}</div>
          <button onClick={onClose} style={{ background: 'var(--bg4)', border: 'none', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', color: 'var(--text2)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {created ? (
          <>
            <div style={{ padding: '18px 22px' }}>
              <div style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 14, lineHeight: 1.5 }}>
                Share these credentials with <strong style={{ color: 'var(--text)' }}>{created.user.name}</strong>. They'll be required to set a new password on first sign-in.
              </div>
              <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Email</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{created.user.email}</div>
              </div>
              <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Temporary password</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{created.tempPassword}</div>
              </div>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border2)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={primaryBtn}>Done</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ padding: '18px 22px' }}>
              <div style={{ marginBottom: 12 }}>
                <div style={lbl}>Full name</div>
                <input style={inp} placeholder="Full name" value={form.name} onChange={e => set('name', e.target.value)} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={lbl}>Email</div>
                <input style={inp} type="email" placeholder="name@company.com" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={lbl}>Role</div>
                  <select style={inp} value={form.role} onChange={e => set('role', e.target.value)}>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <div style={lbl}>Temporary password</div>
                  <input style={inp} type="text" placeholder="min. 8 characters" value={form.password} onChange={e => set('password', e.target.value)} />
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>
                They'll sign in with this password once, then be forced to set a new one.
              </div>
              {error && (
                <div style={{ marginTop: 12, background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.25)', borderRadius: 8, padding: '9px 12px', fontSize: 11.5, color: '#d70015', fontWeight: 500 }}>
                  {error}
                </div>
              )}
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border2)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={onClose} style={ghostBtn}>Cancel</button>
              <button onClick={submit} disabled={!canSubmit || submitting} style={{ ...primaryBtn, opacity: (canSubmit && !submitting) ? 1 : 0.5, cursor: (canSubmit && !submitting) ? 'pointer' : 'not-allowed' }}>
                {submitting ? 'Adding…' : 'Add team member'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function Team() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [resettingId, setResettingId] = useState(null)
  const [resetResult, setResetResult] = useState(null)
  const [resetError, setResetError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [timesheetEmp, setTimesheetEmp] = useState(null)

  const handleResetPassword = async (emp) => {
    if (resettingId) return
    setResettingId(emp.id)
    setResetError('')
    try {
      const base = import.meta.env.VITE_API_URL || ''
      const token = getToken()
      const res = await fetch(`${base}/api/auth/admin-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_id: emp.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`)
      setResetResult({ user: data.user, tempPassword: data.tempPassword })
    } catch (err) {
      setResetError(err.message)
      alert(`Couldn't reset password: ${err.message}`)
    } finally {
      setResettingId(null)
    }
  }

  useEffect(() => {
    apiGet('/api/team')
      .then(data => setEmployees(data.map(e => ({
        ...e,
        initials: e.initials || initialsOf(e.name),
        job: e.job || '—',
      }))))
      .catch(err => console.error('Failed to load team', err))
      .finally(() => setLoading(false))

    const base = import.meta.env.VITE_API_URL || ''
    const token = getToken()
    if (token) {
      fetch(`${base}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(u => setIsAdmin(u?.role === 'Admin'))
        .catch(() => {})
    }
  }, [])

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = employees.filter(e => e.status === s).length
    return acc
  }, {})

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '13px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Team</div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13, fontWeight: 500 }}>Loading…</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Team</div>
          <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>{employees.length} {employees.length === 1 ? 'team member' : 'team members'}</div>
        </div>
        <button onClick={() => setShowModal(true)} style={primaryBtn}>+ Add team member</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px' }}>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STATUSES.length}, 1fr)`, gap: 10, marginBottom: 18 }}>
          {STATUSES.map(s => {
            const st = statusStyle[s]
            return (
              <div key={s} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.dot }} />
                  {s}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{counts[s]}</div>
              </div>
            )
          })}
        </div>

        {employees.length === 0 ? (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>No team members yet</div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 14 }}>Add your first team member to set them up with a login.</div>
            <button onClick={() => setShowModal(true)} style={primaryBtn}>+ Add team member</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {employees.map(emp => (
              <EmployeeCard
                key={emp.id}
                emp={emp}
                onResetPassword={handleResetPassword}
                resetting={resettingId === emp.id}
                onTimesheet={setTimesheetEmp}
              />
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <AddTeamMemberModal
          onClose={() => setShowModal(false)}
          onAdded={u => setEmployees(list => [
            { ...u, initials: u.initials || initialsOf(u.name), job: '—' },
            ...list,
          ])}
        />
      )}

      {resetResult && (
        <ResetPasswordResultModal
          user={resetResult.user}
          tempPassword={resetResult.tempPassword}
          onClose={() => setResetResult(null)}
        />
      )}

      {timesheetEmp && (
        <TimesheetModal emp={timesheetEmp} isAdmin={isAdmin} onClose={() => setTimesheetEmp(null)} />
      )}
    </div>
  )
}

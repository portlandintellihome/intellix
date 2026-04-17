import { useState, useEffect } from 'react'
import { apiGet } from './lib/api'
import { colorForInitials, initialsOf } from './lib/color'

const statusStyle = {
  'On site':   { bg: 'rgba(52,199,89,0.09)',  color: '#248a3d', dot: '#34c759' },
  Available:   { bg: 'rgba(52,199,89,0.09)',  color: '#248a3d', dot: '#34c759' },
  Office:      { bg: 'rgba(0,102,204,0.08)',  color: '#0066cc', dot: '#0066cc' },
  Remote:      { bg: 'rgba(83,74,183,0.09)',  color: '#534AB7', dot: '#534AB7' },
}

const ROLES = ['Installer', 'Programmer', 'Admin', 'Designer', 'Sales']
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

function EmployeeCard({ emp }) {
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid var(--border2)' }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Current job</div>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: emp.job === '—' ? 'var(--text3)' : 'var(--text)' }}>{emp.job}</div>
      </div>
    </div>
  )
}

const ROLES_WITH_ADMIN = ['Installer', 'Programmer', 'Admin', 'Designer', 'Sales']

function InviteEmployeeModal({ onClose, onInvited }) {
  const [form, setForm] = useState({ name: '', role: 'Installer', phone: '', email: '', password: '' })
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
      const token = localStorage.getItem('intellix_token')
      const res = await fetch(`${base}/api/auth/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          password: form.password,
          phone: form.phone.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      setCreated({ user: data.user, tempPassword: form.password })
      onInvited(data.user)
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
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{created ? 'Account created' : 'Invite employee'}</div>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={lbl}>Email</div>
                  <input style={inp} type="email" placeholder="name@company.com" value={form.email} onChange={e => set('email', e.target.value)} />
                </div>
                <div>
                  <div style={lbl}>Role</div>
                  <select style={inp} value={form.role} onChange={e => set('role', e.target.value)}>
                    {ROLES_WITH_ADMIN.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={lbl}>Phone (optional)</div>
                  <input style={inp} type="tel" placeholder="(503) 555-0100" value={form.phone} onChange={e => set('phone', e.target.value)} />
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
                {submitting ? 'Inviting…' : 'Send invite'}
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

  useEffect(() => {
    apiGet('/api/team')
      .then(data => setEmployees(data.map(e => ({
        ...e,
        initials: e.initials || initialsOf(e.name),
        job: e.job || '—',
      }))))
      .catch(err => console.error('Failed to load team', err))
      .finally(() => setLoading(false))
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
          <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>{employees.length} {employees.length === 1 ? 'employee' : 'employees'}</div>
        </div>
        <button onClick={() => setShowModal(true)} style={primaryBtn}>+ Invite employee</button>
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
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 14 }}>Invite your first teammate to set them up with a login.</div>
            <button onClick={() => setShowModal(true)} style={primaryBtn}>+ Invite employee</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {employees.map(emp => <EmployeeCard key={emp.id} emp={emp} />)}
          </div>
        )}
      </div>

      {showModal && (
        <InviteEmployeeModal
          onClose={() => setShowModal(false)}
          onInvited={u => setEmployees(list => [
            { ...u, initials: u.initials || initialsOf(u.name), job: '—' },
            ...list,
          ])}
        />
      )}
    </div>
  )
}

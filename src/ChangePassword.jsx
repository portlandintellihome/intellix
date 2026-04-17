import { useState } from 'react'

const lbl = { fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5 }
const inp = { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 13px', fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font)', outline: 'none' }
const primaryBtn = { width: '100%', padding: '11px 18px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#1d1d1f', color: '#fff', fontFamily: 'var(--font)' }

export default function ChangePassword({ user, onDone, onLogout }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (next !== confirm) { setError('New passwords do not match'); return }
    if (next.length < 8) { setError('New password must be at least 8 characters'); return }
    setSubmitting(true)
    try {
      const base = import.meta.env.VITE_API_URL || ''
      const token = localStorage.getItem('intellix_token')
      const res = await fetch(`${base}/api/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: current, new_password: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      onDone(data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'var(--font)' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <form onSubmit={submit} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 14, padding: '26px 26px 22px', boxShadow: '0 8px 32px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Set a new password</div>
          <div style={{ fontSize: 11.5, color: 'var(--text2)', marginBottom: 20 }}>
            Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''} — pick a password before continuing.
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={lbl}>Current (temporary) password</div>
            <input style={inp} type="password" value={current} onChange={e => setCurrent(e.target.value)} autoComplete="current-password" required />
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={lbl}>New password</div>
            <input style={inp} type="password" value={next} onChange={e => setNext(e.target.value)} autoComplete="new-password" minLength={8} required />
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={lbl}>Confirm new password</div>
            <input style={inp} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" minLength={8} required />
          </div>

          {error && (
            <div style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.25)', borderRadius: 8, padding: '9px 12px', marginBottom: 14, fontSize: 11.5, color: '#d70015', fontWeight: 500 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting} style={{ ...primaryBtn, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'wait' : 'pointer' }}>
            {submitting ? 'Updating…' : 'Update password and continue'}
          </button>

          {onLogout && (
            <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11.5, color: 'var(--text2)' }}>
              <button type="button" onClick={onLogout} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text2)', fontWeight: 600, fontFamily: 'var(--font)', fontSize: 11.5 }}>
                Sign out
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

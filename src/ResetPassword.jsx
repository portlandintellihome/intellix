import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'

const lbl = { fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5 }
const inp = { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 13px', fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font)', outline: 'none' }
const primaryBtn = { width: '100%', padding: '11px 18px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#1d1d1f', color: '#fff', fontFamily: 'var(--font)' }

function IntellixLogo() {
  return (
    <svg viewBox="0 0 160 52" width="160" height="52" xmlns="http://www.w3.org/2000/svg">
      <text x="0" y="34" fontFamily="Montserrat, sans-serif" fontWeight="700" fontSize="36" letterSpacing="-1" fill="var(--text)">intelli</text>
      <text x="101" y="34" fontFamily="Montserrat, sans-serif" fontWeight="700" fontSize="36" letterSpacing="-1" fill="var(--accent)">x</text>
      <line x1="0" y1="39" x2="148" y2="39" stroke="var(--border)" strokeWidth="0.75" />
      <circle cx="3" cy="44" r="2.5" fill="#34c759" />
      <circle cx="11" cy="44" r="2.5" fill="#ff9500" />
      <circle cx="19" cy="44" r="2.5" fill="#ff3b30" />
      <circle cx="27" cy="44" r="2.5" fill="#0066cc" />
      <text x="35" y="48" fontFamily="Montserrat, sans-serif" fontWeight="500" fontSize="6.5" letterSpacing="2.2" fill="var(--text3)">HOME AUTOMATION HUB</text>
    </svg>
  )
}

export default function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') || ''

  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) setError('This reset link is missing its token.')
  }, [token])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (next.length < 8) { setError('New password must be at least 8 characters'); return }
    if (next !== confirm) { setError('New passwords do not match'); return }
    setSubmitting(true)
    try {
      const base = import.meta.env.VITE_API_URL || ''
      const res = await fetch(`${base}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      setDone(true)
      setTimeout(() => navigate('/'), 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'var(--font)' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <IntellixLogo />
        </div>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 14, padding: '26px 26px 22px', boxShadow: '0 8px 32px rgba(0,0,0,0.06)' }}>
          {done ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Password updated</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 18 }}>
                Sending you to the sign-in page…
              </div>
              <Link to="/" style={{ ...primaryBtn, display: 'block', textAlign: 'center', textDecoration: 'none' }}>Sign in now</Link>
            </>
          ) : (
            <form onSubmit={submit}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Choose a new password</div>
              <div style={{ fontSize: 11.5, color: 'var(--text2)', marginBottom: 20 }}>
                Pick something at least 8 characters long.
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={lbl}>New password</div>
                <input style={inp} type="password" value={next} onChange={e => setNext(e.target.value)} autoComplete="new-password" minLength={8} required autoFocus />
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

              <button type="submit" disabled={submitting || !token} style={{ ...primaryBtn, opacity: (submitting || !token) ? 0.6 : 1, cursor: (submitting || !token) ? 'not-allowed' : 'pointer', marginBottom: 12 }}>
                {submitting ? 'Updating…' : 'Update password'}
              </button>

              <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--text2)' }}>
                <Link to="/" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Back to sign in</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

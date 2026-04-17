import { useState } from 'react'

const ROLES = ['Installer', 'Programmer', 'Admin', 'Designer', 'Sales']

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

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('Installer')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const base = import.meta.env.VITE_API_URL || ''
      const path = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const body = mode === 'login' ? { email, password } : { name, email, password, role }
      const res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      localStorage.setItem('intellix_token', data.token)
      onLogin(data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const switchMode = () => {
    setMode(m => m === 'login' ? 'register' : 'login')
    setError('')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'var(--font)' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <IntellixLogo />
        </div>

        <form onSubmit={submit} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 14, padding: '26px 26px 22px', boxShadow: '0 8px 32px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text2)', marginBottom: 20 }}>
            {mode === 'login' ? 'Welcome back — enter your credentials to continue.' : 'Set up your employee account.'}
          </div>

          {mode === 'register' && (
            <div style={{ marginBottom: 14 }}>
              <div style={lbl}>Full name</div>
              <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="Jane Installer" autoComplete="name" required />
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <div style={lbl}>Email</div>
            <input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" autoComplete="email" required />
          </div>

          <div style={{ marginBottom: mode === 'register' ? 14 : 18 }}>
            <div style={lbl}>Password</div>
            <input style={inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
          </div>

          {mode === 'register' && (
            <div style={{ marginBottom: 18 }}>
              <div style={lbl}>Role</div>
              <select style={inp} value={role} onChange={e => setRole(e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.25)', borderRadius: 8, padding: '9px 12px', marginBottom: 14, fontSize: 11.5, color: '#d70015', fontWeight: 500 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting} style={{ ...primaryBtn, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'wait' : 'pointer' }}>
            {submitting
              ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
              : (mode === 'login' ? 'Sign in' : 'Create account')}
          </button>

          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11.5, color: 'var(--text2)' }}>
            {mode === 'login' ? "New to Intellix? " : 'Already have an account? '}
            <button type="button" onClick={switchMode} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent)', fontWeight: 700, fontFamily: 'var(--font)', fontSize: 11.5 }}>
              {mode === 'login' ? 'Create account' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

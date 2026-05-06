import { useState, useEffect } from 'react'
import { apiGet } from './lib/api'

const lbl = { fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5 }
const inp = { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 11px', fontSize: 12.5, color: 'var(--text)', fontFamily: 'var(--font)', outline: 'none' }
const primaryBtn = { padding: '8px 18px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#1d1d1f', color: '#fff', fontFamily: 'var(--font)' }
const ghostBtn = { padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontFamily: 'var(--font)' }

const s = {
  topbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 },
  title: { fontSize: 14, fontWeight: 700, color: 'var(--text)' },
  content: { flex: 1, overflowY: 'auto', padding: '16px 24px 24px' },
  card: { background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '18px 20px', marginBottom: 14 },
  sectionTitle: { fontSize: 10.5, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 12 },
  cardHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  cardHeaderTitle: { fontSize: 13.5, fontWeight: 700, color: 'var(--text)' },
  cardHeaderSub: { fontSize: 11.5, color: 'var(--text2)', marginTop: 2 },
}

function Toggle({ checked, onChange, label, hint }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderBottom: '1px solid var(--border2)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{hint}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 42, height: 24, borderRadius: 12, border: 'none', padding: 0,
          background: checked ? 'var(--accent)' : 'var(--bg4)',
          cursor: 'pointer', position: 'relative', flexShrink: 0,
          transition: 'background 0.15s',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: checked ? 20 : 2,
          width: 20, height: 20, borderRadius: '50%', background: '#fff',
          transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </button>
    </div>
  )
}

function CompanyInfo({ data, onChange }) {
  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <div>
          <div style={s.cardHeaderTitle}>Company info</div>
          <div style={s.cardHeaderSub}>Appears on proposals, invoices, and client-facing pages</div>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={lbl}>Company name</div>
        <input style={inp} value={data.company_name || ''} onChange={e => onChange('company_name', e.target.value)} placeholder="e.g. Intellihome AV" />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={lbl}>Address</div>
        <input style={inp} value={data.company_address || ''} onChange={e => onChange('company_address', e.target.value)} placeholder="Street address" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={lbl}>Phone</div>
          <input style={inp} type="tel" value={data.company_phone || ''} onChange={e => onChange('company_phone', e.target.value)} placeholder="(503) 555-0100" />
        </div>
        <div>
          <div style={lbl}>Email</div>
          <input style={inp} type="email" value={data.company_email || ''} onChange={e => onChange('company_email', e.target.value)} placeholder="hello@company.com" />
        </div>
      </div>

      <div>
        <div style={lbl}>Company logo</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 56, height: 56, borderRadius: 10, background: 'var(--bg3)', border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
            {data.company_logo_url
              ? <img src={data.company_logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 10, color: 'var(--text3)' }}>No logo</span>}
          </div>
          <div style={{ flex: 1 }}>
            <input style={{ ...inp, marginBottom: 6 }} value={data.company_logo_url || ''} onChange={e => onChange('company_logo_url', e.target.value)} placeholder="https://... (logo URL)" />
            <button type="button" disabled style={{ ...ghostBtn, padding: '6px 12px', fontSize: 11, opacity: 0.5, cursor: 'not-allowed' }}>Upload from device — coming soon</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function GoogleBusiness({ data, onChange }) {
  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <div>
          <div style={s.cardHeaderTitle}>Google Business</div>
          <div style={s.cardHeaderSub}>Sent in post-job follow-up emails to ask satisfied clients for a review</div>
        </div>
      </div>

      <div>
        <div style={lbl}>Google review link</div>
        <input
          style={{ ...inp, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}
          value={data.google_review_link || ''}
          onChange={e => onChange('google_review_link', e.target.value)}
          placeholder="https://g.page/r/your-place-id/review"
        />
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, lineHeight: 1.5 }}>
          Find this in your Google Business profile under <strong>Get more reviews → Share review form</strong>.
        </div>
      </div>
    </div>
  )
}

function Notifications({ data, onChange }) {
  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <div>
          <div style={s.cardHeaderTitle}>Notifications</div>
          <div style={s.cardHeaderSub}>How the team is alerted when something needs attention</div>
        </div>
      </div>
      <Toggle
        checked={Boolean(data.email_notifications)}
        onChange={v => onChange('email_notifications', v)}
        label="Email notifications"
        hint="New tickets, proposal status changes, daily digests"
      />
      <div style={{ marginTop: 0 }}>
        <Toggle
          checked={Boolean(data.in_app_notifications)}
          onChange={v => onChange('in_app_notifications', v)}
          label="In-app notifications"
          hint="Banner alerts inside Intellix while signed in"
        />
      </div>
    </div>
  )
}

function Account() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const submit = async () => {
    setError(''); setOk('')
    if (next.length < 8) { setError('New password must be at least 8 characters'); return }
    if (next !== confirm) { setError('New passwords do not match'); return }
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
      if (!res.ok) throw new Error(data.error || `${res.status}`)
      setCurrent(''); setNext(''); setConfirm('')
      setOk('Password updated')
      setTimeout(() => setOk(''), 2500)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = current && next && confirm && !submitting

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <div>
          <div style={s.cardHeaderTitle}>Account</div>
          <div style={s.cardHeaderSub}>Change your password</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={lbl}>Current password</div>
          <input style={inp} type="password" value={current} onChange={e => setCurrent(e.target.value)} autoComplete="current-password" />
        </div>
        <div>
          <div style={lbl}>New password</div>
          <input style={inp} type="password" value={next} onChange={e => setNext(e.target.value)} autoComplete="new-password" minLength={8} />
        </div>
        <div>
          <div style={lbl}>Confirm new</div>
          <input style={inp} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" minLength={8} />
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.25)', borderRadius: 8, padding: '8px 12px', fontSize: 11.5, color: '#d70015', fontWeight: 500, marginBottom: 12 }}>
          {error}
        </div>
      )}
      {ok && (
        <div style={{ background: 'rgba(52,199,89,0.09)', border: '1px solid rgba(52,199,89,0.25)', borderRadius: 8, padding: '8px 12px', fontSize: 11.5, color: '#248a3d', fontWeight: 600, marginBottom: 12 }}>
          ✓ {ok}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={submit} disabled={!canSubmit} style={{ ...primaryBtn, opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
          {submitting ? 'Updating…' : 'Update password'}
        </button>
      </div>
    </div>
  )
}

export default function Settings() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedNote, setSavedNote] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    apiGet('/api/settings')
      .then(setData)
      .catch(err => {
        console.error('Failed to load settings', err)
        // Fall back to empty defaults so the form still renders if /api/settings 500s.
        setData({})
      })
      .finally(() => setLoading(false))
  }, [])

  const set = (k, v) => setData(d => ({ ...d, [k]: v }))

  const save = async () => {
    if (!data) return
    setSaving(true); setError(''); setSavedNote('')
    try {
      const base = import.meta.env.VITE_API_URL || ''
      const res = await fetch(`${base}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const updated = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(updated.error || `Save failed (${res.status})`)
      setData(updated)
      setSavedNote('Saved')
      setTimeout(() => setSavedNote(''), 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div style={s.topbar}><div style={s.title}>Settings</div></div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      <div style={s.topbar}>
        <div style={s.title}>Settings</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {savedNote && <span style={{ fontSize: 11.5, color: '#248a3d', fontWeight: 600 }}>✓ {savedNote}</span>}
          {error && <span style={{ fontSize: 11.5, color: '#d70015', fontWeight: 600 }}>{error}</span>}
          <button onClick={save} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1, cursor: saving ? 'wait' : 'pointer' }}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      <div style={s.content}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={s.sectionTitle}>Company</div>
          <CompanyInfo data={data} onChange={set} />

          <div style={s.sectionTitle}>Reviews</div>
          <GoogleBusiness data={data} onChange={set} />

          <div style={s.sectionTitle}>Notifications</div>
          <Notifications data={data} onChange={set} />

          <div style={s.sectionTitle}>Account</div>
          <Account />
        </div>
      </div>
    </div>
  )
}

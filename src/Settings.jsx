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

// Render an HTML email body with the same {{placeholder}} substitution
// the backend uses, so the live preview matches what'll actually go out.
function substitute(template, values) {
  if (!template) return ''
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) =>
    values[key] != null ? String(values[key]) : `{{${key}}}`
  )
}

function CheckIns({ data, onChange }) {
  const sample = {
    first_name: 'Jamie',
    full_name: 'Jamie Reyes',
    address: '742 Evergreen Terrace, Portland OR',
    review_url: 'https://g.page/r/your-place-id/review',
    support_url: 'https://intellix.example.com/support',
    job_name: 'Living-room theater install',
  }
  const previewSubject = substitute(data.checkin_email_subject || '', sample)
  const previewHtml = substitute(data.checkin_email_body || '', sample)

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <div>
          <div style={s.cardHeaderTitle}>Post-job check-in</div>
          <div style={s.cardHeaderSub}>
            Sent automatically a few days after a job is marked Complete. Asks for a Google review if everything's great, offers the support form if it's not. The review URL comes from the job's <strong>location</strong> — manage those in the Locations section below.
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={lbl}>Days after completion</div>
          <input
            style={inp}
            type="number"
            min={0}
            value={Number.isFinite(Number(data.checkin_delay_days)) ? data.checkin_delay_days : 3}
            onChange={e => onChange('checkin_delay_days', e.target.value === '' ? '' : Number(e.target.value))}
          />
        </div>
        <div>
          <div style={lbl}>Email subject</div>
          <input
            style={inp}
            value={data.checkin_email_subject || ''}
            onChange={e => onChange('checkin_email_subject', e.target.value)}
            placeholder="How's your IntelliHome system working?"
          />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={lbl}>Email body (HTML)</div>
        <textarea
          rows={14}
          style={{
            ...inp,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 12,
            lineHeight: 1.5,
            resize: 'vertical',
            minHeight: 220,
          }}
          value={data.checkin_email_body || ''}
          onChange={e => onChange('checkin_email_body', e.target.value)}
        />
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, lineHeight: 1.5 }}>
          Placeholders: <code>{`{{first_name}}`}</code>, <code>{`{{full_name}}`}</code>, <code>{`{{address}}`}</code>, <code>{`{{review_url}}`}</code>, <code>{`{{support_url}}`}</code>, <code>{`{{job_name}}`}</code>.
        </div>
      </div>

      <div>
        <div style={{ ...lbl, marginBottom: 8 }}>Live preview</div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
          <div style={{ background: 'var(--bg3)', padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text2)' }}>
            <div><strong style={{ color: 'var(--text)' }}>Subject:</strong> {previewSubject || <em style={{ color: 'var(--text3)' }}>(empty)</em>}</div>
            <div><strong style={{ color: 'var(--text)' }}>To:</strong> {sample.first_name} ({sample.full_name})</div>
          </div>
          <div
            style={{ padding: 0, color: '#1d1d1f', background: '#fff' }}
            dangerouslySetInnerHTML={{ __html: previewHtml || '<div style="padding:24px;color:#999;font-size:13px;">(empty body)</div>' }}
          />
        </div>
      </div>
    </div>
  )
}

function LocationModal({ initial, onClose, onSaved }) {
  const isEdit = Boolean(initial?.id)
  const [form, setForm] = useState({
    name: initial?.name || '',
    slug: initial?.slug || '',
    google_review_url: initial?.google_review_url || '',
    support_email: initial?.support_email || '',
    support_phone: initial?.support_phone || '',
    address: initial?.address || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    setError(''); setSaving(true)
    try {
      const base = import.meta.env.VITE_API_URL || ''
      const token = localStorage.getItem('intellix_token')
      const url = isEdit ? `${base}/api/locations/${initial.id}` : `${base}/api/locations`
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `${res.status}`)
      onSaved(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }} onClick={onClose}>
      <div style={{ background: 'var(--bg2)', borderRadius: 14, padding: 22, maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
          {isEdit ? 'Edit location' : 'Add location'}
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={lbl}>Name</div>
          <input style={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Portland" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={lbl}>Slug</div>
          <input style={{ ...inp, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }} value={form.slug} onChange={e => set('slug', e.target.value)} placeholder="auto-generated from name if blank" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={lbl}>Google review URL</div>
          <input style={{ ...inp, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }} value={form.google_review_url} onChange={e => set('google_review_url', e.target.value)} placeholder="https://g.page/r/..." />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <div style={lbl}>Support email</div>
            <input style={inp} type="email" value={form.support_email} onChange={e => set('support_email', e.target.value)} placeholder="support@..." />
          </div>
          <div>
            <div style={lbl}>Support phone</div>
            <input style={inp} type="tel" value={form.support_phone} onChange={e => set('support_phone', e.target.value)} placeholder="(503) 555-0100" />
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={lbl}>Address</div>
          <input style={inp} value={form.address} onChange={e => set('address', e.target.value)} placeholder="Street, City, State" />
        </div>

        {error && <div style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.25)', borderRadius: 8, padding: '8px 12px', fontSize: 11.5, color: '#d70015', fontWeight: 500, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={ghostBtn}>Cancel</button>
          <button onClick={submit} disabled={saving || !form.name.trim()} style={{ ...primaryBtn, opacity: (saving || !form.name.trim()) ? 0.5 : 1 }}>
            {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Add location')}
          </button>
        </div>
      </div>
    </div>
  )
}

function Locations({ isAdmin }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // null | 'new' | <location object>

  const reload = async () => {
    try {
      const base = import.meta.env.VITE_API_URL || ''
      const token = localStorage.getItem('intellix_token')
      const res = await fetch(`${base}/api/locations`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(`${res.status}`)
      setRows(await res.json())
    } catch (err) {
      setError(err.message)
      setRows([])
    }
  }
  useEffect(() => { reload() }, [])

  const onSaved = () => { setEditing(null); reload() }

  const remove = async (loc) => {
    if (!confirm(`Delete location "${loc.name}"? This can't be undone.`)) return
    try {
      const base = import.meta.env.VITE_API_URL || ''
      const token = localStorage.getItem('intellix_token')
      const res = await fetch(`${base}/api/locations/${loc.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.references) {
          alert(`Can't delete — ${data.references.clients} clients, ${data.references.jobs} jobs, ${data.references.proposals} proposals still reference this location.`)
          return
        }
        throw new Error(data.error || `${res.status}`)
      }
      reload()
    } catch (err) { alert(err.message) }
  }

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <div>
          <div style={s.cardHeaderTitle}>Locations</div>
          <div style={s.cardHeaderSub}>
            Each client, job, and proposal is tagged with a location. The location's Google review URL is used in post-job check-in emails.
          </div>
        </div>
        {isAdmin && (
          <button onClick={() => setEditing('new')} style={primaryBtn}>+ Add location</button>
        )}
      </div>

      {error && <div style={{ fontSize: 12, color: '#d70015', marginBottom: 8 }}>{error}</div>}
      {rows == null && <div style={{ fontSize: 12, color: 'var(--text3)' }}>Loading…</div>}
      {rows != null && rows.length === 0 && <div style={{ fontSize: 12, color: 'var(--text3)' }}>No locations yet.</div>}
      {rows != null && rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map(loc => (
            <div key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{loc.name}</span>
                  {loc.slug && <span style={{ fontSize: 10.5, color: 'var(--text3)', fontFamily: 'ui-monospace, monospace' }}>#{loc.slug}</span>}
                  {!loc.google_review_url && <span style={{ fontSize: 10, color: '#a85a00', background: 'rgba(255,149,0,0.12)', padding: '2px 7px', borderRadius: 999, fontWeight: 600 }}>NO REVIEW URL</span>}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 3 }}>
                  {[loc.support_email, loc.support_phone, loc.address].filter(Boolean).join(' · ') || <em style={{ color: 'var(--text3)' }}>No contact info</em>}
                </div>
              </div>
              {isAdmin && (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => setEditing(loc)} style={{ ...ghostBtn, padding: '6px 12px', fontSize: 11.5 }}>Edit</button>
                  <button onClick={() => remove(loc)} style={{ ...ghostBtn, padding: '6px 12px', fontSize: 11.5, borderColor: 'rgba(255,59,48,0.3)', color: '#d70015' }}>Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {!isAdmin && (
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10 }}>
          Only admins can add or edit locations.
        </div>
      )}

      {editing && (
        <LocationModal
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}
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
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    apiGet('/api/settings')
      .then(setData)
      .catch(err => {
        console.error('Failed to load settings', err)
        // Fall back to empty defaults so the form still renders if /api/settings 500s.
        setData({})
      })
      .finally(() => setLoading(false))

    // Fetch the current user's role to gate the Locations admin controls.
    const base = import.meta.env.VITE_API_URL || ''
    const token = localStorage.getItem('intellix_token')
    if (token) {
      fetch(`${base}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(u => setIsAdmin(u?.role === 'Admin'))
        .catch(() => {})
    }
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

          <div style={s.sectionTitle}>Check-ins</div>
          <CheckIns data={data} onChange={set} />

          <div style={s.sectionTitle}>Locations</div>
          <Locations isAdmin={isAdmin} />

          <div style={s.sectionTitle}>Notifications</div>
          <Notifications data={data} onChange={set} />

          <div style={s.sectionTitle}>Account</div>
          <Account />
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { capturePhoto, dataUrlToBlob } from './lib/photo'

const BASE = import.meta.env.VITE_API_URL || ''
const MAX_BYTES = 5 * 1024 * 1024

const FONT = '"Montserrat", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'

const s = {
  page: {
    minHeight: '100dvh',
    background: '#fff',
    color: '#1d1d1f',
    fontFamily: FONT,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '32px 20px 60px',
    boxSizing: 'border-box',
  },
  inner: { width: '100%', maxWidth: 460 },
  logoWrap: { display: 'flex', justifyContent: 'center', marginBottom: 24 },
  h1: { fontSize: 24, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.3px', color: '#1d1d1f' },
  sub: { fontSize: 14.5, color: '#555', margin: '0 0 28px', lineHeight: 1.5 },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: 12.5, fontWeight: 600, color: '#1d1d1f', marginBottom: 6 },
  input: {
    width: '100%',
    padding: '14px 14px',
    fontSize: 16, // 16px+ prevents iOS auto-zoom on focus
    border: '1px solid #d2d2d7',
    borderRadius: 10,
    background: '#fff',
    color: '#1d1d1f',
    fontFamily: FONT,
    boxSizing: 'border-box',
    outline: 'none',
    minHeight: 48,
  },
  textarea: {
    width: '100%',
    padding: '14px',
    fontSize: 16,
    border: '1px solid #d2d2d7',
    borderRadius: 10,
    background: '#fff',
    color: '#1d1d1f',
    fontFamily: FONT,
    boxSizing: 'border-box',
    outline: 'none',
    minHeight: 120,
    resize: 'vertical',
  },
  fileBtn: {
    display: 'flex', alignItems: 'center', gap: 10,
    width: '100%', padding: '14px',
    border: '1.5px dashed #c7c7cc', borderRadius: 10,
    background: '#fafafa', color: '#444', fontSize: 14, fontWeight: 500,
    cursor: 'pointer', fontFamily: FONT, minHeight: 56,
    boxSizing: 'border-box',
  },
  filePreview: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: 12, border: '1px solid #d2d2d7', borderRadius: 10,
    background: '#f5f5f7',
  },
  thumb: { width: 56, height: 56, borderRadius: 8, objectFit: 'cover', flexShrink: 0 },
  fileName: { fontSize: 13.5, fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  fileRemove: { background: 'none', border: 'none', color: '#0066cc', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, padding: '6px 8px' },
  honeypot: { position: 'absolute', left: -10000, top: 'auto', width: 1, height: 1, overflow: 'hidden' },
  submit: {
    width: '100%', marginTop: 12,
    padding: '16px',
    fontSize: 16, fontWeight: 600,
    border: 'none', borderRadius: 12,
    background: '#0066cc', color: '#fff',
    cursor: 'pointer', fontFamily: FONT,
    minHeight: 52,
    transition: 'background 0.15s',
  },
  submitDisabled: { background: '#9bb8d4', cursor: 'not-allowed' },
  required: { color: '#ff3b30', marginLeft: 4 },
  err: {
    background: '#fff5f4', border: '1px solid #ffd6d2', color: '#b3261e',
    padding: '12px 14px', borderRadius: 10, fontSize: 13.5, marginBottom: 16, lineHeight: 1.5,
  },
  successWrap: {
    minHeight: '100dvh', background: '#fff',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '40px 20px', textAlign: 'center', fontFamily: FONT, color: '#1d1d1f',
    boxSizing: 'border-box',
  },
  checkCircle: {
    width: 72, height: 72, borderRadius: '50%',
    background: 'rgba(52,199,89,0.12)', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 22,
  },
  successH: { fontSize: 22, fontWeight: 700, margin: '0 0 12px', letterSpacing: '-0.3px' },
  successP: { fontSize: 15, color: '#3a3a3c', margin: '0 0 24px', maxWidth: 360, lineHeight: 1.55 },
  ref: { fontSize: 12, color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 },
  refNum: { fontSize: 22, fontWeight: 700, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: '#1d1d1f', letterSpacing: '0.5px' },
  footer: { marginTop: 40, fontSize: 11.5, color: '#8e8e93' },
}

function IntellixLogo() {
  return (
    <svg viewBox="0 0 160 52" width={150} height={48} xmlns="http://www.w3.org/2000/svg" aria-label="Intellix">
      <text x="0" y="34" fontFamily="Montserrat, sans-serif" fontWeight="700" fontSize="36" letterSpacing="-1" fill="#1d1d1f">intelli</text>
      <text x="101" y="34" fontFamily="Montserrat, sans-serif" fontWeight="700" fontSize="36" letterSpacing="-1" fill="#0066cc">x</text>
      <line x1="0" y1="39" x2="148" y2="39" stroke="#00000018" strokeWidth="0.75" />
      <circle cx="3" cy="44" r="2.5" fill="#34c759" />
      <circle cx="11" cy="44" r="2.5" fill="#ff9500" />
      <circle cx="19" cy="44" r="2.5" fill="#ff3b30" />
      <circle cx="27" cy="44" r="2.5" fill="#0066cc" />
      <text x="35" y="48" fontFamily="Montserrat, sans-serif" fontWeight="500" fontSize="6.5" letterSpacing="2.2" fill="#aeaeb2">HOME AUTOMATION HUB</text>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default function Support() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', issue: '', website: '' })
  const [photo, setPhoto] = useState(null)
  const [photoName, setPhotoName] = useState('')
  const [photoPreview, setPhotoPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState(null)
  const [success, setSuccess] = useState(null)

  function setField(k, v) {
    setForm(f => ({ ...f, [k]: v }))
  }

  // Capture via the cross-platform adapter: native Camera (Take Photo /
  // Choose from Library) on iOS, hidden file input on web. Both yield a
  // dataUrl, kept for preview and converted to a Blob at submit time.
  async function addPhoto() {
    const captured = await capturePhoto()
    if (!captured?.dataUrl) return
    const blob = dataUrlToBlob(captured.dataUrl)
    if (blob.size > MAX_BYTES) {
      setErr('Photo must be 5MB or smaller.')
      return
    }
    const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
    setErr(null)
    setPhoto(blob)
    setPhotoName(`photo.${ext}`)
    setPhotoPreview(captured.dataUrl)
  }

  function clearPhoto() {
    setPhoto(null)
    setPhotoName('')
    setPhotoPreview(null)
  }

  async function submit(e) {
    e.preventDefault()
    setErr(null)

    const required = ['name', 'email', 'phone', 'address', 'issue']
    const missing = required.filter(k => !form[k].trim())
    if (missing.length) {
      setErr('Please fill in all required fields.')
      return
    }

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('name', form.name.trim())
      fd.append('email', form.email.trim())
      fd.append('phone', form.phone.trim())
      fd.append('address', form.address.trim())
      fd.append('issue', form.issue.trim())
      fd.append('website', form.website) // honeypot — should be empty
      if (photo) fd.append('photo', photo, photoName || 'photo.jpg')

      const res = await fetch(`${BASE}/api/support/intake`, { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || `Submission failed (${res.status})`)
      }
      setSuccess({
        reference: data.reference_number,
        clientMatched: data.client_matched,
      })
    } catch (e) {
      setErr(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div style={s.successWrap}>
        <div style={s.checkCircle}><CheckIcon /></div>
        <h1 style={s.successH}>Got it — we'll be in touch.</h1>
        <p style={s.successP}>
          A team member will reach out within 1 business day. Save this reference number in case you need to follow up.
        </p>
        <div style={s.ref}>Reference</div>
        <div style={s.refNum}>{success.reference}</div>
        <div style={s.footer}>intellihomeAV · Home Automation Hub</div>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <div style={s.logoWrap}><IntellixLogo /></div>
        <h1 style={s.h1}>Need a hand with your system?</h1>
        <p style={s.sub}>
          Tell us what's going on and we'll get back to you within one business day.
        </p>

        {err && <div style={s.err}>{err}</div>}

        <form onSubmit={submit} noValidate>
          {/* Honeypot — bots fill this; humans don't see it. */}
          <div style={s.honeypot} aria-hidden="true">
            <label>
              Website
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={e => setField('website', e.target.value)}
              />
            </label>
          </div>

          <div style={s.field}>
            <label style={s.label}>Name<span style={s.required}>*</span></label>
            <input
              style={s.input}
              type="text"
              autoComplete="name"
              value={form.name}
              onChange={e => setField('name', e.target.value)}
              required
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>Email<span style={s.required}>*</span></label>
            <input
              style={s.input}
              type="email"
              inputMode="email"
              autoComplete="email"
              value={form.email}
              onChange={e => setField('email', e.target.value)}
              required
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>Phone<span style={s.required}>*</span></label>
            <input
              style={s.input}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={e => setField('phone', e.target.value)}
              required
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>Address<span style={s.required}>*</span></label>
            <input
              style={s.input}
              type="text"
              autoComplete="street-address"
              value={form.address}
              onChange={e => setField('address', e.target.value)}
              required
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>What's wrong?<span style={s.required}>*</span></label>
            <textarea
              style={s.textarea}
              value={form.issue}
              onChange={e => setField('issue', e.target.value)}
              placeholder="Describe the problem in as much detail as you can — when it started, what device or area, what you've tried."
              required
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>Photo (optional)</label>
            {!photo && (
              <button type="button" onClick={addPhoto} style={s.fileBtn}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span>Tap to add a photo</span>
              </button>
            )}
            {photo && (
              <div style={s.filePreview}>
                {photoPreview
                  ? <img src={photoPreview} alt="Selected photo" style={s.thumb} />
                  : <div style={{ ...s.thumb, background: '#e5e5ea', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#8e8e93' }}>HEIC</div>}
                <div style={s.fileName}>{photoName}</div>
                <button type="button" onClick={clearPhoto} style={s.fileRemove}>Remove</button>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{ ...s.submit, ...(submitting ? s.submitDisabled : {}) }}
          >
            {submitting ? 'Submitting…' : 'Submit request'}
          </button>
        </form>

        <div style={s.footer}>intellihomeAV · Home Automation Hub</div>
      </div>
    </div>
  )
}

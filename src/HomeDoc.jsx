import { useState, useEffect, useRef } from 'react'
import { getToken } from './lib/auth'
import * as haptics from './lib/haptics'

const BASE = import.meta.env.VITE_API_URL || ''

const DOC_LABELS = {
  handover_guide: 'System Handover Guide',
  quick_reference: 'Quick Reference Card',
}

// --- styles ---------------------------------------------------------------
const lbl = { fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }
const inp = { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 12.5, color: 'var(--text)', fontFamily: 'var(--font)', outline: 'none', boxSizing: 'border-box' }
const primaryBtn = { padding: '10px 18px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: '#fff', fontFamily: 'var(--font)' }
const darkBtn = { ...primaryBtn, background: '#1d1d1f' }
const ghostBtn = { padding: '8px 14px', borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontFamily: 'var(--font)' }
const card = { background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: 18 }

// --- authed fetch (homedocs routes require auth) --------------------------
async function authedJson(path, init = {}) {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `${res.status}`)
  return data
}

// --- branded document wrapper (also used for the PDF) ---------------------
// Wraps Claude's HTML in IntelliHome AV chrome with print-friendly CSS.
function brandedDocHtml(innerHtml, docType, clientName) {
  return `
<style>
  .ihav-doc { font-family: Inter, -apple-system, "Helvetica Neue", Arial, sans-serif; color: #1d1d1f; line-height: 1.6; }
  .ihav-doc * { box-sizing: border-box; }
  .ihav-head { display: flex; align-items: baseline; gap: 10px; border-bottom: 3px solid #0066cc; padding-bottom: 14px; margin-bottom: 22px; }
  .ihav-logo { font-weight: 800; font-size: 26px; letter-spacing: -0.5px; }
  .ihav-logo .x { color: #0066cc; }
  .ihav-kicker { margin-left: auto; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #6e6e73; }
  .ihav-doc h1 { font-size: 24px; font-weight: 800; margin: 18px 0 8px; color: #1d1d1f; }
  .ihav-doc h2 { font-size: 16px; font-weight: 700; margin: 20px 0 8px; color: #0066cc; border-bottom: 1px solid #e8e8ed; padding-bottom: 4px; }
  .ihav-doc h3 { font-size: 13.5px; font-weight: 700; margin: 14px 0 6px; }
  .ihav-doc p, .ihav-doc li { font-size: 13px; }
  .ihav-doc ul, .ihav-doc ol { padding-left: 20px; margin: 8px 0; }
  .ihav-doc li { margin-bottom: 4px; }
  .ihav-doc table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12.5px; }
  .ihav-doc th, .ihav-doc td { border: 1px solid #e0e0e5; padding: 6px 9px; text-align: left; }
  .ihav-doc th { background: #f5f7fa; font-weight: 700; }
  .ihav-foot { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e8e8ed; font-size: 10.5px; color: #8e8e93; display: flex; justify-content: space-between; }
  .ihav-doc h1, .ihav-doc h2, .ihav-doc h3 { page-break-after: avoid; }
  .ihav-doc ul, .ihav-doc table, .ihav-doc img { page-break-inside: avoid; }
</style>
<div class="ihav-doc">
  <div class="ihav-head">
    <span class="ihav-logo">intelli<span class="x">home</span> AV</span>
    <span class="ihav-kicker">${DOC_LABELS[docType] || 'Document'}</span>
  </div>
  ${innerHtml}
  <div class="ihav-foot">
    <span>IntelliHome AV · Portland (503) 500-0180 · Los Angeles (310) 409-7655 · info@intellihomeav.com</span>
    <span>${clientName || ''}</span>
  </div>
</div>`
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Convert a rendered DOM node to a downloaded PDF via html2pdf (dynamic import
// — the lib is large and client-only).
async function downloadPdf(node, filename) {
  const mod = await import('html2pdf.js')
  const html2pdf = mod.default || mod
  await html2pdf().set({
    margin: 10,
    filename,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'] },
  }).from(node).save()
}

// --- preview pane ---------------------------------------------------------
function DocPreview({ doc, onClose }) {
  const ref = useRef(null)
  const [downloading, setDownloading] = useState(false)
  const clientName = doc.client_name || doc.form_data?.client_name || 'document'

  const onDownload = async () => {
    if (!ref.current) return
    haptics.medium()
    setDownloading(true)
    try {
      const safe = String(clientName).replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '')
      const date = (doc.created_at || new Date().toISOString()).slice(0, 10)
      await downloadPdf(ref.current, `${safe}_${doc.doc_type}_${date}.pdf`)
    } catch (err) {
      alert(`PDF export failed: ${err.message}`)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border2)', background: 'var(--bg2)' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>
          {DOC_LABELS[doc.doc_type] || 'Document'} · {clientName}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onDownload} disabled={downloading} style={{ ...primaryBtn, padding: '8px 14px', fontSize: 12, opacity: downloading ? 0.6 : 1 }}>
            {downloading ? 'Exporting…' : 'Download PDF'}
          </button>
          {onClose && <button onClick={onClose} style={ghostBtn}>Close</button>}
        </div>
      </div>
      {/* White, fixed-width canvas so the on-screen preview matches the PDF. */}
      <div style={{ background: '#e9eaee', padding: 20, maxHeight: '70vh', overflowY: 'auto' }}>
        <div
          ref={ref}
          style={{ background: '#fff', width: 794, maxWidth: '100%', margin: '0 auto', padding: 40, boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }}
          dangerouslySetInnerHTML={{ __html: brandedDocHtml(doc.generated_html || '', doc.doc_type, clientName) }}
        />
      </div>
    </div>
  )
}

export default function HomeDoc() {
  const [clients, setClients] = useState([])
  const [jobs, setJobs] = useState([])
  const [team, setTeam] = useState([])
  const [me, setMe] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState({
    client_id: '', job_id: '', address: '', contact_name: '',
    phone: '', email: '', install_date: '', technicians: [],
  })
  const [details, setDetails] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const [generating, setGenerating] = useState(null) // doc_type currently generating
  const [preview, setPreview] = useState(null)
  const [viewing, setViewing] = useState(null) // history doc opened in modal
  const [error, setError] = useState('')
  const previewRef = useRef(null)

  useEffect(() => {
    Promise.all([
      fetch(`${BASE}/api/clients`).then(r => r.ok ? r.json() : []).catch(() => []),
      authedJson('/api/jobs').catch(() => []),
      authedJson('/api/team').catch(() => []),
      authedJson('/api/auth/me').catch(() => null),
      authedJson('/api/homedocs').catch(() => []),
    ]).then(([c, j, t, u, h]) => {
      setClients(c); setJobs(j); setTeam(t); setMe(u); setHistory(h)
    }).finally(() => setLoading(false))
  }, [])

  const isAdmin = me?.role === 'Admin'

  // Selecting a client auto-fills contact fields (editable).
  const onClientChange = (id) => {
    const c = clients.find(x => String(x.id) === String(id))
    setForm(f => ({
      ...f,
      client_id: id,
      address: c?.address || f.address,
      contact_name: c?.name || f.contact_name,
      phone: c?.phone || f.phone,
      email: c?.email || f.email,
      job_id: '',
    }))
  }

  const clientJobs = jobs.filter(j => String(j.client_id) === String(form.client_id))
  const selectedClient = clients.find(c => String(c.id) === String(form.client_id))

  const toggleTech = (initials) => {
    setForm(f => ({
      ...f,
      technicians: f.technicians.includes(initials)
        ? f.technicians.filter(t => t !== initials)
        : [...f.technicians, initials],
    }))
  }

  const generate = async (docType) => {
    if (!form.client_id) { setError('Pick a client first.'); return }
    if (!details.trim()) { setError('Add installation details before generating.'); return }
    setError(''); setGenerating(docType); haptics.medium()
    try {
      const form_data = {
        client_name: selectedClient?.name || form.contact_name,
        contact_name: form.contact_name,
        phone: form.phone,
        email: form.email,
        address: form.address,
        install_date: form.install_date,
        technicians: form.technicians,
      }
      const doc = await authedJson('/api/homedocs/generate', {
        method: 'POST',
        body: JSON.stringify({
          client_id: Number(form.client_id),
          job_id: form.job_id ? Number(form.job_id) : null,
          doc_type: docType,
          form_data,
          details_text: details,
        }),
      })
      setPreview(doc)
      setHistory(h => [doc, ...h])
      setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    } catch (err) {
      setError(`Generation failed: ${err.message}`)
    } finally {
      setGenerating(null)
    }
  }

  const openHistory = async (row) => {
    try {
      // List rows omit nothing, but fetch the single to be safe (full html).
      const full = await authedJson(`/api/homedocs/${row.id}`)
      setViewing(full)
    } catch (err) {
      alert(`Couldn't open document: ${err.message}`)
    }
  }

  const deleteDoc = async (row, e) => {
    e.stopPropagation()
    if (!window.confirm('Delete this document?')) return
    haptics.heavy()
    try {
      await authedJson(`/api/homedocs/${row.id}`, { method: 'DELETE' })
      setHistory(h => h.filter(x => x.id !== row.id))
      if (viewing?.id === row.id) setViewing(null)
      if (preview?.id === row.id) setPreview(null)
    } catch (err) {
      alert(`Delete failed: ${err.message}`)
    }
  }

  const clearForm = () => {
    setPreview(null)
    setForm({ client_id: '', job_id: '', address: '', contact_name: '', phone: '', email: '', install_date: '', technicians: [] })
    setDetails('')
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '13px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>HomeDoc</div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>HomeDoc — Customer Documents</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', maxWidth: 900, width: '100%', margin: '0 auto' }}>
        {error && (
          <div style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#d70015', fontWeight: 500 }}>{error}</div>
        )}

        {/* CLIENT & CONTACT */}
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Client &amp; Contact</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={lbl}>Client</div>
              <select style={inp} value={form.client_id} onChange={e => onClientChange(e.target.value)}>
                <option value="">— Select a client —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <div style={lbl}>Link to job (optional)</div>
              <select style={inp} value={form.job_id} onChange={e => set('job_id', e.target.value)} disabled={!form.client_id}>
                <option value="">— None —</option>
                {clientJobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={lbl}>Site address</div>
              <input style={inp} value={form.address} onChange={e => set('address', e.target.value)} placeholder="Street address" />
            </div>
            <div>
              <div style={lbl}>Primary contact</div>
              <input style={inp} value={form.contact_name} onChange={e => set('contact_name', e.target.value)} placeholder="Contact name" />
            </div>
            <div>
              <div style={lbl}>Install date</div>
              <input style={inp} type="date" value={form.install_date} onChange={e => set('install_date', e.target.value)} />
            </div>
            <div>
              <div style={lbl}>Phone</div>
              <input style={inp} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(503) 555-0100" />
            </div>
            <div>
              <div style={lbl}>Email</div>
              <input style={inp} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="name@email.com" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={lbl}>Technicians</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {team.length === 0 && <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>No team members on file.</span>}
                {team.map(m => {
                  const on = form.technicians.includes(m.initials || m.name)
                  const key = m.initials || m.name
                  return (
                    <button key={m.id} type="button" onClick={() => toggleTech(key)}
                      style={{ padding: '5px 11px', borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'rgba(0,102,204,0.08)' : 'transparent', color: on ? 'var(--accent)' : 'var(--text2)' }}>
                      {m.name}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* DETAILS */}
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Installation Details</div>
          <textarea
            style={{ ...inp, minHeight: 180, resize: 'vertical', lineHeight: 1.5 }}
            value={details}
            onChange={e => setDetails(e.target.value)}
            placeholder="Describe what was installed, programmed, and configured. Include equipment list, key programming notes, customer preferences, scene names, network setup, and anything else the customer or your team will need to reference later."
          />
        </div>

        {/* GENERATE */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          <button onClick={() => generate('handover_guide')} disabled={!!generating} style={{ ...primaryBtn, opacity: generating ? 0.6 : 1, cursor: generating ? 'wait' : 'pointer' }}>
            {generating === 'handover_guide' ? 'Generating…' : 'Generate Handover Guide'}
          </button>
          <button onClick={() => generate('quick_reference')} disabled={!!generating} style={{ ...darkBtn, opacity: generating ? 0.6 : 1, cursor: generating ? 'wait' : 'pointer' }}>
            {generating === 'quick_reference' ? 'Generating…' : 'Generate Quick Reference Card'}
          </button>
          {generating && <span style={{ alignSelf: 'center', fontSize: 11.5, color: 'var(--text3)' }}>Claude is writing — this can take 5–15s…</span>}
        </div>

        {/* PREVIEW */}
        {preview && (
          <div ref={previewRef} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Preview <span style={{ fontWeight: 500, color: 'var(--text3)' }}>(saved automatically)</span></div>
              <button onClick={clearForm} style={ghostBtn}>Save &amp; clear form</button>
            </div>
            <DocPreview doc={preview} />
          </div>
        )}

        {/* HISTORY */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Document History</div>
          {history.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>No documents generated yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.map(row => {
                const canDelete = isAdmin || row.generated_by_user_id === me?.id
                return (
                  <div key={row.id} onClick={() => openHistory(row)} style={{ ...card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{row.client_name || row.form_data?.client_name || 'Client'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{DOC_LABELS[row.doc_type] || row.doc_type} · {fmtDate(row.created_at)}{row.generated_by_name ? ` · ${row.generated_by_name}` : ''}</div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); openHistory(row) }} style={{ ...ghostBtn, fontSize: 11 }}>View</button>
                    {canDelete && (
                      <button onClick={(e) => deleteDoc(row, e)} aria-label="Delete" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* HISTORY VIEW MODAL */}
      {viewing && (
        <div onClick={() => setViewing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(880px, 100%)', maxHeight: '90vh', overflow: 'hidden', borderRadius: 12 }}>
            <DocPreview doc={viewing} onClose={() => setViewing(null)} />
          </div>
        </div>
      )}
    </div>
  )
}

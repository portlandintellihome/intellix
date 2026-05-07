import { useState, useEffect, useMemo, useRef } from 'react'
import { apiGet } from './lib/api'
import { colorForInitials } from './lib/color'

const TOKEN_KEY = 'intellix_token'
const BASE = import.meta.env.VITE_API_URL || ''

const lbl = { fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5 }
const inp = { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 11px', fontSize: 12.5, color: 'var(--text)', fontFamily: 'var(--font)', outline: 'none', boxSizing: 'border-box' }
const primaryBtn = { padding: '8px 18px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#1d1d1f', color: '#fff', fontFamily: 'var(--font)' }
const ghostBtn = { padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontFamily: 'var(--font)' }

const statusStyle = {
  Draft: { bg: 'rgba(174,174,178,0.12)', color: '#6e6e73' },
  Sent: { bg: 'rgba(0,102,204,0.08)', color: '#0066cc' },
  Accepted: { bg: 'rgba(52,199,89,0.09)', color: '#248a3d' },
  Declined: { bg: 'rgba(255,59,48,0.08)', color: '#d70015' },
  'On site': { bg: 'rgba(52,199,89,0.09)', color: '#248a3d' },
  'In progress': { bg: 'rgba(0,102,204,0.08)', color: '#0066cc' },
  Review: { bg: 'rgba(255,149,0,0.09)', color: '#c93400' },
  Scheduled: { bg: 'rgba(83,74,183,0.09)', color: '#534AB7' },
  Complete: { bg: 'rgba(52,199,89,0.09)', color: '#248a3d' },
}

function authHeaders() {
  const token = localStorage.getItem(TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `${res.status} ${res.statusText}`)
  return data
}

function Badge({ text }) {
  if (!text) return null
  const st = statusStyle[text] || { bg: 'var(--bg4)', color: 'var(--text2)' }
  return (
    <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 5, fontSize: 10.5, fontWeight: 700, background: st.bg, color: st.color }}>
      {text}
    </span>
  )
}

function LocationBadge({ name }) {
  if (!name) return null
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600, background: 'rgba(0,102,204,0.08)', color: '#0066cc' }}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
      {name}
    </span>
  )
}

function Avatar({ initials, size = 26 }) {
  if (!initials) return null
  const color = colorForInitials(initials)
  return (
    <div style={{ width: size, height: size, minWidth: size, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 700, color: '#fff' }}>
      {initials}
    </div>
  )
}

// Searchable typeahead for picking a client. Calls onChange(clientId) when
// a result is clicked. If onClientPicked is supplied, it also passes the
// full client object so callers can pull location_id off it for defaulting.
function ClientPicker({ clients, value, onChange, onClientPicked, locations }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const selected = clients.find(c => c.id === value)

  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return clients.slice(0, 30)
    return clients
      .filter(c => (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q))
      .slice(0, 30)
  }, [clients, query])

  const display = open ? query : (selected?.name || '')

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        style={inp}
        value={display}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => { setQuery(''); setOpen(true) }}
        placeholder="Search clients..."
      />
      {selected && !open && (
        <button
          type="button"
          onClick={() => { onChange(null); onClientPicked?.(null); setQuery('') }}
          style={{ position: 'absolute', right: 8, top: 8, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 14, cursor: 'pointer', padding: '0 4px' }}
        >×</button>
      )}
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, maxHeight: 220, overflowY: 'auto', zIndex: 1000, boxShadow: '0 6px 20px rgba(0,0,0,0.18)' }}>
          {filtered.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text3)' }}>No matches</div>
          )}
          {filtered.map(c => {
            const loc = locations?.find(l => l.id === c.location_id)
            return (
              <div
                key={c.id}
                onClick={() => { onChange(c.id); onClientPicked?.(c); setOpen(false); setQuery('') }}
                style={{ padding: '8px 12px', fontSize: 12.5, cursor: 'pointer', borderBottom: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
                onMouseDown={e => e.preventDefault()}
              >
                <span style={{ color: 'var(--text)', fontWeight: 500 }}>{c.name || '(no name)'}</span>
                {loc && <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>{loc.name}</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function LocationSelect({ locations, value, onChange }) {
  return (
    <select
      style={inp}
      value={value || ''}
      onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
    >
      <option value="">— Unassigned —</option>
      {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
    </select>
  )
}

// --- JobModal — handles both create (initial=null) and edit (initial=job)
function JobModal({ initial, clients, locations, team, onClose, onSaved }) {
  const isEdit = Boolean(initial?.id)
  const [form, setForm] = useState({
    name: initial?.name || '',
    client_id: initial?.client_id || null,
    location_id: initial?.location_id || null,
    address: initial?.address || '',
    scope: initial?.scope || '',
    status: initial?.status || 'Scheduled',
    phase: initial?.phase || 'Scheduling',
    priority: initial?.priority || 'Normal',
    start_date: initial?.start_date ? String(initial.start_date).slice(0, 10) : '',
    assigned: Array.isArray(initial?.assigned) ? initial.assigned : [],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleAssign = (initials) => {
    setForm(f => ({ ...f, assigned: f.assigned.includes(initials) ? f.assigned.filter(a => a !== initials) : [...f.assigned, initials] }))
  }

  const onClientPicked = (client) => {
    if (!client) return
    // Default location from client only if user hasn't set one yet (or
    // hasn't deviated from the previously-defaulted client location).
    if (!form.location_id || isEdit === false) {
      set('location_id', client.location_id || null)
    }
  }

  const submit = async () => {
    setError('')
    if (!form.name.trim()) { setError('Job name is required'); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        client_id: form.client_id,
        location_id: form.location_id,
        address: form.address || null,
        scope: form.scope || null,
        status: form.status,
        phase: form.phase,
        priority: form.priority,
        start_date: form.start_date || null,
      }
      const saved = isEdit
        ? await api(`/api/jobs/${initial.id}`, { method: 'PATCH', body: payload })
        : await api('/api/jobs', { method: 'POST', body: payload })
      onSaved(saved)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 14, width: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px', borderBottom: '1px solid var(--border2)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{isEdit ? 'Edit job' : 'New job'}</div>
          <button onClick={onClose} style={{ background: 'var(--bg4)', border: 'none', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', color: 'var(--text2)', fontSize: 14 }}>✕</button>
        </div>
        <div style={{ padding: '18px 22px' }}>
          <div style={{ marginBottom: 12 }}>
            <div style={lbl}>Job name</div>
            <input style={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Smith residence install" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={lbl}>Client</div>
              <ClientPicker
                clients={clients}
                value={form.client_id}
                onChange={id => set('client_id', id)}
                onClientPicked={onClientPicked}
                locations={locations}
              />
            </div>
            <div>
              <div style={lbl}>Location</div>
              <LocationSelect locations={locations} value={form.location_id} onChange={v => set('location_id', v)} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={lbl}>Site address</div>
            <input style={inp} value={form.address} onChange={e => set('address', e.target.value)} placeholder="Street address" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={lbl}>Description / scope</div>
            <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} value={form.scope} onChange={e => set('scope', e.target.value)} placeholder="Brief description of the work..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={lbl}>Status</div>
              <select style={inp} value={form.status} onChange={e => set('status', e.target.value)}>
                {['Scheduled', 'In progress', 'On site', 'Review', 'Complete'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <div style={lbl}>Phase</div>
              <select style={inp} value={form.phase} onChange={e => set('phase', e.target.value)}>
                {['Scheduling', 'Installation', 'Programming', 'Sign-off', 'Complete'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <div style={lbl}>Priority</div>
              <select style={inp} value={form.priority} onChange={e => set('priority', e.target.value)}>
                {['Normal', 'High', 'Urgent'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={lbl}>Start date</div>
            <input style={inp} type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
          </div>
          {team.length > 0 && (
            <div style={{ marginBottom: 4 }}>
              <div style={lbl}>Assign team</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {team.map(m => {
                  const color = colorForInitials(m.initials)
                  const sel = form.assigned.includes(m.initials)
                  return (
                    <div key={m.id} onClick={() => toggleAssign(m.initials)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 7, border: `1px solid ${sel ? color : 'var(--border)'}`, background: sel ? `${color}18` : 'transparent', cursor: 'pointer' }}>
                      <Avatar initials={m.initials} size={20} />
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)' }}>{m.initials}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {error && <div style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.25)', borderRadius: 8, padding: '8px 12px', fontSize: 11.5, color: '#d70015', fontWeight: 500, marginTop: 12 }}>{error}</div>}
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border2)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={ghostBtn}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Create job')}
          </button>
        </div>
      </div>
    </div>
  )
}

// --- ProposalModal — same shape, different fields
function ProposalModal({ initial, clients, locations, onClose, onSaved }) {
  const isEdit = Boolean(initial?.id)
  const [form, setForm] = useState({
    client_id: initial?.client_id || null,
    location_id: initial?.location_id || null,
    address: initial?.address || '',
    scope: initial?.scope || '',
    devices: initial?.devices || '',
    rooms: initial?.rooms || '',
    labor: initial?.labor || '',
    materials: initial?.materials || '',
    total: initial?.total || '',
    status: initial?.status || 'Draft',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const onClientPicked = (client) => {
    if (!client) return
    if (!form.location_id) set('location_id', client.location_id || null)
  }

  const submit = async () => {
    setError('')
    setSaving(true)
    try {
      const num = (v) => v === '' || v == null ? null : Number(v)
      const payload = {
        client_id: form.client_id,
        location_id: form.location_id,
        address: form.address || null,
        scope: form.scope || null,
        devices: form.devices || null,
        rooms: num(form.rooms),
        labor: num(form.labor),
        materials: num(form.materials),
        total: num(form.total),
        status: form.status,
      }
      const saved = isEdit
        ? await api(`/api/proposals/${initial.id}`, { method: 'PATCH', body: payload })
        : await api('/api/proposals', { method: 'POST', body: payload })
      onSaved(saved)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 14, width: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px', borderBottom: '1px solid var(--border2)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{isEdit ? 'Edit proposal' : 'New proposal'}</div>
          <button onClick={onClose} style={{ background: 'var(--bg4)', border: 'none', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', color: 'var(--text2)', fontSize: 14 }}>✕</button>
        </div>
        <div style={{ padding: '18px 22px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={lbl}>Client</div>
              <ClientPicker clients={clients} value={form.client_id} onChange={id => set('client_id', id)} onClientPicked={onClientPicked} locations={locations} />
            </div>
            <div>
              <div style={lbl}>Location</div>
              <LocationSelect locations={locations} value={form.location_id} onChange={v => set('location_id', v)} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={lbl}>Site address</div>
            <input style={inp} value={form.address} onChange={e => set('address', e.target.value)} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={lbl}>Description / scope</div>
            <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={form.scope} onChange={e => set('scope', e.target.value)} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={lbl}>Devices</div>
            <input style={inp} value={form.devices} onChange={e => set('devices', e.target.value)} placeholder="e.g. Control4 EA-3, Sonos Beam, Lutron Caseta" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={lbl}>Rooms</div>
              <input style={inp} type="number" min="0" value={form.rooms} onChange={e => set('rooms', e.target.value)} />
            </div>
            <div>
              <div style={lbl}>Labor</div>
              <input style={inp} type="number" min="0" step="0.01" value={form.labor} onChange={e => set('labor', e.target.value)} />
            </div>
            <div>
              <div style={lbl}>Materials</div>
              <input style={inp} type="number" min="0" step="0.01" value={form.materials} onChange={e => set('materials', e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={lbl}>Total</div>
              <input style={inp} type="number" min="0" step="0.01" value={form.total} onChange={e => set('total', e.target.value)} />
            </div>
            <div>
              <div style={lbl}>Status</div>
              <select style={inp} value={form.status} onChange={e => set('status', e.target.value)}>
                {['Draft', 'Sent', 'Accepted', 'Declined'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          {error && <div style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.25)', borderRadius: 8, padding: '8px 12px', fontSize: 11.5, color: '#d70015', fontWeight: 500, marginTop: 12 }}>{error}</div>}
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border2)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={ghostBtn}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Create proposal')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function JobsProposals() {
  const [jobs, setJobs] = useState([])
  const [proposals, setProposals] = useState([])
  const [team, setTeam] = useState([])
  const [clients, setClients] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [tab, setTab] = useState('proposals')
  const [editingJob, setEditingJob] = useState(null)        // null | 'new' | job object
  const [editingProposal, setEditingProposal] = useState(null)
  const [selected, setSelected] = useState(null)

  const reload = async () => {
    setLoadError('')
    try {
      const [jobRows, propRows, teamRows, clientRows, locationRows] = await Promise.all([
        apiGet('/api/jobs').catch(() => []),
        apiGet('/api/proposals').catch(() => []),
        apiGet('/api/team').catch(() => []),
        apiGet('/api/clients').catch(() => []),
        fetch(`${BASE}/api/locations`, { headers: authHeaders() }).then(r => r.ok ? r.json() : []).catch(() => []),
      ])
      setJobs(jobRows.map(j => ({
        ...j,
        assigned: Array.isArray(j.assigned) ? j.assigned : [],
        client: j.client_name || '',
        start_date: j.start_date || '',
      })))
      setProposals(propRows.map(p => ({
        ...p,
        client: p.client_name || '',
        portalId: p.portal_id || '',
        labor: Number(p.labor) || 0,
        materials: Number(p.materials) || 0,
        total: Number(p.total) || 0,
        created: p.created_at ? new Date(p.created_at).toLocaleDateString() : '',
      })))
      setTeam(teamRows)
      setClients(clientRows)
      setLocations(locationRows)
    } catch (err) {
      setLoadError(err.message)
    }
  }

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [])

  const locationName = (id) => locations.find(l => l.id === id)?.name

  const onSaved = () => {
    setEditingJob(null)
    setEditingProposal(null)
    reload()
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '13px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Jobs & proposals</div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
      </div>
    )
  }

  const pendingJobs = jobs.filter(j => j.status === 'Scheduled')
  const activeJobs = jobs.filter(j => j.status !== 'Scheduled')
  const phaseCounts = ['Scheduling', 'Installation', 'Programming', 'Sign-off', 'Complete']
    .map(phase => ({ phase, count: activeJobs.filter(j => j.phase === phase).length }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {editingJob && (
        <JobModal
          initial={editingJob === 'new' ? null : editingJob}
          clients={clients}
          locations={locations}
          team={team}
          onClose={() => setEditingJob(null)}
          onSaved={onSaved}
        />
      )}
      {editingProposal && (
        <ProposalModal
          initial={editingProposal === 'new' ? null : editingProposal}
          clients={clients}
          locations={locations}
          onClose={() => setEditingProposal(null)}
          onSaved={onSaved}
        />
      )}

      {/* TOPBAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Jobs & proposals</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setEditingProposal('new')} style={{ ...ghostBtn, fontSize: 12 }}>+ New proposal</button>
          <button onClick={() => setEditingJob('new')} style={{ ...primaryBtn, fontSize: 12 }}>+ New job</button>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', padding: '0 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
        {[
          { key: 'proposals', label: `Proposals (${proposals.length})` },
          { key: 'pending',   label: `Pending (${pendingJobs.length})` },
          { key: 'jobs',      label: `Active jobs (${activeJobs.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setSelected(null) }} style={{ padding: '10px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'transparent', color: tab === t.key ? 'var(--accent)' : 'var(--text2)', borderBottom: `2px solid ${tab === t.key ? 'var(--accent)' : 'transparent'}`, fontFamily: 'var(--font)' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {loadError && (
          <div style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.25)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#d70015' }}>
            Failed to load: {loadError} <button onClick={reload} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#d70015', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'var(--font)' }}>Retry</button>
          </div>
        )}

        {/* PENDING */}
        {tab === 'pending' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingJobs.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)', fontSize: 13 }}>No pending jobs</div>
            )}
            {pendingJobs.map(job => (
              <div key={job.id} onClick={() => setSelected(selected?.id === job.id ? null : { kind: 'job', ...job })} style={{ background: 'var(--bg2)', border: `1px solid ${selected?.id === job.id ? 'var(--accent)' : 'var(--border2)'}`, borderRadius: 11, padding: '14px 16px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{job.name}</div>
                      <Badge text="Scheduled" />
                      <LocationBadge name={locationName(job.location_id)} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {job.client || 'No client'} · {job.address || '—'}{job.start_date ? ` · Starts ${job.start_date}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {job.assigned.map(a => <Avatar key={a} initials={a} size={26} />)}
                  </div>
                </div>
                {selected?.kind === 'job' && selected?.id === job.id && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border2)' }}>
                    {job.scope && <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 10 }}><strong style={{ color: 'var(--text)' }}>Scope:</strong> {job.scope}</div>}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={e => { e.stopPropagation(); setEditingJob(job) }} style={{ ...ghostBtn, fontSize: 11 }}>Edit</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ACTIVE JOBS */}
        {tab === 'jobs' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 20 }}>
              {phaseCounts.map(({ phase, count }) => (
                <div key={phase} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>{phase}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: count > 0 ? 'var(--accent)' : 'var(--text3)' }}>{count}</div>
                </div>
              ))}
            </div>
            {activeJobs.length === 0 && (
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '40px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>No active jobs</div>
                <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 14 }}>Create a job to start tracking work.</div>
                <button onClick={() => setEditingJob('new')} style={{ ...primaryBtn, fontSize: 12 }}>+ New job</button>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activeJobs.map(job => (
                <div key={job.id} onClick={() => setSelected(selected?.id === job.id ? null : { kind: 'job', ...job })} style={{ background: 'var(--bg2)', border: `1px solid ${selected?.id === job.id ? 'var(--accent)' : 'var(--border2)'}`, borderRadius: 11, padding: '14px 16px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{job.name}</div>
                        <Badge text={job.status} />
                        <LocationBadge name={locationName(job.location_id)} />
                        {job.priority === 'High' && <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,59,48,0.08)', color: '#d70015' }}>High priority</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                        {job.client || 'No client'} · {job.address || '—'}{job.start_date ? ` · Started ${job.start_date}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {job.phase && <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text2)', background: 'var(--bg3)', padding: '3px 9px', borderRadius: 5, border: '1px solid var(--border2)' }}>{job.phase}</div>}
                      <div style={{ display: 'flex', gap: 4 }}>
                        {job.assigned.map(a => <Avatar key={a} initials={a} size={26} />)}
                      </div>
                    </div>
                  </div>
                  {selected?.kind === 'job' && selected?.id === job.id && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border2)' }}>
                      {job.scope && <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 10 }}><strong style={{ color: 'var(--text)' }}>Scope:</strong> {job.scope}</div>}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={e => { e.stopPropagation(); setEditingJob(job) }} style={{ ...ghostBtn, fontSize: 11 }}>Edit</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PROPOSALS */}
        {tab === 'proposals' && (
          <div>
            {/* KPI cards — computed from real data */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
              {[
                { label: 'Total',    value: proposals.length, color: 'var(--text)' },
                { label: 'Draft',    value: proposals.filter(p => p.status === 'Draft').length, color: '#6e6e73' },
                { label: 'Sent',     value: proposals.filter(p => p.status === 'Sent').length, color: '#0066cc' },
                { label: 'Accepted', value: proposals.filter(p => p.status === 'Accepted').length, color: '#248a3d' },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {proposals.length === 0 && (
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '40px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>No proposals yet</div>
                <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 14 }}>Create your first proposal to start tracking the pipeline.</div>
                <button onClick={() => setEditingProposal('new')} style={{ ...primaryBtn, fontSize: 12 }}>+ New proposal</button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {proposals.map(p => (
                <div key={p.id} onClick={() => setSelected(selected?.id === p.id ? null : { kind: 'proposal', ...p })} style={{ background: 'var(--bg2)', border: `1px solid ${selected?.id === p.id ? 'var(--accent)' : 'var(--border2)'}`, borderRadius: 11, padding: '14px 16px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{p.client || '(no client)'}</div>
                        <Badge text={p.status} />
                        <LocationBadge name={locationName(p.location_id)} />
                        {p.portalId && <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 500 }}>{p.portalId}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.address || '—'}{p.created ? ` · Created ${p.created}` : ''}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>${(p.total || 0).toLocaleString()}</div>
                      {p.rooms != null && p.rooms !== '' && <div style={{ fontSize: 10, color: 'var(--text3)' }}>{p.rooms} rooms</div>}
                    </div>
                  </div>
                  {selected?.kind === 'proposal' && selected?.id === p.id && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border2)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
                        {p.scope && <div><div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', marginBottom: 3 }}>SCOPE</div><div style={{ fontSize: 11.5, color: 'var(--text2)' }}>{p.scope}</div></div>}
                        {p.devices && <div><div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', marginBottom: 3 }}>DEVICES</div><div style={{ fontSize: 11.5, color: 'var(--text2)' }}>{p.devices}</div></div>}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                        {[{ l: 'Labor', v: p.labor }, { l: 'Materials', v: p.materials }, { l: 'Total', v: p.total }].map(f => (
                          <div key={f.l} style={{ flex: 1, background: 'var(--bg3)', borderRadius: 8, padding: '8px 10px', border: '1px solid var(--border2)' }}>
                            <div style={{ fontSize: 9.5, color: 'var(--text3)', fontWeight: 600, marginBottom: 2 }}>{f.l}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>${(f.v || 0).toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={e => { e.stopPropagation(); setEditingProposal(p) }} style={{ ...ghostBtn, fontSize: 11 }}>Edit</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

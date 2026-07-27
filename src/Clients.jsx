import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { apiGet } from './lib/api'
import { getToken } from './lib/auth'
import * as haptics from './lib/haptics'
import { usePullToRefresh, PullIndicator } from './lib/usePullToRefresh'

const tagColors = {
  VIP: { bg: 'rgba(83,74,183,0.1)', color: '#534AB7' },
  Repeat: { bg: 'rgba(52,199,89,0.09)', color: '#248a3d' },
  New: { bg: 'rgba(0,102,204,0.08)', color: '#0066cc' },
  Referral: { bg: 'rgba(255,149,0,0.09)', color: '#c93400' },
  Commercial: { bg: 'rgba(174,174,178,0.15)', color: '#6e6e73' },
  Service: { bg: 'rgba(255,59,48,0.08)', color: '#d70015' },
}

const statusColors = {
  Active: { bg: 'rgba(52,199,89,0.09)', color: '#248a3d' },
  New: { bg: 'rgba(0,102,204,0.08)', color: '#0066cc' },
  Service: { bg: 'rgba(255,149,0,0.09)', color: '#c93400' },
  Inactive: { bg: 'rgba(174,174,178,0.12)', color: '#6e6e73' },
}

// Canonical job lifecycle → dot color + display label.
const jobStatusColors = {
  pending: '#aeaeb2', scheduled: '#534AB7', in_progress: '#0066cc',
  completed: '#34c759', cancelled: '#ff3b30',
}
const jobStatusLabels = {
  pending: 'Pending', scheduled: 'Scheduled', in_progress: 'In progress',
  completed: 'Completed', cancelled: 'Cancelled',
}

const lbl = { fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5 }
const inp = { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 11px', fontSize: 12.5, color: 'var(--text)', fontFamily: 'var(--font)', outline: 'none' }
const primaryBtn = { padding: '8px 18px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#1d1d1f', color: '#fff', fontFamily: 'var(--font)' }
const ghostBtn = { padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontFamily: 'var(--font)' }

function NewClientModal({ onClose }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', notes: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 14, width: 500, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px', borderBottom: '1px solid var(--border2)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>New client</div>
          <button onClick={onClose} style={{ background: 'var(--bg4)', border: 'none', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', color: 'var(--text2)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ padding: '18px 22px' }}>
          <div style={{ marginBottom: 12 }}>
            <div style={lbl}>Full name</div>
            <input style={inp} placeholder="Client name" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={lbl}>Email</div>
              <input style={inp} type="email" placeholder="e.g. name@email.com" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div>
              <div style={lbl}>Phone</div>
              <input style={inp} type="tel" placeholder="e.g. (503) 555-0100" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={lbl}>Address</div>
            <input style={inp} placeholder="Street address" value={form.address} onChange={e => set('address', e.target.value)} />
          </div>
          <div>
            <div style={lbl}>Notes</div>
            <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' }} placeholder="Client preferences, contact notes, referral source..." value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border2)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={ghostBtn}>Cancel</button>
          <button onClick={() => haptics.medium()} style={primaryBtn}>Add client</button>
        </div>
      </div>
    </div>
  )
}

const SMS_LABELS = { scheduled: 'Scheduled', on_the_way: 'On the way', completed: 'Completed', review: 'Review request' }
const SMS_STATUS = {
  sent: { bg: 'rgba(52,199,89,0.09)', color: '#248a3d' },
  queued: { bg: 'var(--bg4)', color: 'var(--text2)' },
  skipped: { bg: 'rgba(255,149,0,0.10)', color: '#a85a00' },
  failed: { bg: 'rgba(255,59,48,0.08)', color: '#d70015' },
  canceled: { bg: 'rgba(255,59,48,0.08)', color: '#d70015' },
}

function ClientDetail({ client, onClose, locations, onLocationChanged }) {
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState(client.notes)
  const [locationId, setLocationId] = useState(client.location_id || '')
  const [savingLocation, setSavingLocation] = useState(false)
  const [smsOptOut, setSmsOptOut] = useState(Boolean(client.sms_opt_out))
  const [smsBusy, setSmsBusy] = useState(false)
  const [texts, setTexts] = useState(null)
  const initials = client.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  useEffect(() => {
    apiGet(`/api/clients/${client.id}/sms`).then(setTexts).catch(() => setTexts([]))
  }, [client.id])

  const toggleSms = async () => {
    const next = !smsOptOut
    setSmsOptOut(next); setSmsBusy(true)
    haptics.light()
    try {
      const base = import.meta.env.VITE_API_URL || ''
      const token = getToken()
      const res = await fetch(`${base}/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sms_opt_out: next }),
      })
      if (res.ok) { const updated = await res.json(); onLocationChanged?.(updated) }
      else setSmsOptOut(!next)
    } catch { setSmsOptOut(!next) } finally { setSmsBusy(false) }
  }

  const updateLocation = async (newId) => {
    setLocationId(newId)
    setSavingLocation(true)
    try {
      const base = import.meta.env.VITE_API_URL || ''
      const token = getToken()
      const res = await fetch(`${base}/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ location_id: newId ? Number(newId) : null }),
      })
      if (res.ok) {
        const updated = await res.json()
        onLocationChanged?.(updated)
      }
    } catch (err) {
      console.error('Failed to update client location', err)
    } finally {
      setSavingLocation(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 14, width: 580, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.15)' }}>
        <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid var(--border2)', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{client.name}</div>
              <span style={{ padding: '2px 8px', borderRadius: 5, fontSize: 10.5, fontWeight: 700, background: statusColors[client.status]?.bg, color: statusColors[client.status]?.color }}>{client.status}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Client since {client.since}</div>
            <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
              {client.tags.map(t => (
                <span key={t} style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: tagColors[t]?.bg || 'var(--bg4)', color: tagColors[t]?.color || 'var(--text2)' }}>{t}</span>
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'var(--bg4)', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', color: 'var(--text2)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        <div style={{ padding: '18px 22px' }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Contact information</div>
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10, overflow: 'hidden' }}>
              {[
                { label: 'Email', value: client.email, href: `mailto:${client.email}` },
                { label: 'Phone', value: client.phone, href: `tel:${client.phone}` },
                { label: 'Address', value: client.address, href: null },
              ].map((f) => (
                <div key={f.label} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border2)' }}>
                  <div style={{ width: 70, fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>{f.label}</div>
                  {f.href
                    ? <a href={f.href} style={{ fontSize: 12.5, color: 'var(--accent)', fontWeight: 500, textDecoration: 'none' }}>{f.value}</a>
                    : <div style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 500 }}>{f.value}</div>
                  }
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px' }}>
                <div style={{ width: 70, fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>Location</div>
                <select
                  value={locationId}
                  onChange={e => updateLocation(e.target.value)}
                  disabled={savingLocation || !locations}
                  style={{ ...inp, fontSize: 12.5, padding: '6px 10px', flex: 1, maxWidth: 240 }}
                >
                  <option value="">— Unassigned —</option>
                  {(locations || []).map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
                {savingLocation && <span style={{ marginLeft: 10, fontSize: 11, color: 'var(--text3)' }}>Saving…</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderTop: '1px solid var(--border2)' }}>
                <div style={{ width: 70, fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>Texting</div>
                <div style={{ flex: 1, fontSize: 12.5, color: 'var(--text)' }}>{smsOptOut ? 'Opted out of SMS' : 'Texting enabled'}</div>
                <button
                  type="button" role="switch" aria-checked={!smsOptOut} onClick={toggleSms} disabled={smsBusy}
                  style={{ width: 42, height: 24, borderRadius: 12, border: 'none', padding: 0, background: smsOptOut ? 'var(--bg4)' : 'var(--accent)', cursor: smsBusy ? 'wait' : 'pointer', position: 'relative', flexShrink: 0, opacity: smsBusy ? 0.6 : 1 }}
                >
                  <span style={{ position: 'absolute', top: 2, left: smsOptOut ? 2 : 20, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </button>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Job history</div>
            {client.jobs.map((job, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 9, padding: '10px 14px', marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: jobStatusColors[job.status] || '#aeaeb2', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{job.name}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2 }}>{job.date}</div>
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: jobStatusColors[job.status] || '#aeaeb2' }}>{jobStatusLabels[job.status] || job.status}</span>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Proposals</div>
            {client.proposals.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 9, padding: '10px 14px', marginBottom: 6 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{p.name}</div>
                    <span style={{ fontSize: 10, color: 'var(--text3)' }}>{p.id}</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>{p.date}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>${p.total.toLocaleString()}</div>
                <a href="https://portal.io" target="_blank" rel="noreferrer" style={{ fontSize: 10.5, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>Portal ↗</a>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Text messages</div>
            {texts == null && <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>Loading…</div>}
            {texts != null && texts.length === 0 && <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>No texts sent to this client yet.</div>}
            {texts != null && texts.map(t => {
              const st = SMS_STATUS[t.status] || SMS_STATUS.queued
              return (
                <div key={t.id} style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 9, padding: '10px 14px', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text)' }}>{SMS_LABELS[t.template_key] || t.template_key}</span>
                    <span style={{ padding: '1px 7px', borderRadius: 4, fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', background: st.bg, color: st.color }}>{t.status}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text3)' }}>{new Date(t.sent_at || t.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.5 }}>{t.body}</div>
                  {t.error && <div style={{ fontSize: 10.5, color: '#d70015', marginTop: 4 }}>{t.error}</div>}
                </div>
              )
            })}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notes</div>
              <button onClick={() => setEditingNotes(!editingNotes)} style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                {editingNotes ? 'Save' : 'Edit'}
              </button>
            </div>
            {editingNotes
              ? <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' }} value={notes} onChange={e => setNotes(e.target.value)} />
              : <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 9, padding: '12px 14px', fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.6 }}>{notes}</div>
            }
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Clients() {
  const [clients, setClients] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [showNew, setShowNew] = useState(false)
  const [selected, setSelected] = useState(null)
  const location = useLocation()

  const loadClients = async () => {
    const rows = await apiGet('/api/clients').catch(err => { console.error('Failed to load clients', err); return [] })
    setClients(rows.map(c => ({
      ...c,
      jobs: c.jobs || [],
      proposals: c.proposals || [],
      tags: c.tags || [],
      email: c.email || '',
      address: c.address || '',
    })))
  }

  // Mount load kept in the original .then()/.finally() form so the
  // react-hooks/set-state-in-effect rule (which flags a direct call to a
  // setState-containing function) stays quiet. loadClients() above is the
  // reusable version pull-to-refresh calls.
  useEffect(() => {
    apiGet('/api/clients')
      .then(rows => setClients(rows.map(c => ({
        ...c,
        jobs: c.jobs || [],
        proposals: c.proposals || [],
        tags: c.tags || [],
        email: c.email || '',
        address: c.address || '',
      }))))
      .catch(err => console.error('Failed to load clients', err))
      .finally(() => setLoading(false))

    const base = import.meta.env.VITE_API_URL || ''
    const token = getToken()
    fetch(`${base}/api/locations`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.ok ? r.json() : [])
      .then(setLocations)
      .catch(() => {})
  }, [])

  const ptr = usePullToRefresh(loadClients)

  const onClientLocationChanged = (updated) => {
    const patch = { location_id: updated.location_id, sms_opt_out: updated.sms_opt_out }
    setClients(cs => cs.map(c => c.id === updated.id ? { ...c, ...patch } : c))
    setSelected(s => s && s.id === updated.id ? { ...s, ...patch } : s)
  }

  useEffect(() => {
    if (!loading && location.state?.openClientId) {
      const match = clients.find(c => c.id === location.state.openClientId)
      if (match) setSelected(match)
    }
  }, [loading, clients, location.state])

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '13px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Clients</div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13, fontWeight: 500 }}>Loading…</div>
      </div>
    )
  }

  const filtered = clients.filter(c => {
    const matchFilter = filter === 'All' || c.status === filter
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.address.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {showNew && <NewClientModal onClose={() => setShowNew(false)} />}
      {selected && (
        <ClientDetail
          client={selected}
          onClose={() => setSelected(null)}
          locations={locations}
          onLocationChanged={onClientLocationChanged}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Clients</div>
        <button onClick={() => setShowNew(true)} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#1d1d1f', color: '#fff', fontFamily: 'var(--font)' }}>
          + New client
        </button>
      </div>

      <div style={{ padding: '12px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
        <input
          style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', fontSize: 12.5, color: 'var(--text)', fontFamily: 'var(--font)', outline: 'none' }}
          placeholder="Search clients by name, email or address..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {['All', 'Active', 'New', 'Service'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 12px', borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', border: `1px solid ${filter === f ? 'var(--accent)' : 'var(--border)'}`, background: filter === f ? 'rgba(0,102,204,0.08)' : 'transparent', color: filter === f ? 'var(--accent)' : 'var(--text2)', fontFamily: 'var(--font)' }}>
            {f}
          </button>
        ))}
      </div>

      <div {...ptr.handlers} style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        <PullIndicator pull={ptr.pull} refreshing={ptr.refreshing} />
        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, marginBottom: 12 }}>{filtered.length} client{filtered.length !== 1 ? 's' : ''}</div>
        {filtered.length === 0 && clients.length === 0 && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>No clients added</div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 14 }}>Add your first client to start tracking jobs, proposals, and tickets.</div>
            <button onClick={() => setShowNew(true)} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#1d1d1f', color: '#fff', fontFamily: 'var(--font)' }}>+ New client</button>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(client => {
            const initials = client.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
            const activeJob = client.jobs.find(j => j.status !== 'completed')
            return (
              <div key={client.id} onClick={() => setSelected(client)} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 11, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.12s', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{client.name}</div>
                    <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: statusColors[client.status]?.bg, color: statusColors[client.status]?.color }}>{client.status}</span>
                    {client.tags.map(t => (
                      <span key={t} style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: tagColors[t]?.bg || 'var(--bg4)', color: tagColors[t]?.color || 'var(--text2)' }}>{t}</span>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {client.email} · {client.phone}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {activeJob && (
                    <div style={{ fontSize: 11, fontWeight: 600, color: jobStatusColors[activeJob.status] || 'var(--text2)', marginBottom: 2 }}>● {activeJob.name}</div>
                  )}
                  <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>Since {client.since}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

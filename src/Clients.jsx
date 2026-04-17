import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { apiGet } from './lib/api'

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

const jobStatusColors = {
  'On site': '#34c759', 'In progress': '#0066cc',
  Review: '#ff9500', Scheduled: '#534AB7', Complete: '#aeaeb2',
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
          <button style={primaryBtn}>Add client</button>
        </div>
      </div>
    </div>
  )
}

function ClientDetail({ client, onClose }) {
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState(client.notes)
  const initials = client.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

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
              ].map((f, i, arr) => (
                <div key={f.label} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: i < arr.length - 1 ? '1px solid var(--border2)' : 'none' }}>
                  <div style={{ width: 70, fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>{f.label}</div>
                  {f.href
                    ? <a href={f.href} style={{ fontSize: 12.5, color: 'var(--accent)', fontWeight: 500, textDecoration: 'none' }}>{f.value}</a>
                    : <div style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 500 }}>{f.value}</div>
                  }
                </div>
              ))}
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
                <span style={{ fontSize: 10.5, fontWeight: 600, color: jobStatusColors[job.status] || '#aeaeb2' }}>{job.status}</span>
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
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [showNew, setShowNew] = useState(false)
  const [selected, setSelected] = useState(null)
  const location = useLocation()

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
  }, [])

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
      {selected && <ClientDetail client={selected} onClose={() => setSelected(null)} />}

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

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
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
            const activeJob = client.jobs.find(j => j.status !== 'Complete')
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

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiGet } from './lib/api'
import { colorForInitials, initialsOf } from './lib/color'

const FIELDS = [
  { key: 'controller_model', label: 'Controller model',  type: 'text',     hint: 'e.g. Control4 EA-5' },
  { key: 'controller_ip',    label: 'Controller IP',     type: 'text',     mono: true, hint: 'e.g. 192.168.1.100' },
  { key: 'device_ips',       label: 'Device IPs',        type: 'textarea', hint: 'One per line — Label: 192.168.x.x', mono: true },
  { key: 'rooms',            label: 'Rooms',             type: 'textarea', hint: 'One room per line' },
  { key: 'drivers',          label: 'Drivers installed', type: 'textarea', hint: 'One driver per line' },
  { key: 'scenes',           label: 'Scenes programmed', type: 'textarea', hint: 'One scene per line' },
  { key: 'network',          label: 'Network info',      type: 'textarea', hint: 'Router, switches, SSIDs, etc.' },
]

const lbl = { fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }
const inp = { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 12.5, color: 'var(--text)', fontFamily: 'var(--font)', outline: 'none' }
const mono = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }
const primaryBtn = { padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#1d1d1f', color: '#fff', fontFamily: 'var(--font)' }
const ghostBtn = { padding: '7px 14px', borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontFamily: 'var(--font)' }

function emptyHomeDoc() {
  return FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {})
}

function patchHomeDoc(clientId, body) {
  const base = import.meta.env.VITE_API_URL || ''
  return fetch(`${base}/api/clients/${clientId}/homedoc`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function FieldCard({ field, value, editing, onChange }) {
  const textStyle = { fontSize: 12.5, color: value ? 'var(--text)' : 'var(--text3)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', ...(field.mono ? mono : {}) }
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ ...lbl, textTransform: 'uppercase', letterSpacing: '0.4px', fontSize: 10, marginBottom: 8 }}>{field.label}</div>
      {editing ? (
        field.type === 'textarea' ? (
          <textarea
            style={{ ...inp, minHeight: 80, resize: 'vertical', ...(field.mono ? mono : {}) }}
            placeholder={field.hint}
            value={value}
            onChange={e => onChange(e.target.value)}
          />
        ) : (
          <input
            style={{ ...inp, ...(field.mono ? mono : {}) }}
            placeholder={field.hint}
            value={value}
            onChange={e => onChange(e.target.value)}
          />
        )
      ) : (
        <div style={textStyle}>{value || 'Not specified'}</div>
      )}
    </div>
  )
}

function ClientRow({ client, onOpen }) {
  const initials = initialsOf(client.name)
  const filledCount = Object.values(client.homedoc || {}).filter(v => v && String(v).trim()).length
  return (
    <div
      onClick={onOpen}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '13px 16px',
        background: 'var(--bg2)',
        border: '1px solid var(--border2)',
        borderRadius: 11,
        marginBottom: 8,
        cursor: 'pointer',
        transition: 'border-color 0.1s',
      }}
    >
      <div style={{ width: 34, height: 34, minWidth: 34, borderRadius: '50%', background: colorForInitials(initials), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>{initials}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{client.name}</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{client.address || 'No address'}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 5, background: filledCount > 0 ? 'rgba(52,199,89,0.09)' : 'var(--bg3)', color: filledCount > 0 ? '#248a3d' : 'var(--text3)' }}>
          {filledCount > 0 ? `${filledCount}/${FIELDS.length} fields` : 'Empty'}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>›</span>
      </div>
    </div>
  )
}

function ClientList({ clients, onOpen }) {
  if (clients.length === 0) {
    return (
      <div style={{ padding: '16px 24px 24px' }}>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>No clients yet</div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>Add a client first, then build out their HomeDoc record.</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px 24px 24px' }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, marginBottom: 12 }}>
        {clients.length} {clients.length === 1 ? 'record' : 'records'}
      </div>
      {clients.map(c => <ClientRow key={c.id} client={c} onOpen={() => onOpen(c)} />)}
    </div>
  )
}

function HomeDocDetail({ client, onBack, onSave }) {
  const initial = { ...emptyHomeDoc(), ...(client.homedoc || {}) }
  const [data, setData] = useState(initial)
  const [notes, setNotes] = useState(client.notes || '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const startEdit = () => {
    setData({ ...emptyHomeDoc(), ...(client.homedoc || {}) })
    setNotes(client.notes || '')
    setError('')
    setEditing(true)
  }

  const cancelEdit = () => {
    setData({ ...emptyHomeDoc(), ...(client.homedoc || {}) })
    setNotes(client.notes || '')
    setError('')
    setEditing(false)
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await patchHomeDoc(client.id, { homedoc: data, notes })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `${res.status}`)
      }
      const updated = await res.json()
      onSave(updated)
      setEditing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const share = async () => {
    const url = `${window.location.origin}/homedoc/${client.id}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      window.prompt('Copy this URL:', url)
    }
  }

  const set = (k, v) => setData(prev => ({ ...prev, [k]: v }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      {/* Header with client info + actions */}
      <div style={{ padding: '16px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          <button onClick={onBack} style={{ ...ghostBtn, fontSize: 11 }}>← All records</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={share} style={{ ...ghostBtn, fontSize: 11, color: copied ? '#248a3d' : 'var(--text2)', borderColor: copied ? 'rgba(52,199,89,0.3)' : 'var(--border)' }}>
              {copied ? '✓ Link copied' : 'Share'}
            </button>
            {editing ? (
              <>
                <button onClick={cancelEdit} disabled={saving} style={ghostBtn}>Cancel</button>
                <button onClick={save} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save'}</button>
              </>
            ) : (
              <button onClick={startEdit} style={primaryBtn}>Edit</button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 16 }}>
          <div style={{ width: 46, height: 46, minWidth: 46, borderRadius: '50%', background: colorForInitials(initialsOf(client.name)), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#fff' }}>{initialsOf(client.name)}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{client.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>{client.address || 'No address on file'}</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px 24px' }}>
        {error && (
          <div style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.25)', borderRadius: 8, padding: '9px 12px', marginBottom: 14, fontSize: 11.5, color: '#d70015', fontWeight: 500 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12, marginBottom: 14 }}>
          {FIELDS.map(f => (
            <FieldCard
              key={f.key}
              field={f}
              value={data[f.key] || ''}
              editing={editing}
              onChange={v => set(f.key, v)}
            />
          ))}
        </div>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ ...lbl, textTransform: 'uppercase', letterSpacing: '0.4px', fontSize: 10, marginBottom: 8 }}>Notes</div>
          {editing ? (
            <textarea
              style={{ ...inp, minHeight: 100, resize: 'vertical' }}
              placeholder="Anything else to remember about this client's install..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          ) : (
            <div style={{ fontSize: 12.5, color: notes ? 'var(--text)' : 'var(--text3)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{notes || 'No notes yet.'}</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function HomeDoc() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet('/api/clients')
      .then(setClients)
      .catch(err => console.error('Failed to load clients', err))
      .finally(() => setLoading(false))
  }, [])

  const selected = id ? clients.find(c => String(c.id) === String(id)) : null

  const openClient = (c) => navigate(`/homedoc/${c.id}`)
  const closeClient = () => navigate('/homedoc')

  const handleSave = (updatedClient) => {
    setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c))
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '13px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>HomeDoc</div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13, fontWeight: 500 }}>Loading…</div>
      </div>
    )
  }

  if (id && !selected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>HomeDoc</div>
          <button onClick={closeClient} style={{ ...ghostBtn, fontSize: 11 }}>← All records</button>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13, fontWeight: 500 }}>No client found for that link.</div>
      </div>
    )
  }

  if (selected) {
    return <HomeDocDetail client={selected} onBack={closeClient} onSave={handleSave} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '13px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>HomeDoc</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <ClientList clients={clients} onOpen={openClient} />
      </div>
    </div>
  )
}

import { useState, useEffect, useMemo } from 'react'
import { getToken } from './lib/auth'

const BASE = import.meta.env.VITE_API_URL || ''

const STATUS_COLOR = {
  ok:               { bg: 'rgba(52,199,89,0.12)',  fg: '#1f8a3e' },
  blocked:          { bg: 'rgba(255,149,0,0.12)',  fg: '#a85a00' },
  refused_opt_out:  { bg: 'rgba(255,59,48,0.12)',  fg: '#b9261d' },
  error:            { bg: 'rgba(255,59,48,0.12)',  fg: '#b9261d' },
}

const TASK_TYPES = [
  { id: '',             label: 'All task types' },
  { id: 'assist_chat',  label: 'Intellix Assist' },
]

const s = {
  topbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0, gap: 12, flexWrap: 'wrap' },
  title: { fontSize: 14, fontWeight: 700, color: 'var(--text)' },
  content: { flex: 1, overflowY: 'auto', padding: '16px 24px 32px' },
  card: { background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '16px 18px', marginBottom: 12 },
  filters: { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 10.5, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' },
  input: { padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--bg)', color: 'var(--text)', fontSize: 12.5, fontFamily: 'var(--font)', minWidth: 140 },
  btn: { padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--accent)', background: 'var(--accent)', color: '#fff', fontFamily: 'var(--font)' },
  btnGhost: { padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontFamily: 'var(--font)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12.5 },
  th: { textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--border2)', color: 'var(--text2)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px' },
  td: { padding: '10px', borderBottom: '1px solid var(--border)', color: 'var(--text)', verticalAlign: 'top' },
  rowBtn: { background: 'transparent', border: 'none', padding: 0, color: 'var(--accent)', cursor: 'pointer', fontSize: 12.5, fontFamily: 'var(--font)' },
  badge: { padding: '2px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' },
  detail: { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginTop: 6, fontSize: 12, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', whiteSpace: 'pre-wrap', color: 'var(--text)' },
  empty: { padding: 30, textAlign: 'center', color: 'var(--text3)', fontSize: 13 },
  error: { color: '#b9261d', fontSize: 12.5, padding: 8 },
  banner: { background: 'rgba(0,102,204,0.08)', border: '1px solid rgba(0,102,204,0.2)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--text2)', marginBottom: 12 },
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function StatusBadge({ status }) {
  const c = STATUS_COLOR[status] || { bg: 'var(--bg)', fg: 'var(--text2)' }
  return <span style={{ ...s.badge, background: c.bg, color: c.fg }}>{status || '—'}</span>
}

export default function AiAudit() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [filters, setFilters] = useState({ user: '', client: '', task_type: '', from: '', to: '' })
  const [openId, setOpenId] = useState(null)

  const queryString = useMemo(() => {
    const p = new URLSearchParams()
    if (filters.user)      p.set('user', filters.user)
    if (filters.client)    p.set('client', filters.client)
    if (filters.task_type) p.set('task_type', filters.task_type)
    if (filters.from)      p.set('from', filters.from)
    if (filters.to)        p.set('to', filters.to)
    p.set('limit', '200')
    return p.toString()
  }, [filters])

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      const token = getToken()
      const res = await fetch(`${BASE}/api/ai/audit?${queryString}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const data = await res.json()
      setRows(data.rows || [])
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // initial load

  return (
    <>
      <div style={s.topbar}>
        <div style={s.title}>AI Audit Log</div>
        <button style={s.btnGhost} onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <div style={s.content}>
        <div style={s.banner}>
          Every Claude API call is logged here. Prompts shown are exactly what was sent to the model — no rehydration.
          Use this to verify the gateway is working as expected and to investigate refused or blocked requests.
        </div>

        <div style={s.card}>
          <div style={s.filters}>
            <div style={s.field}>
              <label style={s.label}>User ID</label>
              <input style={s.input} value={filters.user} onChange={e => setFilters({ ...filters, user: e.target.value })} placeholder="e.g. 1" />
            </div>
            <div style={s.field}>
              <label style={s.label}>Client ID</label>
              <input style={s.input} value={filters.client} onChange={e => setFilters({ ...filters, client: e.target.value })} placeholder="e.g. 42" />
            </div>
            <div style={s.field}>
              <label style={s.label}>Task type</label>
              <select style={s.input} value={filters.task_type} onChange={e => setFilters({ ...filters, task_type: e.target.value })}>
                {TASK_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div style={s.field}>
              <label style={s.label}>From</label>
              <input style={s.input} type="date" value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })} />
            </div>
            <div style={s.field}>
              <label style={s.label}>To</label>
              <input style={s.input} type="date" value={filters.to} onChange={e => setFilters({ ...filters, to: e.target.value })} />
            </div>
            <button style={s.btn} onClick={load}>Apply</button>
            <button style={s.btnGhost} onClick={() => { setFilters({ user: '', client: '', task_type: '', from: '', to: '' }); setTimeout(load, 0) }}>
              Clear
            </button>
          </div>
        </div>

        <div style={s.card}>
          {err && <div style={s.error}>{err}</div>}
          {!err && rows.length === 0 && !loading && (
            <div style={s.empty}>No AI interactions match these filters.</div>
          )}
          {rows.length > 0 && (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>When</th>
                  <th style={s.th}>User</th>
                  <th style={s.th}>Client</th>
                  <th style={s.th}>Task</th>
                  <th style={s.th}>Status</th>
                  <th style={s.th}>Tokens</th>
                  <th style={s.th}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <FragmentRow
                    key={r.id}
                    row={r}
                    open={openId === r.id}
                    onToggle={() => setOpenId(openId === r.id ? null : r.id)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}

function FragmentRow({ row, open, onToggle }) {
  const tokens = (row.tokens_input || row.tokens_output)
    ? `${row.tokens_input ?? '?'} / ${row.tokens_output ?? '?'}`
    : '—'
  return (
    <>
      <tr>
        <td style={s.td}>{fmtDate(row.created_at)}</td>
        <td style={s.td}>{row.user_name || (row.user_id ? `#${row.user_id}` : '—')}</td>
        <td style={s.td}>{row.client_name || (row.client_id ? `#${row.client_id}` : '—')}</td>
        <td style={s.td}>{row.task_type}</td>
        <td style={s.td}><StatusBadge status={row.status} /></td>
        <td style={s.td}>{tokens}</td>
        <td style={s.td}>
          <button style={s.rowBtn} onClick={onToggle}>{open ? 'Hide' : 'View'}</button>
        </td>
      </tr>
      {open && (
        <tr>
          <td style={s.td} colSpan={7}>
            {row.error_message && (
              <div style={{ ...s.detail, color: '#b9261d', borderColor: 'rgba(255,59,48,0.3)' }}>
                <strong>Error / reason:</strong> {row.error_message}
              </div>
            )}
            <div style={s.detail}>
              <strong>Prompt sent to model:</strong>{'\n'}{row.redacted_prompt || '(empty)'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
              Model: {row.model || '—'}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

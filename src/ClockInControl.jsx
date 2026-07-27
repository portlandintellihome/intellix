// Persistent clock-in / clock-out + "On the way" control. Rendered in AppShell
// (outside <Routes>) so it's visible on every screen. Mobile-first: a compact
// trigger in the mobile topbar / desktop sidebar footer opens a sheet with the
// full actions. Auto-suggests today's assigned job for one-tap clock-in.
import { useState, useEffect, useCallback } from 'react'
import { Clock } from 'lucide-react'
import { apiGet } from './lib/api'
import { getToken } from './lib/auth'
import * as haptics from './lib/haptics'

const API = () => import.meta.env.VITE_API_URL || ''

async function authFetch(path, opts = {}) {
  const token = getToken()
  return fetch(`${API()}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  })
}

function fmtDur(ms) {
  let s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600); s -= h * 3600
  const m = Math.floor(s / 60); s -= m * 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const ACTIVE = new Set(['pending', 'scheduled', 'in_progress'])

const sheetInp = { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 11px', fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font)', outline: 'none' }
const primaryBtn = { padding: '11px 16px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#1d1d1f', color: '#fff', fontFamily: 'var(--font)', width: '100%' }
const ghostBtn = { padding: '11px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontFamily: 'var(--font)', width: '100%' }

export default function ClockInControl({ variant = 'desktop' }) {
  const [current, setCurrent] = useState(null) // { entry, suggested_job }
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('menu')      // menu | clockin | ontheway
  const [jobs, setJobs] = useState([])
  const [pickJob, setPickJob] = useState('')
  const [eta, setEta] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [now, setNow] = useState(Date.now())

  const load = useCallback(async () => {
    try {
      const res = await authFetch('/api/time-entries/current')
      if (res.ok) setCurrent(await res.json())
    } catch { /* ignore — control just shows the default state */ }
  }, [])

  useEffect(() => { load() }, [load])

  const entry = current?.entry || null
  const suggested = current?.suggested_job || null

  // Tick the elapsed timer while clocked in.
  useEffect(() => {
    if (!entry) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [entry])

  const flashToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2600) }

  const openSheet = async () => {
    setMode('menu'); setOpen(true); setEta('')
    haptics.light()
    // Preload active jobs for the pickers + default the on-the-way selector.
    try {
      const rows = await apiGet('/api/jobs')
      const active = (rows || []).filter(j => ACTIVE.has(j.status))
      setJobs(active)
      setPickJob(String(suggested?.id || entry?.job_id || active[0]?.id || ''))
    } catch { /* ignore — pickers just show empty */ }
  }

  const doClockIn = async (jobId) => {
    setBusy(true)
    try {
      const res = await authFetch('/api/time-entries/clock-in', {
        method: 'POST', body: JSON.stringify({ job_id: jobId ? Number(jobId) : null }),
      })
      if (res.status === 409) { await load(); flashToast('Already clocked in'); setOpen(false); return }
      if (res.ok) { haptics.success(); await load(); setOpen(false); flashToast('Clocked in') }
    } finally { setBusy(false) }
  }

  const doClockOut = async () => {
    setBusy(true)
    try {
      const res = await authFetch('/api/time-entries/clock-out', { method: 'POST' })
      if (res.ok) { haptics.success(); await load(); setOpen(false); flashToast('Clocked out') }
      else { await load() }
    } finally { setBusy(false) }
  }

  const doOnTheWay = async () => {
    if (!pickJob) return
    setBusy(true)
    try {
      const res = await authFetch('/api/sms/on-the-way', {
        method: 'POST', body: JSON.stringify({ job_id: Number(pickJob), eta: eta.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      haptics.medium()
      setOpen(false)
      if (res.ok) {
        const st = data?.message?.status
        flashToast(st === 'sent' ? 'Client texted — on the way' : st === 'skipped' ? 'Sent (client has no SMS/opted out)' : 'On-the-way logged')
      } else {
        flashToast(data.error || 'Could not send')
      }
    } finally { setBusy(false) }
  }

  // --- Trigger button --------------------------------------------------------
  const clockedIn = Boolean(entry)
  const elapsed = entry ? fmtDur(now - new Date(entry.clock_in_at).getTime()) : null

  const triggerMobile = (
    <button onClick={openSheet} aria-label="Clock in / out" style={{
      width: 44, height: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 1, background: 'transparent', border: 'none', cursor: 'pointer', color: clockedIn ? '#34c759' : 'var(--text)', padding: 0,
    }}>
      <div style={{ position: 'relative' }}>
        <Clock size={20} strokeWidth={2} />
        {clockedIn && <span style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: '50%', background: '#34c759', border: '1.5px solid var(--bg2)' }} />}
      </div>
      {clockedIn && <span style={{ fontSize: 8.5, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{elapsed}</span>}
    </button>
  )

  const triggerDesktop = (
    <button onClick={openSheet} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8,
      border: '1px solid var(--border2)', cursor: 'pointer', fontFamily: 'var(--font)',
      background: clockedIn ? 'rgba(52,199,89,0.10)' : 'var(--bg3)',
      color: clockedIn ? '#248a3d' : 'var(--text2)',
    }}>
      <Clock size={15} strokeWidth={2} />
      {clockedIn
        ? <span style={{ fontSize: 11.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{elapsed}</span>
        : <span style={{ fontSize: 11.5, fontWeight: 600 }}>Clock in</span>}
      {clockedIn && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#34c759', marginLeft: 'auto' }} />}
    </button>
  )

  return (
    <>
      {variant === 'mobile' ? triggerMobile : triggerDesktop}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 'calc(70px + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)',
          background: '#1d1d1f', color: '#fff', padding: '9px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 600,
          zIndex: 300, boxShadow: '0 6px 20px rgba(0,0,0,0.25)', fontFamily: 'var(--font)', maxWidth: '90vw',
        }}>{toast}</div>
      )}

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 250, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg2)', borderTop: '1px solid var(--border2)',
              borderTopLeftRadius: 18, borderTopRightRadius: 18, width: '100%', maxWidth: 460,
              padding: '18px 20px', paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.2)', fontFamily: 'var(--font)', maxHeight: '80vh', overflowY: 'auto',
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 16px' }} />

            {/* Status header */}
            <div style={{ marginBottom: 16 }}>
              {clockedIn ? (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#248a3d', textTransform: 'uppercase', letterSpacing: '0.4px' }}>● On the clock</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>{entry.job_name || 'No job selected'}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{elapsed}</div>
                  {entry.client_name && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{entry.client_name}</div>}
                </>
              ) : (
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Time clock</div>
              )}
            </div>

            {/* MENU */}
            {mode === 'menu' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {clockedIn ? (
                  <button onClick={doClockOut} disabled={busy} style={{ ...primaryBtn, background: '#ff3b30', opacity: busy ? 0.6 : 1 }}>
                    {busy ? 'Clocking out…' : 'Clock out'}
                  </button>
                ) : (
                  suggested ? (
                    <button onClick={() => doClockIn(suggested.id)} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>
                      Clock in: {suggested.name}
                    </button>
                  ) : (
                    <button onClick={() => setMode('clockin')} disabled={busy} style={primaryBtn}>Clock in…</button>
                  )
                )}
                {!clockedIn && suggested && (
                  <button onClick={() => setMode('clockin')} style={ghostBtn}>Choose a different job</button>
                )}
                <button onClick={() => setMode('ontheway')} style={ghostBtn}>On the way (text the client)</button>
              </div>
            )}

            {/* CLOCK-IN job picker */}
            {mode === 'clockin' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5 }}>Job</div>
                  <select style={sheetInp} value={pickJob} onChange={e => setPickJob(e.target.value)}>
                    <option value="">— No job —</option>
                    {jobs.map(j => <option key={j.id} value={j.id}>{j.name}{j.client_name ? ` · ${j.client_name}` : ''}</option>)}
                  </select>
                </div>
                <button onClick={() => doClockIn(pickJob)} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>
                  {busy ? 'Clocking in…' : 'Clock in'}
                </button>
                <button onClick={() => setMode('menu')} style={ghostBtn}>Back</button>
              </div>
            )}

            {/* ON THE WAY */}
            {mode === 'ontheway' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5 }}>Job / client</div>
                  <select style={sheetInp} value={pickJob} onChange={e => setPickJob(e.target.value)}>
                    <option value="">— Select a job —</option>
                    {jobs.map(j => <option key={j.id} value={j.id}>{j.name}{j.client_name ? ` · ${j.client_name}` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5 }}>ETA (optional)</div>
                  <input style={sheetInp} value={eta} onChange={e => setEta(e.target.value)} placeholder="e.g. 20 minutes / 3:30 PM" />
                </div>
                <button onClick={doOnTheWay} disabled={busy || !pickJob} style={{ ...primaryBtn, opacity: (busy || !pickJob) ? 0.5 : 1 }}>
                  {busy ? 'Sending…' : 'Text client I’m on the way'}
                </button>
                <button onClick={() => setMode('menu')} style={ghostBtn}>Back</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

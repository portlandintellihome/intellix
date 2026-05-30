import { useState, useEffect } from 'react'
import { getToken } from './lib/auth'

const BASE = import.meta.env.VITE_API_URL || ''

const lbl = { fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5 }
const inp = { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 11px', fontSize: 12.5, color: 'var(--text)', fontFamily: 'var(--font)', outline: 'none', boxSizing: 'border-box' }
const primaryBtn = { padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#1d1d1f', color: '#fff', fontFamily: 'var(--font)' }
const ghostBtn = { padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontFamily: 'var(--font)' }
const dangerBtn = { padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(255,59,48,0.3)', background: 'transparent', color: '#d70015', fontFamily: 'var(--font)' }

function authHeaders() {
  const t = getToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `${res.status}`)
  return data
}

function StatusPill({ connected, label }) {
  const bg = connected ? 'rgba(52,199,89,0.09)' : 'rgba(174,174,178,0.15)'
  const color = connected ? '#248a3d' : '#6e6e73'
  const dot = connected ? '#34c759' : '#aeaeb2'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, background: bg, color, fontSize: 10.5, fontWeight: 700 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot }} />
      {label || (connected ? 'Connected' : 'Not connected')}
    </span>
  )
}

function relativeTime(iso) {
  if (!iso) return 'Never'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'just now'
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)} min ago`
  if (ms < 86400_000) return `${Math.floor(ms / 3600_000)} hr ago`
  return `${Math.floor(ms / 86400_000)} days ago`
}

function CopyField({ value, label }) {
  const [copied, setCopied] = useState(false)
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }
  return (
    <div>
      {label && <div style={lbl}>{label}</div>}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          readOnly
          value={value}
          style={{ ...inp, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11.5, background: 'var(--bg)' }}
          onFocus={e => e.target.select()}
        />
        <button onClick={onCopy} style={{ ...ghostBtn, minWidth: 70 }}>{copied ? 'Copied' : 'Copy'}</button>
      </div>
    </div>
  )
}

// --- Portal.io card ---------------------------------------------------------

function PortalIoCard({ integration, locations, onChanged }) {
  const [defaultLocId, setDefaultLocId] = useState(integration.default_location_id || '')
  const [savingLoc, setSavingLoc] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [testing, setTesting] = useState(false)
  const [showRegenConfirm, setShowRegenConfirm] = useState(false)
  const [revealedSecret, setRevealedSecret] = useState(null)
  const [connecting, setConnecting] = useState(false)

  // The site's own origin is the right base — works on staging, prod, local.
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const secretForUrl = revealedSecret || (integration.secret_set ? `…${integration.secret_last4}` : '<not-set>')
  const proposalUrl = `${origin}/api/webhooks/portal-io/proposal/${secretForUrl}`
  const contactUrl  = `${origin}/api/webhooks/portal-io/contact/${secretForUrl}`

  const saveLocation = async (newId) => {
    setDefaultLocId(newId)
    setSavingLoc(true)
    try {
      await api(`/api/integrations/portal_io`, {
        method: 'PATCH',
        body: { default_location_id: newId ? Number(newId) : null },
      })
      onChanged()
    } catch (err) {
      setTestResult({ ok: false, message: err.message })
    } finally {
      setSavingLoc(false)
    }
  }

  const toggleConnected = async () => {
    setConnecting(true)
    try {
      const next = !integration.connected
      await api(`/api/integrations/portal_io`, {
        method: 'PATCH',
        body: { connected: next },
      })
      onChanged()
    } catch (err) {
      setTestResult({ ok: false, message: err.message })
    } finally {
      setConnecting(false)
    }
  }

  const regenerate = async () => {
    setShowRegenConfirm(false)
    try {
      const result = await api(`/api/integrations/portal_io`, {
        method: 'PATCH',
        body: { regenerate_secret: true },
      })
      setRevealedSecret(result.full_secret)
      onChanged()
    } catch (err) {
      setTestResult({ ok: false, message: err.message })
    }
  }

  const runTest = async () => {
    setTesting(true); setTestResult(null)
    try {
      const r = await api(`/api/integrations/portal_io/test`, { method: 'POST' })
      setTestResult({ ok: true, message: r.message, detail: r.result })
      onChanged()
    } catch (err) {
      setTestResult({ ok: false, message: err.message })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: 20, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#534AB7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>PT</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Portal.io</div>
              <span style={{ fontSize: 10.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>via Zapier</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, maxWidth: 540 }}>
              Two-way sync: proposal status changes and contact updates in Portal flow into Intellix via Zapier webhooks. Accepted proposals auto-create jobs.
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <StatusPill connected={integration.connected} />
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 10 }}>
        Last synced: <strong style={{ color: 'var(--text)' }}>{relativeTime(integration.last_synced_at)}</strong>
      </div>

      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Paste these into your Zapier "Webhooks by Zapier → POST" actions
        </div>
        {!revealedSecret && integration.secret_set && (
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10, lineHeight: 1.5 }}>
            The full secret is hidden — the URLs above show only the last 4 characters (<code>…{integration.secret_last4}</code>). If you lost the original URLs, regenerate the secret below to reveal new ones (this <strong>invalidates the current Zapier configuration</strong>).
          </div>
        )}
        {revealedSecret && (
          <div style={{ background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.25)', borderRadius: 8, padding: '8px 10px', fontSize: 11, color: '#a85a00', marginBottom: 10 }}>
            Copy these URLs now — the secret is only shown once. Refreshing this page will hide it.
          </div>
        )}
        <div style={{ marginBottom: 10 }}>
          <CopyField label="Proposal sync URL" value={proposalUrl} />
        </div>
        <div>
          <CopyField label="Contact sync URL" value={contactUrl} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={lbl}>Default location for Portal.io syncs</div>
          <select
            style={inp}
            value={defaultLocId || ''}
            onChange={e => saveLocation(e.target.value)}
            disabled={savingLoc}
          >
            <option value="">— Unassigned —</option>
            {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
          </select>
          <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 6, lineHeight: 1.5 }}>
            Used when an incoming contact doesn't match an existing client.
          </div>
        </div>
        <div>
          <div style={lbl}>Actions</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={runTest} disabled={testing} style={{ ...ghostBtn, opacity: testing ? 0.6 : 1 }}>
              {testing ? 'Testing…' : 'Test webhook'}
            </button>
            <button onClick={() => setShowRegenConfirm(true)} style={dangerBtn}>Regenerate secret</button>
            <button onClick={toggleConnected} disabled={connecting} style={integration.connected ? ghostBtn : primaryBtn}>
              {connecting ? '…' : (integration.connected ? 'Disconnect' : 'Connect')}
            </button>
          </div>
        </div>
      </div>

      {testResult && (
        <div style={{ background: testResult.ok ? 'rgba(52,199,89,0.08)' : 'rgba(255,59,48,0.08)', border: `1px solid ${testResult.ok ? 'rgba(52,199,89,0.25)' : 'rgba(255,59,48,0.25)'}`, borderRadius: 8, padding: '10px 12px', fontSize: 12, color: testResult.ok ? '#248a3d' : '#d70015', lineHeight: 1.5 }}>
          <strong>{testResult.ok ? '✓ Test fired' : '✗ Test failed'}:</strong> {testResult.message}
          {testResult.detail && (
            <div style={{ marginTop: 6, fontSize: 11, fontFamily: 'ui-monospace, monospace', color: 'var(--text2)' }}>
              {JSON.stringify(testResult.detail)}
            </div>
          )}
        </div>
      )}

      {showRegenConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={() => setShowRegenConfirm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg2)', borderRadius: 12, padding: 22, maxWidth: 440 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Regenerate Portal.io secret?</div>
            <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.55, marginBottom: 16 }}>
              The current webhook URLs in your Zapier configuration will <strong>stop working immediately</strong>. You'll need to copy the new URLs into Zapier's webhook actions.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowRegenConfirm(false)} style={ghostBtn}>Cancel</button>
              <button onClick={regenerate} style={dangerBtn}>Regenerate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Static cards for the other integrations -------------------------------

function StaticIntegrationCard({ initials, color, name, category, description, status }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: 20, marginBottom: 14, opacity: 0.85 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{initials}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{name}</div>
              <span style={{ fontSize: 10.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>{category}</span>
            </div>
            {status}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{description}</div>
        </div>
      </div>
    </div>
  )
}

// --- main page --------------------------------------------------------------

export default function Integrations() {
  const [integrations, setIntegrations] = useState(null)
  const [locations, setLocations] = useState([])
  const [error, setError] = useState('')

  const reload = async () => {
    try {
      const [ints, locs] = await Promise.all([
        api('/api/integrations'),
        api('/api/locations'),
      ])
      setIntegrations(ints)
      setLocations(locs)
      setError('')
    } catch (err) {
      setError(err.message)
      setIntegrations([])
    }
  }

  useEffect(() => { reload() }, [])

  const portal = (integrations || []).find(i => i.kind === 'portal_io')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Integrations & APIs</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 32px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          {integrations == null && !error && (
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>Loading integrations…</div>
          )}
          {error && (
            <div style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.25)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#d70015', marginBottom: 14 }}>
              {error} <button onClick={reload} style={{ background: 'none', border: 'none', color: '#d70015', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'var(--font)' }}>Retry</button>
            </div>
          )}

          {integrations != null && (
            <>
              <div style={{ fontSize: 10.5, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>Wired integrations</div>
              {portal && <PortalIoCard integration={portal} locations={locations} onChanged={reload} />}

              <div style={{ fontSize: 10.5, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 18, marginBottom: 10 }}>Other</div>

              <StaticIntegrationCard
                initials="AI"
                color="#1d1d1f"
                name="Anthropic API"
                category="AI"
                description="Powers Intellix Assist. The API key is managed server-side via the ANTHROPIC_API_KEY environment variable on the backend host — there's no key field to configure here."
                status={<StatusPill connected={true} label="Managed via env" />}
              />
              <StaticIntegrationCard
                initials="OV"
                color="#0066cc"
                name="OVRC"
                category="Remote monitoring"
                description="Remote monitoring and management of Snap One / SnapAV devices across all client sites. API integration not yet wired."
                status={<StatusPill connected={false} label="Not connected" />}
              />
              <StaticIntegrationCard
                initials="CC"
                color="#ff9500"
                name="CompanyCam"
                category="Photo documentation"
                description="Sync job-site photos to client projects. Photos tagged by job appear on job and ticket pages. API integration not yet wired."
                status={<StatusPill connected={false} label="Not connected" />}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'

const INTEGRATIONS = [
  {
    id: 'anthropic',
    name: 'Anthropic API',
    category: 'AI',
    color: '#1d1d1f',
    initials: 'AI',
    description: 'Powers Intellix Assist — Control4 programming help, proposal drafting, and client communication.',
    keyLabel: 'API key',
    keyPlaceholder: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com',
  },
  {
    id: 'ovrc',
    name: 'OVRC',
    category: 'Remote monitoring',
    color: '#0066cc',
    initials: 'OV',
    description: 'Remote monitoring and management of Snap One / SnapAV devices across all client sites.',
    keyLabel: 'API key',
    keyPlaceholder: 'Enter OVRC API key',
    docsUrl: 'https://www.ovrc.com',
  },
  {
    id: 'companycam',
    name: 'CompanyCam',
    category: 'Photo documentation',
    color: '#ff9500',
    initials: 'CC',
    description: 'Sync job-site photos to client projects. Photos tagged by job appear on job and ticket pages.',
    keyLabel: 'API token',
    keyPlaceholder: 'ccam_...',
    docsUrl: 'https://companycam.com/developers',
  },
  {
    id: 'portal',
    name: 'Portal.io (via Zapier)',
    category: 'Proposal portal',
    color: '#534AB7',
    initials: 'PT',
    description: 'Send and track Portal.io proposals. Accepted proposals auto-create jobs. Connected through a Zapier webhook.',
    keyLabel: 'Zapier webhook URL',
    keyPlaceholder: 'https://hooks.zapier.com/hooks/catch/...',
    docsUrl: 'https://zapier.com',
  },
]

const lbl = { fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5 }
const inp = { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 11px', fontSize: 12.5, color: 'var(--text)', fontFamily: 'var(--font)', outline: 'none' }
const primaryBtn = { padding: '8px 18px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#1d1d1f', color: '#fff', fontFamily: 'var(--font)' }
const ghostBtn = { padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontFamily: 'var(--font)' }
const dangerBtn = { padding: '8px 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(255,59,48,0.3)', background: 'transparent', color: '#d70015', fontFamily: 'var(--font)' }

function StatusPill({ connected }) {
  const bg = connected ? 'rgba(52,199,89,0.09)' : 'rgba(174,174,178,0.15)'
  const color = connected ? '#248a3d' : '#6e6e73'
  const dot = connected ? '#34c759' : '#aeaeb2'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 5, fontSize: 10.5, fontWeight: 700, background: bg, color }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot }} />
      {connected ? 'Connected' : 'Not connected'}
    </span>
  )
}

function mask(key) {
  if (!key) return ''
  if (key.length <= 8) return '•'.repeat(key.length)
  return key.slice(0, 4) + '•'.repeat(Math.max(8, key.length - 8)) + key.slice(-4)
}

function IntegrationCard({ integration, state, onConnect, onDisconnect }) {
  const { connected, key, savedKey } = state
  const [reveal, setReveal] = useState(false)

  const canConnect = key.trim().length > 0
  const displayValue = connected && !reveal ? mask(savedKey) : key

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 42, height: 42, minWidth: 42, borderRadius: 10, background: integration.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>
          {integration.initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{integration.name}</div>
            <StatusPill connected={connected} />
          </div>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{integration.category}</div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{integration.description}</div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
          <div style={lbl}>{integration.keyLabel}</div>
          {connected && (
            <button onClick={() => setReveal(r => !r)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10.5, fontWeight: 600, color: 'var(--accent)', padding: 0, fontFamily: 'var(--font)' }}>
              {reveal ? 'Hide' : 'Reveal'}
            </button>
          )}
        </div>
        <input
          type={connected && !reveal ? 'text' : 'password'}
          style={{ ...inp, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11.5 }}
          placeholder={integration.keyPlaceholder}
          value={displayValue}
          readOnly={connected && !reveal}
          onChange={e => onConnect.setKey(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
        <a href={integration.docsUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          Docs
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
        {connected
          ? <button onClick={onDisconnect} style={dangerBtn}>Disconnect</button>
          : <button onClick={onConnect.submit} disabled={!canConnect} style={{ ...primaryBtn, opacity: canConnect ? 1 : 0.5, cursor: canConnect ? 'pointer' : 'not-allowed' }}>Connect</button>}
      </div>
    </div>
  )
}

export default function Integrations() {
  const [state, setState] = useState(() =>
    INTEGRATIONS.reduce((acc, i) => {
      acc[i.id] = { connected: false, key: '', savedKey: '' }
      return acc
    }, {})
  )

  const update = (id, patch) => setState(s => ({ ...s, [id]: { ...s[id], ...patch } }))
  const setKey = (id) => (value) => update(id, { key: value })
  const connect = (id) => () => {
    const key = state[id].key.trim()
    if (!key) return
    update(id, { connected: true, savedKey: key, key: '' })
  }
  const disconnect = (id) => () => update(id, { connected: false, key: '', savedKey: '' })

  const connectedCount = Object.values(state).filter(s => s.connected).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Integrations & APIs</div>
          <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>
            {connectedCount} of {INTEGRATIONS.length} connected
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px' }}>

        <div style={{ background: 'rgba(0,102,204,0.04)', border: '1px solid rgba(0,102,204,0.15)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span style={{ fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.5 }}>
            Keys are stored locally in this session only. In production, connect your workspace to route secrets through the server.
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
          {INTEGRATIONS.map(integration => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              state={state[integration.id]}
              onConnect={{ setKey: setKey(integration.id), submit: connect(integration.id) }}
              onDisconnect={disconnect(integration.id)}
            />
          ))}
        </div>

      </div>
    </div>
  )
}

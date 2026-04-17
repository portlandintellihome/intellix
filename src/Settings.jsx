import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const CHECKLIST = [
  { id: 'company',      label: 'Add company info',              detail: 'Name, address, phone, and business hours',       done: false, path: null,              cta: 'Fill in below' },
  { id: 'logo',         label: 'Upload company logo',           detail: 'Appears on proposals and client portals',         done: false, path: null,              cta: 'Upload' },
  { id: 'anthropic',    label: 'Connect Anthropic API',         detail: 'Powers Intellix Assist',                           done: false, path: '/integrations',   cta: 'Connect' },
  { id: 'ovrc',         label: 'Connect OVRC',                  detail: 'Remote monitoring of client devices',              done: false, path: '/integrations',   cta: 'Connect' },
  { id: 'portal',       label: 'Connect Portal.io',             detail: 'Proposal sending and tracking via Zapier',         done: false, path: '/integrations',   cta: 'Connect' },
  { id: 'team',         label: 'Add your first employee',       detail: 'Installers, programmers, and office staff',        done: false, path: '/team',           cta: 'Invite' },
  { id: 'invite',       label: 'Invite the rest of your team',  detail: 'Send login invites so everyone can collaborate',   done: false, path: '/team',           cta: 'Invite' },
  { id: 'client',       label: 'Add your first client',         detail: 'Start tracking jobs, proposals, and tickets',      done: false, path: '/clients',        cta: 'Add client' },
  { id: 'proposal',     label: 'Send your first proposal',      detail: 'Portal.io connection required',                    done: false, path: '/jobs',           cta: 'New proposal' },
]

const DEFAULT_COMPANY = {
  name: '',
  legalName: '',
  phone: '',
  email: '',
  website: '',
  address: '',
  timezone: 'America/Los_Angeles',
  currency: 'USD',
  taxRate: '0',
  hoursStart: '08:00',
  hoursEnd: '17:00',
}

const TIMEZONES = [
  'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York',
  'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu',
]
const CURRENCIES = ['USD', 'CAD', 'EUR', 'GBP', 'AUD']

const lbl = { fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5 }
const inp = { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 11px', fontSize: 12.5, color: 'var(--text)', fontFamily: 'var(--font)', outline: 'none' }
const primaryBtn = { padding: '8px 18px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#1d1d1f', color: '#fff', fontFamily: 'var(--font)' }
const ghostBtn = { padding: '7px 14px', borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontFamily: 'var(--font)' }
const linkBtn = { padding: '7px 14px', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'rgba(0,102,204,0.08)', color: 'var(--accent)', fontFamily: 'var(--font)' }

const s = {
  topbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 },
  title: { fontSize: 14, fontWeight: 700, color: 'var(--text)' },
  content: { flex: 1, overflowY: 'auto', padding: '16px 24px 24px' },
  card: { background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '18px 20px', marginBottom: 14 },
  sectionTitle: { fontSize: 10.5, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 12 },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  cardHeaderTitle: { fontSize: 13.5, fontWeight: 700, color: 'var(--text)' },
  cardHeaderSub: { fontSize: 11.5, color: 'var(--text2)', marginTop: 2 },
}

function Check({ done }) {
  if (done) {
    return (
      <div style={{ width: 20, height: 20, minWidth: 20, borderRadius: '50%', background: '#34c759', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
    )
  }
  return <div style={{ width: 20, height: 20, minWidth: 20, borderRadius: '50%', border: '1.5px dashed var(--border)', background: 'transparent' }} />
}

function ChecklistRow({ item, onAction, last }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: last ? 'none' : '1px solid var(--border2)' }}>
      <Check done={item.done} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: item.done ? 'var(--text2)' : 'var(--text)', textDecoration: item.done ? 'line-through' : 'none' }}>{item.label}</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{item.detail}</div>
      </div>
      {item.cta && !item.done && (
        <button onClick={() => onAction(item)} style={linkBtn}>{item.cta}</button>
      )}
    </div>
  )
}

function SetupChecklist({ items, onAction }) {
  const done = items.filter(i => i.done).length
  const pct = Math.round((done / items.length) * 100)

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <div>
          <div style={s.cardHeaderTitle}>Setup checklist</div>
          <div style={s.cardHeaderSub}>{done} of {items.length} complete</div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: pct === 100 ? '#248a3d' : 'var(--accent)' }}>{pct}%</div>
      </div>

      <div style={{ height: 6, background: 'var(--bg4)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#34c759' : 'var(--accent)', transition: 'width 0.3s' }} />
      </div>

      <div>
        {items.map((item, i) => (
          <ChecklistRow key={item.id} item={item} onAction={onAction} last={i === items.length - 1} />
        ))}
      </div>
    </div>
  )
}

function CompanyInfo() {
  const [form, setForm] = useState(DEFAULT_COMPANY)
  const [saved, setSaved] = useState(false)
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setSaved(false) }

  const save = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <div>
          <div style={s.cardHeaderTitle}>Company info</div>
          <div style={s.cardHeaderSub}>Appears on proposals, invoices, and client-facing pages</div>
        </div>
        {saved && <span style={{ fontSize: 11.5, color: '#248a3d', fontWeight: 600 }}>✓ Saved</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={lbl}>Business name</div>
          <input style={inp} value={form.name} onChange={e => set('name', e.target.value)} />
        </div>
        <div>
          <div style={lbl}>Legal name</div>
          <input style={inp} value={form.legalName} onChange={e => set('legalName', e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={lbl}>Phone</div>
          <input style={inp} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} />
        </div>
        <div>
          <div style={lbl}>Email</div>
          <input style={inp} type="email" value={form.email} onChange={e => set('email', e.target.value)} />
        </div>
        <div>
          <div style={lbl}>Website</div>
          <input style={inp} value={form.website} onChange={e => set('website', e.target.value)} />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={lbl}>Business address</div>
        <input style={inp} value={form.address} onChange={e => set('address', e.target.value)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={lbl}>Timezone</div>
          <select style={inp} value={form.timezone} onChange={e => set('timezone', e.target.value)}>
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>
        <div>
          <div style={lbl}>Currency</div>
          <select style={inp} value={form.currency} onChange={e => set('currency', e.target.value)}>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <div style={lbl}>Tax rate (%)</div>
          <input style={inp} type="number" value={form.taxRate} onChange={e => set('taxRate', e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={lbl}>Business hours — start</div>
          <input style={inp} type="time" value={form.hoursStart} onChange={e => set('hoursStart', e.target.value)} />
        </div>
        <div>
          <div style={lbl}>Business hours — end</div>
          <input style={inp} type="time" value={form.hoursEnd} onChange={e => set('hoursEnd', e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={save} style={primaryBtn}>Save company info</button>
      </div>
    </div>
  )
}

function IntegrationsSummary({ navigate }) {
  const items = [
    { name: 'Anthropic API',        connected: false },
    { name: 'OVRC',                 connected: false },
    { name: 'CompanyCam',           connected: false },
    { name: 'Portal.io (Zapier)',   connected: false },
  ]
  const connected = items.filter(i => i.connected).length

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <div>
          <div style={s.cardHeaderTitle}>Integrations</div>
          <div style={s.cardHeaderSub}>{connected} of {items.length} services connected</div>
        </div>
        <button onClick={() => navigate('/integrations')} style={ghostBtn}>Manage integrations →</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        {items.map(i => (
          <div key={i.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: '1px solid var(--border2)', borderRadius: 8, background: 'var(--bg3)' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: i.connected ? '#34c759' : '#aeaeb2' }} />
            <div style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{i.name}</div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: i.connected ? '#248a3d' : 'var(--text3)' }}>
              {i.connected ? 'Connected' : 'Not set'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TeamSummary({ navigate }) {
  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <div>
          <div style={s.cardHeaderTitle}>Team setup</div>
          <div style={s.cardHeaderSub}>No team members added yet</div>
        </div>
        <button onClick={() => navigate('/team')} style={ghostBtn}>Manage team →</button>
      </div>
      <div style={{ textAlign: 'center', padding: '24px 0 8px' }}>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>Invite your first teammate to get started.</div>
        <button onClick={() => navigate('/team')} style={linkBtn}>Invite employee</button>
      </div>
    </div>
  )
}

export default function Settings() {
  const navigate = useNavigate()

  const onChecklistAction = (item) => {
    if (item.path) navigate(item.path)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      <div style={s.topbar}>
        <div style={s.title}>Settings</div>
      </div>

      <div style={s.content}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>

          <div style={s.sectionTitle}>Getting started</div>
          <SetupChecklist items={CHECKLIST} onAction={onChecklistAction} />

          <div style={s.sectionTitle}>Company</div>
          <CompanyInfo />

          <div style={s.sectionTitle}>Integrations</div>
          <IntegrationsSummary navigate={navigate} />

          <div style={s.sectionTitle}>Team</div>
          <TeamSummary navigate={navigate} />

        </div>
      </div>
    </div>
  )
}

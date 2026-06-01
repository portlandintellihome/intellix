import { useState, useEffect } from 'react'
import { apiGet } from './lib/api'
import { colorForInitials, initialsOf } from './lib/color'

const PLAN_TIERS = [
  { id: 'None',     price: 0,   color: 'var(--text3)', swatch: '#aeaeb2' },
  { id: 'Basic',    price: 49,  color: '#0066cc',      swatch: '#0066cc' },
  { id: 'Standard', price: 99,  color: '#248a3d',      swatch: '#34c759' },
  { id: 'Premium',  price: 199, color: '#534AB7',      swatch: '#534AB7' },
]

const CHECKIN_INTERVALS = [
  { days: 30,  label: '30-day' },
  { days: 90,  label: '90-day' },
  { days: 365, label: '1-year' },
]

const lbl = { fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5 }
const inp = { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 11px', fontSize: 12.5, color: 'var(--text)', fontFamily: 'var(--font)', outline: 'none' }
const primaryBtn = { padding: '8px 18px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#1d1d1f', color: '#fff', fontFamily: 'var(--font)' }
const ghostBtn = { padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontFamily: 'var(--font)' }

function tierByName(name) {
  return PLAN_TIERS.find(t => t.id === name) || PLAN_TIERS[0]
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function addDays(iso, days) {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function isOverdue(iso) {
  if (!iso) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(iso) < today
}

function TierBadge({ tier }) {
  const t = tierByName(tier)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 5, fontSize: 10.5, fontWeight: 700, background: `${t.swatch}18`, color: t.color }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.swatch }} />
      {t.id}
    </span>
  )
}

function StatusBadge({ status }) {
  const map = {
    Pending:  { bg: 'rgba(174,174,178,0.15)', color: '#6e6e73', dot: '#aeaeb2' },
    Sent:     { bg: 'rgba(52,199,89,0.09)',   color: '#248a3d', dot: '#34c759' },
    Overdue:  { bg: 'rgba(255,59,48,0.08)',   color: '#d70015', dot: '#ff3b30' },
  }
  const st = map[status] || map.Pending
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 5, fontSize: 10, fontWeight: 700, background: st.bg, color: st.color }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: st.dot }} />
      {status}
    </span>
  )
}

function PlanModal({ client, plan, onClose, onSave }) {
  const [tier, setTier] = useState(plan?.tier || 'None')
  const [startDate, setStartDate] = useState(plan?.startDate || '')
  const [renewalDate, setRenewalDate] = useState(plan?.renewalDate || '')

  const autoRenewal = () => {
    if (!startDate) return
    setRenewalDate(addDays(startDate, 365))
  }

  const save = () => {
    onSave({ tier, startDate: startDate || null, renewalDate: renewalDate || null })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 14, width: 500, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px', borderBottom: '1px solid var(--border2)' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Assign plan</div>
            <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 2 }}>{client.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'var(--bg4)', border: 'none', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', color: 'var(--text2)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ padding: '18px 22px' }}>
          <div style={lbl}>Plan tier</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            {PLAN_TIERS.map(t => {
              const selected = tier === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTier(t.id)}
                  style={{
                    textAlign: 'left',
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: `1px solid ${selected ? t.swatch : 'var(--border2)'}`,
                    background: selected ? `${t.swatch}12` : 'var(--bg3)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.swatch }} />
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{t.id}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>${t.price}/mo</div>
                </button>
              )
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
            <div>
              <div style={lbl}>Plan start date</div>
              <input style={inp} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} disabled={tier === 'None'} />
            </div>
            <div>
              <div style={{ ...lbl, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span>Next renewal</span>
                <button type="button" onClick={autoRenewal} disabled={!startDate || tier === 'None'} style={{ background: 'none', border: 'none', padding: 0, cursor: (!startDate || tier === 'None') ? 'not-allowed' : 'pointer', color: 'var(--accent)', fontSize: 10.5, fontWeight: 700, fontFamily: 'var(--font)', opacity: (!startDate || tier === 'None') ? 0.4 : 1 }}>+1 year</button>
              </div>
              <input style={inp} type="date" value={renewalDate} onChange={e => setRenewalDate(e.target.value)} disabled={tier === 'None'} />
            </div>
          </div>
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border2)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={ghostBtn}>Cancel</button>
          <button onClick={save} style={primaryBtn}>Save plan</button>
        </div>
      </div>
    </div>
  )
}

function ServicePlansTab({ clients, plans, onSavePlan }) {
  const [selected, setSelected] = useState(null)

  const mrr = clients.reduce((sum, c) => sum + tierByName(plans[c.id]?.tier).price, 0)
  const tierCounts = PLAN_TIERS.map(t => ({
    ...t,
    count: clients.filter(c => (plans[c.id]?.tier || 'None') === t.id).length,
  }))

  if (clients.length === 0) {
    return (
      <div style={{ padding: '16px 24px 24px' }}>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>No clients yet</div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>Add a client first, then you can assign them a service plan.</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px 24px 24px' }}>
      {/* MRR + TIER COUNTS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr', gap: 10, marginBottom: 18 }}>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Monthly recurring revenue</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>${mrr.toLocaleString()}</div>
          <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2 }}>across {clients.length} client{clients.length === 1 ? '' : 's'}</div>
        </div>
        {tierCounts.map(t => (
          <div key={t.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.swatch }} />
              {t.id}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{t.count}</div>
            <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2 }}>${t.price}/mo</div>
          </div>
        ))}
      </div>

      {/* CLIENT TABLE */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', padding: '9px 16px', background: 'var(--bg3)', borderBottom: '1px solid var(--border2)' }}>
          {['Client', 'Plan', 'Price', 'Start', 'Renewal', ''].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</div>
          ))}
        </div>
        {clients.map((c, i) => {
          const plan = plans[c.id]
          const tier = tierByName(plan?.tier)
          return (
            <div
              key={c.id}
              onClick={() => setSelected(c)}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto',
                padding: '12px 16px',
                borderBottom: i < clients.length - 1 ? '1px solid var(--border2)' : 'none',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'background 0.1s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{ width: 30, height: 30, minWidth: 30, borderRadius: '50%', background: colorForInitials(initialsOf(c.name)), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>{initialsOf(c.name)}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.email || ''}</div>
                </div>
              </div>
              <div><TierBadge tier={plan?.tier || 'None'} /></div>
              <div style={{ fontSize: 12, color: tier.price > 0 ? 'var(--text)' : 'var(--text3)', fontWeight: 600 }}>{tier.price > 0 ? `$${tier.price}/mo` : '—'}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>{formatDate(plan?.startDate)}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>{formatDate(plan?.renewalDate)}</div>
              <button onClick={e => { e.stopPropagation(); setSelected(c) }} style={{ ...ghostBtn, padding: '5px 11px', fontSize: 11 }}>{plan?.tier && plan.tier !== 'None' ? 'Change' : 'Assign'}</button>
            </div>
          )
        })}
      </div>

      {selected && (
        <PlanModal
          client={selected}
          plan={plans[selected.id]}
          onClose={() => setSelected(null)}
          onSave={p => onSavePlan(selected.id, p)}
        />
      )}
    </div>
  )
}

function CheckInsTab({ clients, jobs, sent, onSend }) {
  // latest completed job per client
  const lastJobByClient = {}
  for (const j of jobs) {
    if (j.status !== 'completed' || !j.end_date || !j.client_id) continue
    const existing = lastJobByClient[j.client_id]
    if (!existing || new Date(j.end_date) > new Date(existing.end_date)) {
      lastJobByClient[j.client_id] = j
    }
  }

  const statusFor = (clientId, scheduled, days) => {
    if (sent[`${clientId}_${days}`]) return 'Sent'
    if (isOverdue(scheduled)) return 'Overdue'
    return 'Pending'
  }

  if (clients.length === 0) {
    return (
      <div style={{ padding: '16px 24px 24px' }}>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>No clients yet</div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>Check-in sequences kick in once you have clients with completed jobs.</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px 24px 24px' }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(3, 1fr)', padding: '9px 16px', background: 'var(--bg3)', borderBottom: '1px solid var(--border2)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Client</div>
          {CHECKIN_INTERVALS.map(iv => (
            <div key={iv.days} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{iv.label} check-in</div>
          ))}
        </div>

        {clients.map((c, i) => {
          const lastJob = lastJobByClient[c.id]
          const closeDate = lastJob?.end_date
          return (
            <div
              key={c.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.4fr repeat(3, 1fr)',
                padding: '14px 16px',
                borderBottom: i < clients.length - 1 ? '1px solid var(--border2)' : 'none',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{ width: 30, height: 30, minWidth: 30, borderRadius: '50%', background: colorForInitials(initialsOf(c.name)), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>{initialsOf(c.name)}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>
                    {closeDate ? `Last close · ${formatDate(closeDate)}` : 'No completed job yet'}
                  </div>
                </div>
              </div>

              {CHECKIN_INTERVALS.map(iv => {
                if (!closeDate) {
                  return (
                    <div key={iv.days} style={{ fontSize: 11, color: 'var(--text3)' }}>—</div>
                  )
                }
                const scheduled = addDays(closeDate, iv.days)
                const status = statusFor(c.id, scheduled, iv.days)
                return (
                  <div key={iv.days} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <StatusBadge status={status} />
                      <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>{formatDate(scheduled)}</span>
                    </div>
                    {status !== 'Sent' && (
                      <button
                        onClick={() => onSend(c.id, iv.days, scheduled)}
                        style={{ alignSelf: 'flex-start', padding: '3px 9px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 10.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}
                      >
                        Send now
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Outreach() {
  const [tab, setTab] = useState('plans')
  const [clients, setClients] = useState([])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState({})
  const [sent, setSent] = useState({})

  useEffect(() => {
    Promise.all([
      apiGet('/api/clients').catch(() => []),
      apiGet('/api/jobs').catch(() => []),
      apiGet('/api/check-ins').catch(() => []),
    ]).then(([c, j, ci]) => {
      setClients(c)
      setJobs(j)

      const planMap = {}
      for (const client of c) {
        if (client.plan_tier && client.plan_tier !== 'None') {
          planMap[client.id] = {
            tier: client.plan_tier,
            startDate: client.plan_start_date ? String(client.plan_start_date).slice(0, 10) : null,
            renewalDate: client.plan_renewal_date ? String(client.plan_renewal_date).slice(0, 10) : null,
          }
        }
      }
      setPlans(planMap)

      const sentMap = {}
      for (const row of ci) {
        if (row.sent_at) sentMap[`${row.client_id}_${row.interval_days}`] = true
      }
      setSent(sentMap)
    }).finally(() => setLoading(false))
  }, [])

  const savePlan = async (clientId, planData) => {
    const base = import.meta.env.VITE_API_URL || ''
    try {
      const res = await fetch(`${base}/api/clients/${clientId}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_tier: planData.tier,
          plan_start_date: planData.startDate,
          plan_renewal_date: planData.renewalDate,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `${res.status}`)
      }
      setPlans(prev => {
        const next = { ...prev }
        if (planData.tier === 'None') delete next[clientId]
        else next[clientId] = planData
        return next
      })
    } catch (err) {
      console.error('Failed to save plan', err)
      alert('Failed to save plan: ' + err.message)
    }
  }

  const sendCheckIn = async (clientId, intervalDays, scheduledFor) => {
    const base = import.meta.env.VITE_API_URL || ''
    try {
      const res = await fetch(`${base}/api/check-ins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          interval_days: intervalDays,
          scheduled_for: scheduledFor,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `${res.status}`)
      }
      setSent(prev => ({ ...prev, [`${clientId}_${intervalDays}`]: true }))
    } catch (err) {
      console.error('Failed to record check-in', err)
      alert('Failed to record check-in: ' + err.message)
    }
  }

  const tabs = [
    { key: 'plans', label: 'Service plans' },
    { key: 'checkins', label: 'Check-ins' },
  ]

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '13px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Outreach</div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13, fontWeight: 500 }}>Loading…</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Outreach</div>
      </div>

      <div style={{ display: 'flex', padding: '0 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 16px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: 'transparent',
              color: tab === t.key ? 'var(--accent)' : 'var(--text2)',
              borderBottom: `2px solid ${tab === t.key ? 'var(--accent)' : 'transparent'}`,
              fontFamily: 'var(--font)',
              transition: 'all 0.12s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'plans' && <ServicePlansTab clients={clients} plans={plans} onSavePlan={savePlan} />}
        {tab === 'checkins' && <CheckInsTab clients={clients} jobs={jobs} sent={sent} onSend={sendCheckIn} />}
      </div>
    </div>
  )
}

import { useState } from 'react'

const STATS = [
  { label: 'Jobs completed', value: '12', sub: 'this month', delta: '+3 vs last month', up: true, color: '#34c759' },
  { label: 'Revenue', value: '$184k', sub: 'this month', delta: '+$22k vs last month', up: true, color: '#0066cc' },
  { label: 'Avg job duration', value: '6.4d', sub: 'across 12 jobs', delta: '-0.8d vs last month', up: true, color: '#534AB7' },
  { label: 'Team utilization', value: '78%', sub: '4 active members', delta: '+5% vs last month', up: true, color: '#ff9500' },
]

const JOBS_PER_MONTH = [
  { month: 'Nov', count: 7,  revenue: 92 },
  { month: 'Dec', count: 5,  revenue: 68 },
  { month: 'Jan', count: 8,  revenue: 110 },
  { month: 'Feb', count: 9,  revenue: 138 },
  { month: 'Mar', count: 9,  revenue: 162 },
  { month: 'Apr', count: 12, revenue: 184 },
]

const REVENUE_BY_CATEGORY = [
  { label: 'Full home AV',      value: 82, color: '#0066cc' },
  { label: 'Lighting control',  value: 41, color: '#534AB7' },
  { label: 'Network / WiFi',    value: 28, color: '#34c759' },
  { label: 'Service & repair',  value: 19, color: '#ff9500' },
  { label: 'Other',             value: 14, color: '#aeaeb2' },
]

const TEAM_UTIL = [
  { initials: 'JD', name: 'John D.',  pct: 92, color: '#0066cc' },
  { initials: 'SW', name: 'Sam W.',   pct: 84, color: '#534AB7' },
  { initials: 'MR', name: 'Mike R.',  pct: 71, color: '#34c759' },
  { initials: 'AL', name: 'Amy L.',   pct: 65, color: '#ff9500' },
]

const RANGES = ['30 days', '90 days', '12 months', 'YTD']

const s = {
  topbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 },
  title: { fontSize: 14, fontWeight: 700, color: 'var(--text)' },
  content: { flex: 1, overflowY: 'auto', padding: '16px 24px 24px' },
  card: { background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '16px 18px' },
  cardTitle: { fontSize: 10.5, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 12 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 },
  twoCol: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 },
  segBtn: (active) => ({ padding: '5px 11px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'), background: active ? 'rgba(0,102,204,0.08)' : 'transparent', color: active ? 'var(--accent)' : 'var(--text2)', fontFamily: 'var(--font)' }),
}

function StatCard({ stat }) {
  return (
    <div style={s.card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: stat.color }} />
        <div style={{ fontSize: 10.5, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{stat.label}</div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1 }}>{stat.value}</div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{stat.sub}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 10, fontSize: 11, fontWeight: 600, color: stat.up ? '#248a3d' : '#d70015' }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          {stat.up
            ? <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            : <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />}
        </svg>
        {stat.delta}
      </div>
    </div>
  )
}

function BarChart({ data }) {
  const max = Math.max(...data.map(d => d.count))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, height: 200, padding: '8px 4px 0' }}>
      {data.map((d, i) => {
        const h = Math.round((d.count / max) * 170)
        const isLatest = i === data.length - 1
        return (
          <div key={d.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>{d.count}</div>
            <div
              title={`${d.month}: ${d.count} jobs · $${d.revenue}k`}
              style={{
                width: '100%',
                maxWidth: 48,
                height: h,
                background: isLatest ? 'var(--accent)' : 'rgba(0,102,204,0.25)',
                borderRadius: '6px 6px 2px 2px',
                transition: 'height 0.3s ease',
              }}
            />
            <div style={{ fontSize: 11, color: isLatest ? 'var(--text)' : 'var(--text2)', fontWeight: isLatest ? 700 : 500 }}>{d.month}</div>
          </div>
        )
      })}
    </div>
  )
}

function RevenueBreakdown({ data }) {
  const total = data.reduce((n, d) => n + d.value, 0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: 'var(--bg4)' }}>
        {data.map(d => (
          <div key={d.label} title={`${d.label}: $${d.value}k`} style={{ width: `${(d.value / total) * 100}%`, background: d.color }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.map(d => (
          <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
            <div style={{ width: 9, height: 9, borderRadius: 2, background: d.color, flexShrink: 0 }} />
            <div style={{ flex: 1, color: 'var(--text)' }}>{d.label}</div>
            <div style={{ color: 'var(--text2)', fontWeight: 500 }}>${d.value}k</div>
            <div style={{ color: 'var(--text3)', fontSize: 11, width: 36, textAlign: 'right' }}>{Math.round((d.value / total) * 100)}%</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TeamUtilRow({ member }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border2)' }}>
      <div style={{ width: 28, height: 28, minWidth: 28, borderRadius: '50%', background: member.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 700, color: '#fff' }}>
        {member.initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 5 }}>{member.name}</div>
        <div style={{ height: 5, background: 'var(--bg4)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${member.pct}%`, height: '100%', background: member.color, transition: 'width 0.3s' }} />
        </div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', width: 40, textAlign: 'right' }}>{member.pct}%</div>
    </div>
  )
}

export default function Reporting() {
  const [range, setRange] = useState('30 days')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      <div style={s.topbar}>
        <div style={s.title}>Reporting</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {RANGES.map(r => (
            <button key={r} onClick={() => setRange(r)} style={s.segBtn(range === r)}>{r}</button>
          ))}
        </div>
      </div>

      <div style={s.content}>

        <div style={s.statsGrid}>
          {STATS.map(stat => <StatCard key={stat.label} stat={stat} />)}
        </div>

        <div style={s.twoCol}>
          <div style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={s.cardTitle}>Jobs per month</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Last 6 months</div>
            </div>
            <BarChart data={JOBS_PER_MONTH} />
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>Revenue by category</div>
            <RevenueBreakdown data={REVENUE_BY_CATEGORY} />
          </div>
        </div>

        <div style={s.card}>
          <div style={s.cardTitle}>Team utilization</div>
          {TEAM_UTIL.map((m, i) => (
            <div key={m.initials} style={i === TEAM_UTIL.length - 1 ? { marginBottom: -10 } : undefined}>
              <TeamUtilRow member={m} />
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}

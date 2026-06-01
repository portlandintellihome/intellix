import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from './lib/api'
import { colorForInitials, initialsOf } from './lib/color'

const quickActions = [
  { label: 'New job', path: '/jobs', color: '#1d1d1f' },
  { label: 'New build doc', path: '/composer', color: '#0066cc' },
  { label: 'New support ticket', path: '/tickets', color: '#ff9500' },
  { label: 'New proposal', path: '/jobs', color: '#534AB7' },
]

const messages = []
const activity = []

function relTime(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

const s = {
  topbar: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 24px', background:'var(--bg2)', borderBottom:'1px solid var(--border2)', flexShrink:0 },
  title: { fontSize:14, fontWeight:700, color:'var(--text)' },
  content: { flex:1, overflowY:'auto', padding:'16px 24px 24px' },
  card: { background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:12, padding:'14px 16px', marginBottom:14 },
  cardTitle: { fontSize:10.5, color:'var(--text2)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:12 },
  row: { display:'flex', gap:10, padding:'8px 0', borderBottom:'1px solid var(--border2)', alignItems:'flex-start' },
  rowLast: { display:'flex', gap:10, padding:'8px 0', alignItems:'flex-start' },
  label: { fontSize:11.5, color:'var(--text)', fontWeight:500, lineHeight:1.4 },
  sub: { fontSize:10.5, color:'var(--text3)', marginTop:2 },
  dot: (c) => ({ width:7, height:7, minWidth:7, borderRadius:'50%', background:c, marginTop:4 }),
  badge: (bg, color) => ({ display:'inline-block', padding:'2px 8px', borderRadius:5, fontSize:10, fontWeight:700, background:bg, color }),
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 },
  grid4: { display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:10, marginBottom:16 },
  statCard: { background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:12, padding:'14px 16px' },
  quickRow: { display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' },
  quickBtn: (bg) => ({ padding:'8px 16px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', border:'none', background:bg, color:'#fff', fontFamily:'var(--font)' }),
  avatar: (bg) => ({ width:28, height:28, minWidth:28, borderRadius:'50%', background:bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff' }),
  teamRow: { display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid var(--border2)' },
  teamRowLast: { display:'flex', alignItems:'center', gap:10, padding:'8px 0' },
}

// Canonical job lifecycle → display label.
const STATUS_LABELS = { pending: 'Pending', scheduled: 'Scheduled', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled' }

export default function Dashboard() {
  const navigate = useNavigate()

  const [jobs, setJobs] = useState([])
  const [tickets, setTickets] = useState([])
  const [team, setTeam] = useState([])
  const [buildsCount, setBuildsCount] = useState(0)

  useEffect(() => {
    Promise.all([
      apiGet('/api/jobs').catch(() => []),
      apiGet('/api/tickets').catch(() => []),
      apiGet('/api/team').catch(() => []),
      apiGet('/api/composer-builds').catch(() => []),
    ]).then(([j, t, tm, b]) => {
      setJobs(j.map(x => ({
        ...x,
        client: x.client_name || '',
        assigned: Array.isArray(x.assigned) ? x.assigned.join(' / ') : '',
        color: colorForInitials(Array.isArray(x.assigned) ? x.assigned[0] : null),
      })))
      setTickets(t.map(x => ({
        ...x,
        client: x.client_name || '',
        urgent: x.priority === 'Urgent',
        age: relTime(x.created_at),
      })))
      setTeam(tm.map(m => ({
        ...m,
        initials: m.initials || initialsOf(m.name),
        color: colorForInitials(m.initials || initialsOf(m.name)),
        job: m.job || '—',
      })))
      setBuildsCount(b.length)
    })
  }, [])

  const activeJobs = jobs.filter(j => j.status && !['completed', 'cancelled', 'scheduled', 'pending'].includes(j.status))
  const openTickets = tickets.filter(t => t.status !== 'Resolved')
  const availableTeam = team.filter(m => m.status === 'Available' || m.status === 'On site' || m.status === 'Remote' || m.status === 'Office')

  const stats = [
    { label: 'Active jobs', value: String(activeJobs.length), sub: activeJobs.length === 0 ? 'no active jobs' : `${activeJobs.length} in progress`, color: '#0066cc' },
    { label: 'Open tickets', value: String(openTickets.length), sub: openTickets.length === 0 ? 'no open tickets' : `${openTickets.filter(t => t.priority === 'Urgent').length} urgent`, color: '#ff3b30' },
    { label: 'Build docs', value: String(buildsCount), sub: buildsCount === 0 ? 'no builds yet' : 'across all jobs', color: '#34c759' },
    { label: 'Team available', value: String(availableTeam.length), sub: team.length === 0 ? 'no team members' : `of ${team.length} members`, color: '#ff9500' },
  ]

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>

      {/* TOPBAR */}
      <div style={s.topbar}>
        <div style={s.title}>Dashboard</div>
        <div style={{ fontSize:11, color:'var(--text3)', fontWeight:500 }}>
          {new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}
        </div>
      </div>

      <div style={s.content}>

        {/* QUICK ACTIONS */}
        <div style={s.quickRow}>
          {quickActions.map(a => (
            <button key={a.label} onClick={() => navigate(a.path)} style={s.quickBtn(a.color)}>
              + {a.label}
            </button>
          ))}
        </div>

        {/* STATS */}
        <div style={s.grid4}>
          {stats.map(st => (
            <div key={st.label} style={s.statCard}>
              <div style={{ fontSize:10, color:'var(--text2)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.3px', marginBottom:6 }}>{st.label}</div>
              <div style={{ fontSize:26, fontWeight:700, color:'var(--text)', letterSpacing:'-0.5px' }}>{st.value}</div>
              <div style={{ fontSize:10.5, color:'var(--text3)', marginTop:4, fontWeight:500 }}>
                <span style={{ display:'inline-block', width:5, height:5, borderRadius:'50%', background:st.color, marginRight:4, verticalAlign:'middle' }} />
                {st.sub}
              </div>
            </div>
          ))}
        </div>

        {/* TOP ROW — JOBS + TEAM */}
        <div style={s.grid2}>

          {/* ACTIVE JOBS */}
          <div style={s.card}>
            <div style={s.cardTitle}>Active jobs</div>
            {jobs.length === 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--text3)', padding: '14px 0 4px' }}>No active jobs.</div>
            )}
            {jobs.map((j, i) => (
              <div key={i} style={i < jobs.length - 1 ? s.row : s.rowLast}>
                <div style={s.dot(j.color)} />
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>{j.name}</div>
                    <span style={s.badge('var(--bg3)', 'var(--text2)')}>{STATUS_LABELS[j.status] || j.status}</span>
                  </div>
                  <div style={{ fontSize:10.5, color:'var(--text3)', marginTop:2 }}>{j.client}{j.assigned ? ` · ${j.assigned}` : ''}</div>
                </div>
              </div>
            ))}
          </div>

          {/* TEAM */}
          <div style={s.card}>
            <div style={s.cardTitle}>Team today</div>
            {team.length === 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--text3)', padding: '14px 0 4px' }}>No team members yet.</div>
            )}
            {team.map((m, i) => (
              <div key={i} style={i < team.length - 1 ? s.teamRow : s.teamRowLast}>
                <div style={s.avatar(m.color)}>{m.initials}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>{m.name}</div>
                  <div style={{ fontSize:10.5, color:'var(--text3)' }}>{m.role} · {m.job !== '—' ? m.job : 'Available'}</div>
                </div>
                <span style={{ fontSize:10, fontWeight:700, color: m.status === 'On site' ? '#248a3d' : m.status === 'Available' ? '#0066cc' : 'var(--text3)' }}>
                  {m.status}
                </span>
              </div>
            ))}
          </div>

        </div>

        {/* MIDDLE ROW — TICKETS + MESSAGES */}
        <div style={s.grid2}>

          {/* SERVICE TICKETS */}
          <div style={s.card}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div style={s.cardTitle}>Open service tickets</div>
              <button onClick={() => navigate('/tickets')} style={{ fontSize:10.5, fontWeight:600, color:'var(--accent)', background:'none', border:'none', cursor:'pointer', fontFamily:'var(--font)' }}>View all</button>
            </div>
            {tickets.length === 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--text3)', padding: '6px 0' }}>No open tickets.</div>
            )}
            {tickets.map((t, i) => (
              <div key={i} style={i < tickets.length - 1 ? s.row : s.rowLast}>
                <div style={s.dot(t.urgent ? '#ff3b30' : '#ff9500')} />
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>{t.client}</div>
                    {t.urgent && <span style={s.badge('rgba(255,59,48,0.08)', '#d70015')}>Urgent</span>}
                  </div>
                  <div style={{ fontSize:10.5, color:'var(--text2)', marginTop:2 }}>{t.issue}</div>
                  <div style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>{t.age}</div>
                </div>
              </div>
            ))}
          </div>

          {/* CLIENT MESSAGES */}
          <div style={s.card}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div style={s.cardTitle}>Client messages</div>
              <button onClick={() => navigate('/clients')} style={{ fontSize:10.5, fontWeight:600, color:'var(--accent)', background:'none', border:'none', cursor:'pointer', fontFamily:'var(--font)' }}>View all</button>
            </div>
            {messages.length === 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--text3)', padding: '6px 0' }}>No new messages.</div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={i < messages.length - 1 ? s.row : s.rowLast}>
                <div style={s.dot('#534AB7')} />
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>{m.client}</div>
                    <div style={{ fontSize:10, color:'var(--text3)' }}>{m.time}</div>
                  </div>
                  <div style={{ fontSize:10.5, color:'var(--text2)', marginTop:2 }}>{m.msg}</div>
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* ACTIVITY */}
        <div style={s.card}>
          <div style={s.cardTitle}>Recent activity</div>
          {activity.length === 0 && (
            <div style={{ fontSize: 11.5, color: 'var(--text3)', padding: '6px 0' }}>No activity yet.</div>
          )}
          {activity.map((a, i) => (
            <div key={i} style={i < activity.length - 1 ? s.row : s.rowLast}>
              <div style={s.dot(a.color)} />
              <div>
                <div style={s.label}>{a.text}</div>
                <div style={s.sub}>{a.time}</div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
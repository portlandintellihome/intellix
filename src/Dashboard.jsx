import { useNavigate } from 'react-router-dom'

const quickActions = [
  { label: 'New job', path: '/jobs', color: '#1d1d1f' },
  { label: 'New build doc', path: '/composer', color: '#0066cc' },
  { label: 'New support ticket', path: '/tickets', color: '#ff9500' },
  { label: 'New proposal', path: '/jobs', color: '#534AB7' },
]

const stats = [
  { label: 'Active jobs', value: '3', sub: '2 on site today', color: '#0066cc' },
  { label: 'Open tickets', value: '5', sub: '2 urgent', color: '#ff3b30' },
  { label: 'Build docs', value: '8', sub: 'this month', color: '#34c759' },
  { label: 'Team available', value: '2', sub: 'of 4 members', color: '#ff9500' },
]

const jobs = [
  { name: 'Lakeside Residence', client: 'Johnson Family', phase: 'Installation', assigned: 'JD / MR', status: 'On site', color: '#34c759' },
  { name: 'Downtown Penthouse', client: 'Rivera LLC', phase: 'Programming', assigned: 'SW', status: 'In progress', color: '#0066cc' },
  { name: 'Hillcrest Estate', client: 'Chen Family', phase: 'Sign-off', assigned: 'JD', status: 'Review', color: '#ff9500' },
]

const tickets = [
  { client: 'Park Realty', issue: 'Living room TV not responding', age: '2h ago', urgent: true },
  { client: 'Apex Corp', issue: 'Thermostat offline after update', age: '1d ago', urgent: true },
  { client: 'Johnson Family', issue: 'Add guest network access', age: '3d ago', urgent: false },
]

const messages = [
  { client: 'Rivera LLC', msg: 'Can we add a scene for the patio?', time: '20m ago' },
  { client: 'Chen Family', msg: 'What time will the team arrive tomorrow?', time: '1h ago' },
  { client: 'Park Realty', msg: 'Invoice received, payment processing', time: '3h ago' },
]

const activity = [
  { text: 'Lakeside Residence build doc generated — 8 rooms, 24 devices', time: '9:41am · JD', color: '#34c759' },
  { text: 'Downtown Penthouse programming started in Composer Pro', time: '8:15am · SW', color: '#0066cc' },
  { text: 'New service ticket — Park Realty TV issue', time: '7:30am', color: '#ff3b30' },
  { text: 'Hillcrest Estate pushed to Director successfully', time: 'Yesterday · JD', color: '#34c759' },
  { text: 'New proposal sent — Northgate Office', time: 'Yesterday · MR', color: '#534AB7' },
]

const team = [
  { initials: 'JD', name: 'John D.', role: 'Installer', status: 'On site', job: 'Lakeside', color: '#34c759' },
  { initials: 'SW', name: 'Sam W.', role: 'Programmer', status: 'Remote', job: 'Penthouse', color: '#0066cc' },
  { initials: 'MR', name: 'Mike R.', role: 'Installer', status: 'Available', job: '—', color: '#ff9500' },
  { initials: 'AL', name: 'Amy L.', role: 'Admin', status: 'Office', job: '—', color: '#534AB7' },
]

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

export default function Dashboard({ setupDone }) {
  const navigate = useNavigate()
  const showBanner = !setupDone

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>

      {/* TOPBAR */}
      <div style={s.topbar}>
        <div style={s.title}>Dashboard</div>
        <div style={{ fontSize:11, color:'var(--text3)', fontWeight:500 }}>
          {new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}
        </div>
      </div>

      {/* SETUP BANNER */}
      {showBanner && (
        <div style={{ margin:'14px 24px 0', borderRadius:11, border:'1px solid rgba(0,102,204,0.2)', background:'rgba(0,102,204,0.06)', padding:'12px 14px', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
          <div style={{ width:32, height:32, minWidth:32, borderRadius:8, background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text)', marginBottom:2 }}>Finish setting up Intellix</div>
            <div style={{ fontSize:10.5, color:'var(--text2)' }}>Complete the setup checklist to get your team live.</div>
          </div>
          <button onClick={() => navigate('/settings')} style={{ padding:'7px 12px', borderRadius:7, fontSize:11, fontWeight:700, cursor:'pointer', border:'none', background:'#1d1d1f', color:'#fff', fontFamily:'var(--font)', whiteSpace:'nowrap' }}>
            Complete setup ↗
          </button>
        </div>
      )}

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
            {jobs.map((j, i) => (
              <div key={i} style={i < jobs.length - 1 ? s.row : s.rowLast}>
                <div style={s.dot(j.color)} />
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>{j.name}</div>
                    <span style={s.badge('var(--bg3)', 'var(--text2)')}>{j.status}</span>
                  </div>
                  <div style={{ fontSize:10.5, color:'var(--text3)', marginTop:2 }}>{j.client} · {j.phase} · {j.assigned}</div>
                </div>
              </div>
            ))}
          </div>

          {/* TEAM */}
          <div style={s.card}>
            <div style={s.cardTitle}>Team today</div>
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
              <button onClick={() => navigate('/service')} style={{ fontSize:10.5, fontWeight:600, color:'var(--accent)', background:'none', border:'none', cursor:'pointer', fontFamily:'var(--font)' }}>View all</button>
            </div>
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
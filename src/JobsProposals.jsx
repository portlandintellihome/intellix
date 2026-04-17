import { useState, useEffect } from 'react'
import { apiGet } from './lib/api'
import { colorForInitials } from './lib/color'



const statusStyle = {
  Draft: { bg: 'rgba(174,174,178,0.12)', color: '#6e6e73' },
  Sent: { bg: 'rgba(0,102,204,0.08)', color: '#0066cc' },
  Accepted: { bg: 'rgba(52,199,89,0.09)', color: '#248a3d' },
  Declined: { bg: 'rgba(255,59,48,0.08)', color: '#d70015' },
  'On site': { bg: 'rgba(52,199,89,0.09)', color: '#248a3d' },
  'In progress': { bg: 'rgba(0,102,204,0.08)', color: '#0066cc' },
  Review: { bg: 'rgba(255,149,0,0.09)', color: '#c93400' },
  Scheduled: { bg: 'rgba(83,74,183,0.09)', color: '#534AB7' },
}

function Badge({ text }) {
  const st = statusStyle[text] || { bg: 'var(--bg4)', color: 'var(--text2)' }
  return (
    <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 5, fontSize: 10.5, fontWeight: 700, background: st.bg, color: st.color }}>
      {text}
    </span>
  )
}

function Avatar({ initials, size = 26 }) {
  const color = colorForInitials(initials)
  return (
    <div style={{ width: size, height: size, minWidth: size, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 700, color: '#fff' }}>
      {initials}
    </div>
  )
}

function JobModal({ onClose, team }) {
  const [form, setForm] = useState({ name: '', client: '', address: '', scope: '', assigned: [], priority: 'Normal', start: '', notes: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleAssign = (initials) => {
    setForm(f => ({ ...f, assigned: f.assigned.includes(initials) ? f.assigned.filter(a => a !== initials) : [...f.assigned, initials] }))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 14, width: 520, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px', borderBottom: '1px solid var(--border2)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>New job</div>
          <button onClick={onClose} style={{ background: 'var(--bg4)', border: 'none', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', color: 'var(--text2)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ padding: '18px 22px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={lbl}>Job name</div>
              <input style={inp} placeholder="Job name" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div>
              <div style={lbl}>Client</div>
              <input style={inp} placeholder="Client name" value={form.client} onChange={e => set('client', e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={lbl}>Site address</div>
            <input style={inp} placeholder="Street address" value={form.address} onChange={e => set('address', e.target.value)} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={lbl}>Scope of work</div>
            <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} placeholder="Brief description of the job..." value={form.scope} onChange={e => set('scope', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={lbl}>Start date</div>
              <input style={inp} type="date" value={form.start} onChange={e => set('start', e.target.value)} />
            </div>
            <div>
              <div style={lbl}>Priority</div>
              <select style={inp} value={form.priority} onChange={e => set('priority', e.target.value)}>
                <option>Normal</option>
                <option>High</option>
                <option>Urgent</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={lbl}>Assign team</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              {team.length === 0 && (
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>No team members yet — invite some from the Team page.</span>
              )}
              {team.map(m => {
                const color = colorForInitials(m.initials)
                const selected = form.assigned.includes(m.initials)
                return (
                  <div key={m.id} onClick={() => toggleAssign(m.initials)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 7, border: `1px solid ${selected ? color : 'var(--border)'}`, background: selected ? `${color}18` : 'transparent', cursor: 'pointer' }}>
                    <Avatar initials={m.initials} size={20} />
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)' }}>{m.initials}</span>
                  </div>
                )
              })}
            </div>
          </div>
          <div>
            <div style={lbl}>Notes</div>
            <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} placeholder="Any additional notes..." value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border2)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={ghostBtn}>Cancel</button>
          <button style={primaryBtn}>Create job</button>
        </div>
      </div>
    </div>
  )
}

const lbl = { fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5 }
const inp = { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 11px', fontSize: 12.5, color: 'var(--text)', fontFamily: 'var(--font)', outline: 'none' }
const primaryBtn = { padding: '8px 18px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#1d1d1f', color: '#fff', fontFamily: 'var(--font)' }
const ghostBtn = { padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontFamily: 'var(--font)' }
const portalBtn = { padding: '7px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--accent)', fontFamily: 'var(--font)', display: 'inline-flex', alignItems: 'center', gap: 5 }

export default function JobsProposals() {
  const [jobs, setJobs] = useState([])
  const [proposals, setProposals] = useState([])
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('proposals')
  const [showJob, setShowJob] = useState(false)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    Promise.all([
      apiGet('/api/jobs').catch(() => []),
      apiGet('/api/proposals').catch(() => []),
      apiGet('/api/team').catch(() => []),
    ]).then(([jobRows, propRows, teamRows]) => {
      setJobs(jobRows.map(j => ({
        ...j,
        assigned: j.assigned || [],
        start: j.start || j.start_date || '',
        client: j.client_name || '',
      })))
      setProposals(propRows.map(p => ({
        ...p,
        client: p.client_name || '',
        portalId: p.portal_id || '',
        labor: Number(p.labor) || 0,
        materials: Number(p.materials) || 0,
        total: Number(p.total) || 0,
        assigned: p.assigned || '',
        created: p.created_at ? new Date(p.created_at).toLocaleDateString() : '',
      })))
      setTeam(teamRows)
    }).finally(() => setLoading(false))
  }, [])

  const PROPOSALS = proposals

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '13px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Jobs & proposals</div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13, fontWeight: 500 }}>Loading…</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {showJob && <JobModal onClose={() => setShowJob(false)} team={team} />}

      {/* TOPBAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Jobs & proposals</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <a href="https://portal.io" target="_blank" rel="noreferrer" style={{ ...portalBtn, textDecoration: 'none' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M7 1h4v4M11 1L5.5 6.5M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Open Portal.io
          </a>
          <button onClick={() => setShowJob(true)} style={{ ...primaryBtn, fontSize: 12 }}>+ New job</button>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', padding: '0 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
      {[
  { key: 'proposals', label: `Proposals (${PROPOSALS.length})` },
  { key: 'pending', label: `Pending (${jobs.filter(j => j.status === 'Scheduled').length})` },
  { key: 'jobs', label: `Active jobs (${jobs.filter(j => j.status !== 'Scheduled').length})` },
].map(t => (
  <button key={t.key} onClick={() => { setTab(t.key); setSelected(null) }} style={{ padding: '10px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'transparent', color: tab === t.key ? 'var(--accent)' : 'var(--text2)', borderBottom: `2px solid ${tab === t.key ? 'var(--accent)' : 'transparent'}`, fontFamily: 'var(--font)', transition: 'all 0.12s' }}>
    {t.label}
  </button>
))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
{tab === 'pending' && (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    {jobs.filter(j => j.status === 'Scheduled').length === 0 && (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)', fontSize: 13 }}>No pending jobs</div>
    )}
    {jobs.filter(j => j.status === 'Scheduled').map(job => (
      <div key={job.id} onClick={() => setSelected(selected?.id === job.id ? null : job)} style={{ background: 'var(--bg2)', border: `1px solid ${selected?.id === job.id ? 'var(--accent)' : 'var(--border2)'}`, borderRadius: 11, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.12s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{job.name}</div>
              <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(83,74,183,0.09)', color: '#534AB7' }}>Scheduled</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{job.client} · {job.address} · Starts {job.start}</div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {job.assigned.map(a => <Avatar key={a} initials={a} size={26} />)}
          </div>
        </div>
        {selected?.id === job.id && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border2)' }}>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 10 }}><strong style={{ color: 'var(--text)' }}>Scope:</strong> {job.scope}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...primaryBtn, fontSize: 11 }}>Start job</button>
              <button style={{ ...ghostBtn, fontSize: 11 }}>Edit</button>
              <button style={{ ...ghostBtn, fontSize: 11 }}>View proposal</button>
            </div>
          </div>
        )}
      </div>
    ))}
  </div>
)}
        {/* JOBS TAB */}
        {tab === 'jobs' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 20 }}>
              {['Scheduling', 'Installation', 'Programming', 'Sign-off', 'Complete'].map(phase => {
                const count = jobs.filter(j => j.phase === phase && j.status !== 'Scheduled').length
                return (
                  <div key={phase} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>{phase}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: count > 0 ? 'var(--accent)' : 'var(--text3)' }}>{count}</div>
                  </div>
                )
              })}
            </div>
            {jobs.length === 0 && (
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '40px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>No jobs yet</div>
                <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 14 }}>Create your first job to start tracking work.</div>
                <button onClick={() => setShowJob(true)} style={{ ...primaryBtn, fontSize: 12 }}>+ New job</button>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {jobs.map(job => (
                <div key={job.id} onClick={() => setSelected(selected?.id === job.id ? null : job)} style={{ background: 'var(--bg2)', border: `1px solid ${selected?.id === job.id ? 'var(--accent)' : 'var(--border2)'}`, borderRadius: 11, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.12s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{job.name}</div>
                        <Badge text={job.status} />
                        {job.priority === 'High' && <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,59,48,0.08)', color: '#d70015' }}>High priority</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{job.client} · {job.address} · Started {job.start}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text2)', background: 'var(--bg3)', padding: '3px 9px', borderRadius: 5, border: '1px solid var(--border2)' }}>{job.phase}</div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {job.assigned.map(a => <Avatar key={a} initials={a} size={26} />)}
                      </div>
                    </div>
                  </div>
                  {selected?.id === job.id && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border2)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 10 }}><strong style={{ color: 'var(--text)' }}>Scope:</strong> {job.scope}</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button style={{ ...primaryBtn, fontSize: 11 }}>Open job</button>
                        <button style={{ ...ghostBtn, fontSize: 11 }}>View build doc</button>
                        <button style={{ ...ghostBtn, fontSize: 11 }}>Edit</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PROPOSALS TAB */}
        {tab === 'proposals' && (
          <div>

            {/* PORTAL SYNC NOTICE */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,102,204,0.06)', border: '1px solid rgba(0,102,204,0.18)', borderRadius: 10, padding: '11px 14px', marginBottom: 16 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34c759', boxShadow: '0 0 6px #34c759' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Synced from Portal.io</div>
                <div style={{ fontSize: 10.5, color: 'var(--text2)' }}>Proposals sync automatically when status changes in Portal. Last synced 4 minutes ago.</div>
              </div>
              <a href="https://portal.io" target="_blank" rel="noreferrer" style={{ ...portalBtn, textDecoration: 'none' }}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M7 1h4v4M11 1L5.5 6.5M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Open Portal.io
              </a>
            </div>

            {/* SUMMARY STATS */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
              {[
                { label: 'Total', value: PROPOSALS.length, color: 'var(--text)' },
                { label: 'Draft', value: PROPOSALS.filter(p => p.status === 'Draft').length, color: '#6e6e73' },
                { label: 'Sent', value: PROPOSALS.filter(p => p.status === 'Sent').length, color: '#0066cc' },
                { label: 'Accepted', value: PROPOSALS.filter(p => p.status === 'Accepted').length, color: '#248a3d' },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* PROPOSAL LIST */}
            {PROPOSALS.length === 0 && (
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '40px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>No proposals yet</div>
                <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 14 }}>Proposals will appear here once they sync from Portal.io.</div>
                <a href="https://portal.io" target="_blank" rel="noreferrer" style={{ ...primaryBtn, fontSize: 12, display: 'inline-block', textDecoration: 'none' }}>Open Portal.io</a>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {PROPOSALS.map(p => (
                <div key={p.id} onClick={() => setSelected(selected?.id === p.id ? null : p)} style={{ background: 'var(--bg2)', border: `1px solid ${selected?.id === p.id ? 'var(--accent)' : 'var(--border2)'}`, borderRadius: 11, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.12s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{p.client}</div>
                        <Badge text={p.status} />
                        <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 500 }}>{p.portalId}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.address} · Created {p.created}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>${p.total.toLocaleString()}</div>
                        <div style={{ fontSize: 10, color: 'var(--text3)' }}>{p.rooms} rooms</div>
                      </div>
                      <Avatar initials={p.assigned} size={26} />
                    </div>
                  </div>

                  {selected?.id === p.id && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border2)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', marginBottom: 3 }}>SCOPE</div>
                          <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>{p.scope}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', marginBottom: 3 }}>DEVICES</div>
                          <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>{p.devices}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                        {[{ l: 'Labor', v: p.labor }, { l: 'Materials', v: p.materials }, { l: 'Total', v: p.total }].map(f => (
                          <div key={f.l} style={{ flex: 1, background: 'var(--bg3)', borderRadius: 8, padding: '8px 10px', border: '1px solid var(--border2)' }}>
                            <div style={{ fontSize: 9.5, color: 'var(--text3)', fontWeight: 600, marginBottom: 2 }}>{f.l}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>${f.v.toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {p.status === 'Accepted' && (
                          <button style={{ ...primaryBtn, fontSize: 11, background: '#0066cc' }}>
                            Convert to job →
                          </button>
                        )}
                        <a href="https://portal.io" target="_blank" rel="noreferrer" style={{ ...portalBtn, textDecoration: 'none' }}>
                          <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M7 1h4v4M11 1L5.5 6.5M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          View in Portal.io
                        </a>
                        <button style={{ ...ghostBtn, fontSize: 11 }}>Duplicate as job</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
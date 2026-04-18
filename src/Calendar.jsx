import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from './lib/api'
import { colorForInitials } from './lib/color'
import { useIsMobile } from './lib/useIsMobile'

const PALETTE = ['#0066cc', '#34c759', '#534AB7', '#ff9500', '#ff3b30']

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const HOURS = Array.from({length: 11}, (_,i) => i + 7)

function getDaysInMonth(month, year) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(month, year) {
  return new Date(year, month, 1).getDay()
}

function jobOnDay(job, day, month) {
  const startBefore = job.start.month < month || (job.start.month === month && job.start.day <= day)
  const endAfter = job.end.month > month || (job.end.month === month && job.end.day >= day)
  return startBefore && endAfter
}

function Avatar({ initials, size = 20 }) {
  return (
    <div style={{ width: size, height: size, minWidth: size, borderRadius: '50%', background: colorForInitials(initials), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 700, color: '#fff' }}>
      {initials}
    </div>
  )
}

function NewJobModal({ onClose, selectedDate, team }) {
  const [form, setForm] = useState({ name: '', client: '', start: selectedDate || '', end: '', assigned: [], notes: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleAssign = (i) => setForm(f => ({ ...f, assigned: f.assigned.includes(i) ? f.assigned.filter(a => a !== i) : [...f.assigned, i] }))
  const inp = { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 11px', fontSize: 12.5, color: 'var(--text)', fontFamily: 'var(--font)', outline: 'none' }
  const lbl = { fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5 }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 14, width: 480, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px', borderBottom: '1px solid var(--border2)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Schedule job</div>
          <button onClick={onClose} style={{ background: 'var(--bg4)', border: 'none', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', color: 'var(--text2)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ padding: '18px 22px' }}>
          <div style={{ marginBottom: 12 }}>
            <div style={lbl}>Job name</div>
            <input style={inp} placeholder="Job name" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={lbl}>Client</div>
            <input style={inp} placeholder="Client name" value={form.client} onChange={e => set('client', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={lbl}>Start date</div>
              <input style={inp} type="date" value={form.start} onChange={e => set('start', e.target.value)} />
            </div>
            <div>
              <div style={lbl}>End date</div>
              <input style={inp} type="date" value={form.end} onChange={e => set('end', e.target.value)} />
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
            <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} placeholder="Any scheduling notes..." value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border2)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontFamily: 'var(--font)' }}>Cancel</button>
          <button style={{ padding: '8px 18px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#1d1d1f', color: '#fff', fontFamily: 'var(--font)' }}>Schedule job</button>
        </div>
      </div>
    </div>
  )
}

export default function CalendarPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const today = new Date()
  const [view, setView] = useState('month')
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentWeek, setCurrentWeek] = useState(0)
  const [showNew, setShowNew] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedJob, setSelectedJob] = useState(null)
  const [jobs, setJobs] = useState([])
  const [team, setTeam] = useState([])

  useEffect(() => {
    Promise.all([
      apiGet('/api/jobs').catch(() => []),
      apiGet('/api/team').catch(() => []),
    ]).then(([jobRows, teamRows]) => {
      setJobs(jobRows.map(j => {
        const s = j.start_date ? new Date(j.start_date) : null
        const e = j.end_date ? new Date(j.end_date) : null
        const assigned = Array.isArray(j.assigned) ? j.assigned : []
        return {
          ...j,
          start: s ? { month: s.getMonth(), day: s.getDate() } : null,
          end: e ? { month: e.getMonth(), day: e.getDate() } : null,
          client: j.client_name || '',
          assigned,
          color: colorForInitials(assigned[0]) || PALETTE[0],
          portalId: j.portal_id || '',
          clientId: j.client_id,
        }
      }).filter(j => j.start && j.end))
      setTeam(teamRows)
    })
  }, [])

  const JOBS = jobs

  const daysInMonth = getDaysInMonth(currentMonth, currentYear)
  const firstDay = getFirstDayOfMonth(currentMonth, currentYear)
  const monthIndex = currentMonth % 12

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) }
    else setCurrentMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) }
    else setCurrentMonth(m => m + 1)
  }

  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay() + currentWeek * 7)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  const calendarDays = []
  for (let i = 0; i < firstDay; i++) calendarDays.push(null)
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {showNew && <NewJobModal onClose={() => setShowNew(false)} selectedDate={selectedDate} team={team} />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '10px 14px' : '13px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', flexShrink: 0 }}>Calendar</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 8, minWidth: 0 }}>
            <button aria-label="Previous" onClick={view === 'month' ? prevMonth : () => setCurrentWeek(w => w - 1)} style={{ width: isMobile ? 36 : 28, height: isMobile ? 36 : 28, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>‹</button>
            <div style={{ fontSize: isMobile ? 13 : 13, fontWeight: 700, color: 'var(--text)', minWidth: isMobile ? 0 : 160, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {view === 'month'
                ? `${MONTHS[monthIndex]} ${currentYear}`
                : `${weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
              }
            </div>
            <button aria-label="Next" onClick={view === 'month' ? nextMonth : () => setCurrentWeek(w => w + 1)} style={{ width: isMobile ? 36 : 28, height: isMobile ? 36 : 28, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>›</button>
            {!isMobile && (
              <button onClick={() => { setCurrentMonth(today.getMonth()); setCurrentYear(today.getFullYear()); setCurrentWeek(0) }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text2)', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font)' }}>Today</button>
            )}
          </div>
        </div>
        {!isMobile && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
              {['month', 'week'].map(v => (
                <button key={v} onClick={() => setView(v)} style={{ padding: '6px 14px', border: 'none', background: view === v ? 'var(--bg2)' : 'transparent', color: view === v ? 'var(--text)' : 'var(--text2)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', textTransform: 'capitalize' }}>{v}</button>
              ))}
            </div>
            <button onClick={() => setShowNew(true)} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#1d1d1f', color: '#fff', fontFamily: 'var(--font)' }}>+ Schedule job</button>
          </div>
        )}
      </div>

      {isMobile && (
        <div style={{ display: 'flex', gap: 8, padding: '8px 14px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0, alignItems: 'center' }}>
          <button onClick={() => { setCurrentMonth(today.getMonth()); setCurrentYear(today.getFullYear()); setCurrentWeek(0) }} style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text2)', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font)' }}>Today</button>
          <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 7, border: '1px solid var(--border)', overflow: 'hidden' }}>
            {['month', 'week'].map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding: '7px 12px', border: 'none', background: view === v ? 'var(--bg2)' : 'transparent', color: view === v ? 'var(--text)' : 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', textTransform: 'capitalize' }}>{v}</button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={() => setShowNew(true)} style={{ padding: '8px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#1d1d1f', color: '#fff', fontFamily: 'var(--font)' }}>+ Schedule</button>
        </div>
      )}

      {view === 'month' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginTop: 16 }}>
            {DAYS.map(d => (
              <div key={d} style={{ padding: '6px 10px', fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', textAlign: 'center', borderBottom: '1px solid var(--border2)' }}>{d}</div>
            ))}
            {calendarDays.map((day, i) => {
              const isToday = day === today.getDate() && monthIndex === today.getMonth() && currentYear === today.getFullYear()
              const dayJobs = day ? JOBS.filter(j => jobOnDay(j, day, monthIndex)) : []
              return (
                <div key={i} onClick={() => { if (day) { setSelectedDate(`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`); setShowNew(true) } }} style={{ minHeight: 90, padding: '6px 8px', border: '1px solid var(--border2)', borderTop: 'none', borderLeft: i % 7 === 0 ? '1px solid var(--border2)' : 'none', background: day ? 'var(--bg2)' : 'var(--bg3)', cursor: day ? 'pointer' : 'default' }}>
                  {day && (
                    <>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: isToday ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: isToday ? 700 : 500, color: isToday ? '#fff' : 'var(--text2)', marginBottom: 4 }}>{day}</div>
                      {dayJobs.slice(0, 2).map(job => (
                        <div key={job.id} onClick={e => { e.stopPropagation(); setSelectedJob(job) }} style={{ background: `${job.color}18`, border: `1px solid ${job.color}40`, borderRadius: 4, padding: '2px 6px', marginBottom: 2, fontSize: 10, fontWeight: 600, color: job.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}>
                          {job.name}
                        </div>
                      ))}
                      {dayJobs.length > 2 && <div style={{ fontSize: 9.5, color: 'var(--text3)', fontWeight: 600 }}>+{dayJobs.length - 2} more</div>}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {view === 'week' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', marginTop: 16, border: '1px solid var(--border2)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ background: 'var(--bg3)', borderRight: '1px solid var(--border2)' }} />
            {weekDays.map((d, i) => {
              const isToday = d.toDateString() === today.toDateString()
              return (
                <div key={i} style={{ padding: '8px 4px', textAlign: 'center', background: 'var(--bg3)', borderRight: i < 6 ? '1px solid var(--border2)' : 'none', borderBottom: '1px solid var(--border2)' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{DAYS[d.getDay()]}</div>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: isToday ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: isToday ? '#fff' : 'var(--text)', margin: '4px auto 0' }}>{d.getDate()}</div>
                </div>
              )
            })}
            {HOURS.map(hour => (
              <div key={hour} style={{ display: 'contents' }}>
                <div style={{ padding: '0 8px', height: 56, display: 'flex', alignItems: 'flex-start', paddingTop: 6, borderRight: '1px solid var(--border2)', borderBottom: '1px solid var(--border2)', background: 'var(--bg2)' }}>
                  <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 500 }}>{hour > 12 ? `${hour - 12}pm` : hour === 12 ? '12pm' : `${hour}am`}</span>
                </div>
                {weekDays.map((d, di) => {
                  const dayJobs = JOBS.filter(j => {
                    const jStart = new Date(2026, j.start.month, j.start.day)
                    const jEnd = new Date(2026, j.end.month, j.end.day)
                    return d >= jStart && d <= jEnd
                  })
                  return (
                    <div key={`${hour}-${di}`} style={{ height: 56, borderRight: di < 6 ? '1px solid var(--border2)' : 'none', borderBottom: '1px solid var(--border2)', background: 'var(--bg2)', padding: '2px 3px' }}>
                      {hour === 8 && dayJobs.map(job => (
                        <div key={job.id} onClick={() => setSelectedJob(job)} style={{ background: `${job.color}18`, border: `1px solid ${job.color}40`, borderRadius: 4, padding: '3px 6px', fontSize: 9.5, fontWeight: 600, color: job.color, cursor: 'pointer', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {job.name}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setSelectedJob(null)}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '18px 20px', width: 340, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: selectedJob.color }} />
                <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text3)' }}>{selectedJob.status.toUpperCase()}</span>
              </div>
              <button onClick={() => setSelectedJob(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 16 }}>✕</button>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{selectedJob.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '7px 10px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8 }}>
              <span style={{ fontSize: 11.5, color: 'var(--text2)', fontWeight: 500, flex: 1 }}>{selectedJob.client}</span>
              <button
                onClick={() => { setSelectedJob(null); navigate('/clients', { state: { openClientId: selectedJob.clientId } }) }}
                style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}
              >
                View client ↗
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, padding: '7px 10px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8 }}>
              <span style={{ fontSize: 11.5, color: 'var(--text2)', fontWeight: 500, flex: 1 }}>Portal <strong style={{ color: 'var(--text)' }}>{selectedJob.portalId}</strong></span>
              <a href="https://portal.io" target="_blank" rel="noreferrer" style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--accent)', textDecoration: 'none' }}>Open ↗</a>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div style={{ background: 'var(--bg3)', borderRadius: 7, padding: '8px 10px' }}>
                <div style={{ fontSize: 9.5, color: 'var(--text3)', fontWeight: 600, marginBottom: 2 }}>START</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Apr {selectedJob.start.day}</div>
              </div>
              <div style={{ background: 'var(--bg3)', borderRadius: 7, padding: '8px 10px' }}>
                <div style={{ fontSize: 9.5, color: 'var(--text3)', fontWeight: 600, marginBottom: 2 }}>END</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Apr {selectedJob.end.day}</div>
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 9.5, color: 'var(--text3)', fontWeight: 600, marginBottom: 6 }}>ASSIGNED TEAM</div>
              <div style={{ display: 'flex', gap: 5 }}>
                {selectedJob.assigned.map(a => <Avatar key={a} initials={a} size={26} />)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 7 }}>
              <button style={{ flex: 1, padding: '7px', borderRadius: 7, border: 'none', background: '#1d1d1f', color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>Open job</button>
              <button style={{ flex: 1, padding: '7px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>Edit</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: '10px 24px', borderTop: '1px solid var(--border2)', background: 'var(--bg2)', display: 'flex', gap: 16, flexWrap: 'wrap', flexShrink: 0 }}>
        {JOBS.length === 0 && (
          <span style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 500 }}>No jobs scheduled — schedule one to see it here.</span>
        )}
        {JOBS.map(job => (
          <div key={job.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: job.color }} />
            <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--text2)' }}>{job.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
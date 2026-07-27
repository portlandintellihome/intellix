import { useState, useEffect } from 'react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { apiGet } from './lib/api'
import { colorForInitials } from './lib/color'

const RANGES = [
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: 'ytd', label: 'This year' },
  { id: 'all', label: 'All time' },
]

const PRIORITY_COLOR = {
  Urgent: '#ff3b30',
  High:   '#ff9500',
  Normal: '#0066cc',
  Low:    '#34c759',
}
const STATUS_COLOR = '#0066cc'
const REVENUE_COLOR = '#34c759'

const s = {
  topbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0, gap: 12, flexWrap: 'wrap' },
  title: { fontSize: 14, fontWeight: 700, color: 'var(--text)' },
  content: { flex: 1, overflowY: 'auto', padding: '16px 24px 32px' },
  card: { background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '16px 18px' },
  cardTitle: { fontSize: 11, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 14 },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 },
  twoCol: { display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12, marginBottom: 12 },
  threeCol: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 },
  empty: { color: 'var(--text3)', fontSize: 12, padding: '20px 0', textAlign: 'center' },
}

function rangeBtn(active) {
  return {
    padding: '6px 12px', borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
    border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
    background: active ? 'rgba(0,102,204,0.08)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text2)',
    fontFamily: 'var(--font)',
  }
}

function fmtMoney(n) {
  const v = Number(n) || 0
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(1)}k`
  return `$${v.toFixed(0)}`
}
function fmtNumber(n) {
  return new Intl.NumberFormat('en-US').format(Number(n) || 0)
}
function fmtMonth(ym) {
  if (!ym) return ''
  const [y, m] = ym.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

function KpiCard({ label, value, sub, color }) {
  return (
    <div style={s.card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
        <span style={{ fontSize: 10.5, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function TooltipBox({ active, payload, label, formatter }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 11px', fontSize: 11.5, color: 'var(--text)', boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color || p.fill }} />
          <span style={{ color: 'var(--text2)' }}>{p.name || p.dataKey}:</span>
          <span style={{ fontWeight: 600 }}>{formatter ? formatter(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function Reporting() {
  const [range, setRange] = useState('30d')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    apiGet(`/api/reporting?range=${range}`)
      .then(setData)
      .catch(err => {
        console.error('Reporting fetch failed', err)
        setError(err.message || 'Failed to load reporting')
      })
      .finally(() => setLoading(false))
  }, [range])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      <div style={s.topbar}>
        <div style={s.title}>Reporting</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {RANGES.map(r => (
            <button key={r.id} onClick={() => setRange(r.id)} style={rangeBtn(range === r.id)}>{r.label}</button>
          ))}
        </div>
      </div>

      <div style={s.content}>
        {error && (
          <div style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.25)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#d70015' }}>
            {error}
          </div>
        )}

        {loading || !data ? (
          <div style={{ ...s.empty, padding: '60px 0' }}>Loading reporting…</div>
        ) : (
          <>

            {/* KPI ROW (always month-to-date / point-in-time) */}
            <div style={s.kpiGrid}>
              <KpiCard label="Revenue MTD"    value={fmtMoney(data.kpi.revenue_mtd)}      sub="from accepted proposals" color="#34c759" />
              <KpiCard label="Active jobs"    value={fmtNumber(data.kpi.active_jobs)}     sub="status ≠ Complete"        color="#0066cc" />
              <KpiCard label="Open tickets"   value={fmtNumber(data.kpi.open_tickets)}    sub="status ≠ Resolved"        color="#ff3b30" />
              <KpiCard label="New clients MTD" value={fmtNumber(data.kpi.new_clients_mtd)} sub="this calendar month"      color="#ff9500" />
            </div>

            {/* Revenue trend (always last 6 months) */}
            <div style={{ ...s.card, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={s.cardTitle}>Revenue trend</div>
                <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>Last 6 months · accepted proposals</div>
              </div>
              {data.revenue.by_month.length === 0 ? (
                <div style={s.empty}>No accepted proposals in the last 6 months yet.</div>
              ) : (
                <div style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.revenue.by_month.map(r => ({ month: fmtMonth(r.month), total: r.total }))} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="var(--border2)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" stroke="var(--text3)" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--text3)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={fmtMoney} width={50} />
                      <Tooltip content={<TooltipBox formatter={fmtMoney} />} />
                      <Line type="monotone" dataKey="total" name="Revenue" stroke={REVENUE_COLOR} strokeWidth={2.5} dot={{ r: 3, fill: REVENUE_COLOR }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Two-up: Jobs by status + Ticket priority */}
            <div style={s.twoCol}>
              <div style={s.card}>
                <div style={s.cardTitle}>Jobs by status</div>
                {data.jobs.by_status.length === 0 ? (
                  <div style={s.empty}>No jobs in this range.</div>
                ) : (
                  <div style={{ height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.jobs.by_status} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="var(--border2)" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="status" stroke="var(--text3)" fontSize={10.5} tickLine={false} axisLine={false} />
                        <YAxis stroke="var(--text3)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                        <Tooltip content={<TooltipBox />} cursor={{ fill: 'rgba(0,102,204,0.06)' }} />
                        <Bar dataKey="count" name="Jobs" fill={STATUS_COLOR} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div style={s.card}>
                <div style={s.cardTitle}>Tickets by priority</div>
                {data.tickets.by_priority.length === 0 ? (
                  <div style={s.empty}>No tickets in this range.</div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, height: 240 }}>
                    <div style={{ flex: 1, minWidth: 0, height: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={data.tickets.by_priority}
                            dataKey="count"
                            nameKey="priority"
                            innerRadius={50}
                            outerRadius={85}
                            paddingAngle={2}
                            stroke="var(--bg2)"
                            strokeWidth={2}
                          >
                            {data.tickets.by_priority.map(d => (
                              <Cell key={d.priority} fill={PRIORITY_COLOR[d.priority] || 'var(--text3)'} />
                            ))}
                          </Pie>
                          <Tooltip content={<TooltipBox />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, paddingRight: 4 }}>
                      {data.tickets.by_priority.map(d => (
                        <div key={d.priority} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                          <span style={{ width: 9, height: 9, borderRadius: 2, background: PRIORITY_COLOR[d.priority] || 'var(--text3)' }} />
                          <span style={{ color: 'var(--text)' }}>{d.priority}</span>
                          <span style={{ color: 'var(--text3)' }}>· {d.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Three-up: Jobs summary + Tickets summary + Closed-this-month delta */}
            <div style={s.threeCol}>
              <div style={s.card}>
                <div style={s.cardTitle}>Jobs in range</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Stat label="Total" value={fmtNumber(data.jobs.total)} />
                  <Stat label="Total proposal $" value={fmtMoney(data.jobs.total_proposal_value)} />
                  <Stat label="Avg proposal $" value={fmtMoney(data.jobs.avg_proposal_value)} />
                  <Stat label="Closed this mo." value={`${data.jobs.closed_this_month} / ${data.jobs.closed_last_month} last`} small />
                </div>
              </div>

              <div style={s.card}>
                <div style={s.cardTitle}>Tickets in range</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Stat label="Open" value={fmtNumber(data.tickets.open)} color="#ff3b30" />
                  <Stat label="Closed" value={fmtNumber(data.tickets.closed)} color="#34c759" />
                  <Stat label="Avg resolution" value={data.tickets.avg_resolution_hours > 0 ? `${data.tickets.avg_resolution_hours.toFixed(1)}h` : '—'} small />
                </div>
              </div>

              <div style={s.card}>
                <div style={s.cardTitle}>Clients in range</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Stat label="Total" value={fmtNumber(data.clients.total)} />
                  <Stat label="New this mo." value={fmtNumber(data.clients.new_this_month)} color="#0066cc" />
                </div>
              </div>
            </div>

            {/* Top clients + Team performance */}
            <div style={s.twoCol}>
              <div style={s.card}>
                <div style={s.cardTitle}>Top 5 clients by proposal value</div>
                {data.clients.top_by_value.length === 0 ? (
                  <div style={s.empty}>No accepted proposals yet.</div>
                ) : (
                  <div>
                    {data.clients.top_by_value.map(c => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border2)' }}>
                        <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{fmtMoney(c.value)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={s.card}>
                <div style={s.cardTitle}>Team — jobs assigned</div>
                {data.team.jobs_per_member.length === 0 ? (
                  <div style={s.empty}>No assigned jobs in this range.</div>
                ) : (
                  <div>
                    {data.team.jobs_per_member.map(m => (
                      <div key={m.initials} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border2)' }}>
                        <div style={{ width: 26, height: 26, minWidth: 26, borderRadius: '50%', background: colorForInitials(m.initials), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 700 }}>{m.initials}</div>
                        <div style={{ flex: 1, fontSize: 12, color: 'var(--text2)' }}>{m.initials}</div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{m.count} job{m.count === 1 ? '' : 's'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {data.labor && (
              <>
                <div style={{ ...s.kpiGrid, marginTop: 16 }}>
                  <KpiCard label="On-site hours" value={`${(data.labor.total_hours || 0).toFixed(1)}h`} sub="clocked in this range" color="#0066cc" />
                  <KpiCard label="Labor cost" value={fmtMoney(data.labor.total_cost)} sub={`@ ${fmtMoney(data.labor.hourly_rate)}/hr`} color="#34c759" />
                  <KpiCard label="Open punches" value={fmtNumber(data.labor.open_punches)} sub="currently clocked in" color="#ff9500" />
                </div>

                <div style={s.twoCol}>
                  <div style={s.card}>
                    <div style={s.cardTitle}>Time on site vs estimate — by job</div>
                    {(!data.labor.by_job || data.labor.by_job.length === 0) ? (
                      <div style={s.empty}>No time logged against jobs in this range.</div>
                    ) : (
                      <div>
                        {data.labor.by_job.map(j => (
                          <div key={j.job_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border2)' }}>
                            <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.name}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--text2)', flexShrink: 0 }}>
                              {j.actual_hours.toFixed(1)}h
                              <span style={{ color: 'var(--text3)' }}> / {j.estimated_hours != null ? `${j.estimated_hours.toFixed(1)}h est` : 'no est'}</span>
                            </div>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', flexShrink: 0, width: 64, textAlign: 'right' }}>{fmtMoney(j.cost)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={s.card}>
                    <div style={s.cardTitle}>Utilization — hours per tech</div>
                    {(!data.labor.utilization_by_member || data.labor.utilization_by_member.length === 0) ? (
                      <div style={s.empty}>No time logged in this range.</div>
                    ) : (
                      <div>
                        {data.labor.utilization_by_member.map(m => (
                          <div key={m.initials || m.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border2)' }}>
                            <div style={{ width: 26, height: 26, minWidth: 26, borderRadius: '50%', background: colorForInitials(m.initials || m.name), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 700 }}>{m.initials || (m.name || '?').slice(0, 2).toUpperCase()}</div>
                            <div style={{ flex: 1, fontSize: 12, color: 'var(--text)' }}>{m.name || m.initials}</div>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{m.hours.toFixed(1)}h</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {data.team.tickets_resolved_per_member.length > 0 && (
              <div style={{ ...s.card, marginTop: 12 }}>
                <div style={s.cardTitle}>Team — tickets resolved</div>
                {data.team.tickets_resolved_per_member.map(m => (
                  <div key={m.initials || m.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border2)' }}>
                    <div style={{ width: 26, height: 26, minWidth: 26, borderRadius: '50%', background: colorForInitials(m.initials || m.name), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 700 }}>{m.initials || (m.name || '?').slice(0,2).toUpperCase()}</div>
                    <div style={{ flex: 1, fontSize: 12, color: 'var(--text)' }}>{m.name || m.initials}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{m.count}</div>
                  </div>
                ))}
              </div>
            )}

          </>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, sub, color = 'var(--text)', small = false }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: small ? 13 : 18, fontWeight: 700, color, lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

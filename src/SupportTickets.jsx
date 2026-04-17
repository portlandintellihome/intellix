import { useState } from 'react'

const TICKETS = [
  {
    id: 'TKT-001', client: 'Park Realty', contact: 'David Park', phone: '(503) 555-0155',
    issue: 'Living room TV not responding to Control4', type: 'Device', priority: 'Urgent',
    status: 'Open', created: 'Apr 16 · 7:30am', assigned: 'JD',
    job: 'Harbor View Condo', notes: 'Client says TV was working yesterday. Possibly driver issue after firmware update.',
    history: [
      { by: 'System', time: 'Apr 16 · 7:30am', note: 'Ticket created' },
      { by: 'JD', time: 'Apr 16 · 8:00am', note: 'Contacted client. Will attempt remote fix via OVRC first.' },
    ]
  },
  {
    id: 'TKT-002', client: 'Apex Corp', contact: 'Apex Admin', phone: '(503) 555-0190',
    issue: 'Thermostat showing offline after system update', type: 'Device', priority: 'Urgent',
    status: 'In progress', created: 'Apr 15 · 2:00pm', assigned: 'SW',
    job: 'Northgate Office', notes: 'Ecobee driver may need to be re-added. SW checking remotely.',
    history: [
      { by: 'System', time: 'Apr 15 · 2:00pm', note: 'Ticket created' },
      { by: 'SW', time: 'Apr 15 · 3:30pm', note: 'Identified issue — driver lost connection after OS update. Working on fix.' },
    ]
  },
  {
    id: 'TKT-003', client: 'Johnson Family', contact: 'Sarah Johnson', phone: '(503) 555-0142',
    issue: 'Add guest network access point to back patio', type: 'Change', priority: 'Normal',
    status: 'Open', created: 'Apr 14 · 10:15am', assigned: 'MR',
    job: 'Lakeside Residence', notes: 'Client wants to extend WiFi to back patio. Need to quote additional AP.',
    history: [
      { by: 'System', time: 'Apr 14 · 10:15am', note: 'Ticket created' },
    ]
  },
  {
    id: 'TKT-004', client: 'Chen Family', contact: 'Chen Family', phone: '(503) 555-0177',
    issue: 'Lutron keypad unresponsive in master bedroom', type: 'Warranty', priority: 'Normal',
    status: 'In progress', created: 'Apr 12 · 4:00pm', assigned: 'JD',
    job: 'Hillcrest Estate', notes: 'Keypad may need replacement. Under warranty — contacting Lutron.',
    history: [
      { by: 'System', time: 'Apr 12 · 4:00pm', note: 'Ticket created' },
      { by: 'JD', time: 'Apr 13 · 9:00am', note: 'Lutron warranty claim submitted. Replacement ETA 3-5 days.' },
    ]
  },
  {
    id: 'TKT-005', client: 'Rivera LLC', contact: 'Marco Rivera', phone: '(503) 555-0198',
    issue: 'Add outdoor speaker zone to patio', type: 'Change', priority: 'Normal',
    status: 'Resolved', created: 'Apr 8 · 11:00am', assigned: 'MR',
    job: 'Downtown Penthouse', notes: 'Added Sonos outdoor speakers to patio zone. Tested and signed off.',
    history: [
      { by: 'System', time: 'Apr 8 · 11:00am', note: 'Ticket created' },
      { by: 'MR', time: 'Apr 9 · 2:00pm', note: 'Quoted additional Sonos outdoor speakers.' },
      { by: 'MR', time: 'Apr 11 · 4:30pm', note: 'Installation complete. Client signed off.' },
      { by: 'System', time: 'Apr 11 · 4:31pm', note: 'Ticket resolved' },
    ]
  },
]

const teamColors = { JD: '#0066cc', MR: '#34c759', SW: '#534AB7', AL: '#ff9500' }

const typeColors = {
  Device: { bg: 'rgba(255,59,48,0.08)', color: '#d70015' },
  Change: { bg: 'rgba(0,102,204,0.08)', color: '#0066cc' },
  Warranty: { bg: 'rgba(83,74,183,0.09)', color: '#534AB7' },
}

const priorityColors = {
  Urgent: { bg: 'rgba(255,59,48,0.08)', color: '#d70015' },
  Normal: { bg: 'rgba(174,174,178,0.12)', color: '#6e6e73' },
  Low: { bg: 'rgba(52,199,89,0.09)', color: '#248a3d' },
}

const statusColors = {
  Open: { bg: 'rgba(255,149,0,0.09)', color: '#c93400' },
  'In progress': { bg: 'rgba(0,102,204,0.08)', color: '#0066cc' },
  Resolved: { bg: 'rgba(52,199,89,0.09)', color: '#248a3d' },
}

const lbl = { fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5 }
const inp = { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 11px', fontSize: 12.5, color: 'var(--text)', fontFamily: 'var(--font)', outline: 'none' }
const primaryBtn = { padding: '8px 18px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#1d1d1f', color: '#fff', fontFamily: 'var(--font)' }
const ghostBtn = { padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontFamily: 'var(--font)' }

function Badge({ text, colors }) {
  const st = colors[text] || { bg: 'var(--bg4)', color: 'var(--text2)' }
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 5, fontSize: 10.5, fontWeight: 700, background: st.bg, color: st.color }}>{text}</span>
}

function Avatar({ initials, size = 24 }) {
  return <div style={{ width: size, height: size, minWidth: size, borderRadius: '50%', background: teamColors[initials] || '#6e6e73', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 700, color: '#fff' }}>{initials}</div>
}

function NewTicketModal({ onClose }) {
  const [form, setForm] = useState({ client: '', contact: '', phone: '', issue: '', type: 'Device', priority: 'Normal', assigned: 'JD', notes: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 14, width: 500, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px', borderBottom: '1px solid var(--border2)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>New support ticket</div>
          <button onClick={onClose} style={{ background: 'var(--bg4)', border: 'none', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', color: 'var(--text2)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ padding: '18px 22px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div><div style={lbl}>Client</div><input style={inp} placeholder="e.g. Johnson Family" value={form.client} onChange={e => set('client', e.target.value)} /></div>
            <div><div style={lbl}>Contact name</div><input style={inp} placeholder="e.g. Sarah Johnson" value={form.contact} onChange={e => set('contact', e.target.value)} /></div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={lbl}>Phone</div>
            <input style={inp} placeholder="e.g. (503) 555-0142" value={form.phone} onChange={e => set('phone', e.target.value)} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={lbl}>Issue description</div>
            <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} placeholder="Describe the issue in detail..." value={form.issue} onChange={e => set('issue', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={lbl}>Type</div>
              <select style={inp} value={form.type} onChange={e => set('type', e.target.value)}>
                <option>Device</option>
                <option>Change</option>
                <option>Warranty</option>
              </select>
            </div>
            <div>
              <div style={lbl}>Priority</div>
              <select style={inp} value={form.priority} onChange={e => set('priority', e.target.value)}>
                <option>Urgent</option>
                <option>Normal</option>
                <option>Low</option>
              </select>
            </div>
            <div>
              <div style={lbl}>Assign to</div>
              <select style={inp} value={form.assigned} onChange={e => set('assigned', e.target.value)}>
                <option value="JD">John D.</option>
                <option value="MR">Mike R.</option>
                <option value="SW">Sam W.</option>
                <option value="AL">Amy L.</option>
              </select>
            </div>
          </div>
          <div>
            <div style={lbl}>Internal notes</div>
            <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} placeholder="Any additional context for the team..." value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border2)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={ghostBtn}>Cancel</button>
          <button style={primaryBtn}>Create ticket</button>
        </div>
      </div>
    </div>
  )
}

function TicketDetail({ ticket, onClose }) {
  const [note, setNote] = useState('')
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 14, width: 580, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.15)' }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border2)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>{ticket.id}</span>
              <Badge text={ticket.status} colors={statusColors} />
              <Badge text={ticket.type} colors={typeColors} />
              <Badge text={ticket.priority} colors={priorityColors} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{ticket.issue}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{ticket.client} · {ticket.contact} · {ticket.phone}</div>
          </div>
          <button onClick={onClose} style={{ background: 'var(--bg4)', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', color: 'var(--text2)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ padding: '18px 22px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
            {[
              { label: 'Linked job', value: ticket.job },
              { label: 'Assigned to', value: ticket.assigned },
              { label: 'Created', value: ticket.created },
            ].map(f => (
              <div key={f.label} style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 9, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', marginBottom: 3 }}>{f.label.toUpperCase()}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{f.value}</div>
              </div>
            ))}
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 9, padding: '10px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', marginBottom: 6 }}>STATUS</div>
              <select defaultValue={ticket.status} style={{ background: 'transparent', border: 'none', fontSize: 12.5, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font)', cursor: 'pointer', outline: 'none', width: '100%' }}>
                <option>Open</option>
                <option>In progress</option>
                <option>Resolved</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Notes</div>
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 9, padding: '12px 14px', fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.6 }}>{ticket.notes}</div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Activity</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {ticket.history.map((h, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: h.by === 'System' ? 'var(--text3)' : teamColors[h.by] || 'var(--accent)', marginTop: 4, flexShrink: 0 }} />
                    {i < ticket.history.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--border2)', marginTop: 4 }} />}
                  </div>
                  <div style={{ flex: 1, paddingBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)' }}>{h.by}</span>
                      <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>{h.time}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{h.note}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Add update</div>
            <textarea
              style={{ ...inp, minHeight: 70, resize: 'vertical', marginBottom: 8 }}
              placeholder="Log an update, action taken, or note..."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...primaryBtn, fontSize: 11 }}>Post update</button>
              <button style={{ ...ghostBtn, fontSize: 11 }}>Mark resolved</button>
              <button style={{ ...ghostBtn, fontSize: 11 }}>Assign to job</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SupportTickets() {
  const [filter, setFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState('All')
  const [showNew, setShowNew] = useState(false)
  const [selected, setSelected] = useState(null)

  const filtered = TICKETS.filter(t => {
    const matchStatus = filter === 'All' || t.status === filter
    const matchType = typeFilter === 'All' || t.type === typeFilter
    return matchStatus && matchType
  })

  const counts = {
    open: TICKETS.filter(t => t.status === 'Open').length,
    inProgress: TICKETS.filter(t => t.status === 'In progress').length,
    resolved: TICKETS.filter(t => t.status === 'Resolved').length,
    urgent: TICKETS.filter(t => t.priority === 'Urgent').length,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {showNew && <NewTicketModal onClose={() => setShowNew(false)} />}
      {selected && <TicketDetail ticket={selected} onClose={() => setSelected(null)} />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Support tickets</div>
        <button onClick={() => setShowNew(true)} style={{ ...primaryBtn, fontSize: 12 }}>+ New ticket</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, padding: '14px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
        {[
          { label: 'Open', value: counts.open, color: '#c93400' },
          { label: 'In progress', value: counts.inProgress, color: '#0066cc' },
          { label: 'Resolved', value: counts.resolved, color: '#248a3d' },
          { label: 'Urgent', value: counts.urgent, color: '#d70015' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 9, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '10px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0, flexWrap: 'wrap' }}>
        {['All', 'Open', 'In progress', 'Resolved'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '5px 12px', borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', border: `1px solid ${filter === f ? 'var(--accent)' : 'var(--border)'}`, background: filter === f ? 'rgba(0,102,204,0.08)' : 'transparent', color: filter === f ? 'var(--accent)' : 'var(--text2)', fontFamily: 'var(--font)' }}>{f}</button>
        ))}
        <div style={{ width: 1, background: 'var(--border2)', margin: '0 4px' }} />
        {['All', 'Device', 'Change', 'Warranty'].map(f => (
          <button key={f} onClick={() => setTypeFilter(f)} style={{ padding: '5px 12px', borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', border: `1px solid ${typeFilter === f ? 'var(--text2)' : 'var(--border)'}`, background: typeFilter === f ? 'var(--bg4)' : 'transparent', color: typeFilter === f ? 'var(--text)' : 'var(--text2)', fontFamily: 'var(--font)' }}>{f}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, marginBottom: 12 }}>{filtered.length} ticket{filtered.length !== 1 ? 's' : ''}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(ticket => (
            <div key={ticket.id} onClick={() => setSelected(ticket)} style={{ background: 'var(--bg2)', border: `1px solid ${ticket.priority === 'Urgent' && ticket.status !== 'Resolved' ? 'rgba(255,59,48,0.3)' : 'var(--border2)'}`, borderRadius: 11, padding: '13px 16px', cursor: 'pointer', transition: 'all 0.12s' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 600 }}>{ticket.id}</span>
                    <Badge text={ticket.status} colors={statusColors} />
                    <Badge text={ticket.type} colors={typeColors} />
                    {ticket.priority === 'Urgent' && <Badge text="Urgent" colors={priorityColors} />}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{ticket.issue}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{ticket.client} · {ticket.job} · {ticket.created}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <Avatar initials={ticket.assigned} size={26} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
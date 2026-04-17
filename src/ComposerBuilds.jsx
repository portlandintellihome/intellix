import { useState, useEffect } from 'react'
import { apiGet } from './lib/api'

const DRIVER_CATS = ['All', 'AV', 'Audio', 'Lighting', 'HVAC', 'Security', 'Network', 'Shades']

const CONTROLLERS = ['Control4 EA-1', 'Control4 EA-3', 'Control4 EA-5', 'Control4 CA-1', 'Control4 HC-800']

const inp = { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 11px', fontSize: 12.5, color: 'var(--text)', fontFamily: 'var(--font)', outline: 'none' }
const lbl = { fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5 }
const primaryBtn = { padding: '9px 20px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#1d1d1f', color: '#fff', fontFamily: 'var(--font)' }
const ghostBtn = { padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontFamily: 'var(--font)' }

function generateChecklist(form) {
  const rooms = form.rooms.filter(r => r.name.trim())
  const drivers = form.selectedDrivers

  const phases = [
    {
      title: 'Phase 1 — Pre-build verification',
      color: '#6e6e73',
      items: [
        { text: 'Confirm all required drivers are installed in Composer Pro', detail: `Verify these ${drivers.length} driver(s) are in My Drivers: ${drivers.map(d => d.name).join(', ') || 'None selected'}` },
        { text: 'Confirm all devices are powered on and connected to the network', detail: 'Every device must be online and reachable before opening Composer Pro.' },
        { text: 'Pull device IP list from OVRC', detail: `Site: ${form.ovrc || 'Not specified'}. Note IPs for all IP-connected devices.` },
        { text: `Confirm ${form.controller} is reachable — connect Composer Pro to Director`, detail: 'System → Connect to Director → enter controller IP. Confirm green status.' },
      ]
    },
    {
      title: 'Phase 2 — Project setup',
      color: '#0066cc',
      items: [
        { text: 'Create new project or open existing', detail: `File → New Project. Name: ${form.projectName || 'Untitled'}. Controller: ${form.controller}.` },
        { text: 'Set controller IP address', detail: 'Set IP from OVRC device list in project properties.' },
        { text: `Add all ${rooms.length} room(s) to the project`, detail: `Project → Add Room for each: ${rooms.map(r => r.name).join(', ')}.` },
      ]
    },
    ...rooms.map((room, i) => ({
      title: `Phase ${3 + i} — ${room.name}`,
      color: '#534AB7',
      items: [
        { text: `Add devices to ${room.name}`, detail: room.devices ? `Devices: ${room.devices}` : 'Add all drivers for this room. Set IPs from OVRC list.' },
        { text: `Configure bindings for ${room.name}`, detail: 'Connections tab — bind all device inputs and outputs. Verify each binding.' },
        { text: `Test ${room.name} devices`, detail: `Confirm all devices in ${room.name} respond correctly before moving on.` },
      ]
    })),
    {
      title: `Phase ${3 + rooms.length} — Programming & Navigator`,
      color: '#ff9500',
      items: [
        { text: 'Configure Navigator room list', detail: `Confirm all rooms appear: ${rooms.map(r => r.name).join(', ')}.` },
        ...(form.scenes ? [{ text: 'Program scenes and automations', detail: form.scenes }] : []),
        { text: 'Set default variable states', detail: 'Set sensible defaults for all variables and button states.' },
      ]
    },
    {
      title: `Phase ${4 + rooms.length} — Final verification`,
      color: '#34c759',
      items: [
        { text: 'Push project to Director', detail: 'System → Send to Director. Wait for full confirmation.' },
        { text: 'Walk through all rooms with client', detail: 'Test every device and scene with the client present.' },
        { text: 'Save final project file', detail: 'File → Save. Name with client name and date. Back up to shared folder.' },
        { text: 'Leave client with Navigator walkthrough', detail: 'Show client how to use the Control4 app and keypads.' },
      ]
    }
  ]

  return phases
}

function BuildForm({ onGenerate, existingJobs, drivers }) {
  const EXISTING_JOBS = existingJobs
  const DRIVERS = drivers
  const [form, setForm] = useState({
    projectName: '', client: '', linkedJob: '', controller: '',
    ovrc: '', version: '', installer: '',
    rooms: [{ name: '', devices: '' }, { name: '', devices: '' }],
    selectedDrivers: [], scenes: '', notes: '', date: new Date().toISOString().split('T')[0]
  })
  const [driverCat, setDriverCat] = useState('All')
  const [driverSearch, setDriverSearch] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const addRoom = () => setForm(f => ({ ...f, rooms: [...f.rooms, { name: '', devices: '' }] }))
  const removeRoom = (i) => setForm(f => ({ ...f, rooms: f.rooms.filter((_, idx) => idx !== i) }))
  const updateRoom = (i, k, v) => setForm(f => ({ ...f, rooms: f.rooms.map((r, idx) => idx === i ? { ...r, [k]: v } : r) }))

  const toggleDriver = (driver) => {
    setForm(f => ({
      ...f,
      selectedDrivers: f.selectedDrivers.find(d => d.name === driver.name)
        ? f.selectedDrivers.filter(d => d.name !== driver.name)
        : [...f.selectedDrivers, driver]
    }))
  }

  const filteredDrivers = DRIVERS.filter(d => {
    const matchCat = driverCat === 'All' || d.cat === driverCat
    const matchSearch = d.name.toLowerCase().includes(driverSearch.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, maxWidth: 1100 }}>

        {/* LEFT — FORM */}
        <div>
          {/* PROJECT INFO */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '16px', marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>Project information</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><div style={lbl}>Project name</div><input style={inp} placeholder="Project name" value={form.projectName} onChange={e => set('projectName', e.target.value)} /></div>
              <div><div style={lbl}>Client name</div><input style={inp} placeholder="Client name" value={form.client} onChange={e => set('client', e.target.value)} /></div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={lbl}>Link to existing job (optional)</div>
              <select style={inp} value={form.linkedJob} onChange={e => set('linkedJob', e.target.value)}>
                <option value="">— Standalone build doc —</option>
                {EXISTING_JOBS.map(j => <option key={j.id} value={j.id}>{j.name} — {j.client}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
  <div style={lbl}>Controller model <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(optional)</span></div>
  <select style={inp} value={form.controller} onChange={e => set('controller', e.target.value)}>
    <option value="">— Select controller —</option>
    {CONTROLLERS.map(c => <option key={c}>{c}</option>)}
  </select>
</div>
              <div><div style={lbl}>Composer Pro version</div><input style={inp} placeholder="e.g. 3.4.0" value={form.version} onChange={e => set('version', e.target.value)} /></div>
              <div><div style={lbl}>Date</div><input style={inp} type="date" value={form.date} onChange={e => set('date', e.target.value)} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><div style={lbl}>Installer</div><input style={inp} placeholder="Installer name" value={form.installer} onChange={e => set('installer', e.target.value)} /></div>
              <div><div style={lbl}>OVRC site name</div><input style={inp} placeholder="OVRC site identifier" value={form.ovrc} onChange={e => set('ovrc', e.target.value)} /></div>
            </div>
          </div>

          {/* ROOMS */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '16px', marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>Rooms & devices</div>
            {form.rooms.map((room, i) => (
              <div key={i} style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 9, padding: '12px', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <input style={{ ...inp, fontWeight: 600 }} placeholder={`Room ${i + 1} name`} value={room.name} onChange={e => updateRoom(i, 'name', e.target.value)} />
                  {form.rooms.length > 1 && (
                    <button onClick={() => removeRoom(i)} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text3)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
                  )}
                </div>
                <input style={inp} placeholder="Devices in this room (e.g. Sony TV, Apple TV, Lutron dimmer)" value={room.devices} onChange={e => updateRoom(i, 'devices', e.target.value)} />
              </div>
            ))}
            <button onClick={addRoom} style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', marginTop: 4 }}>+ Add room</button>
          </div>

          {/* SCENES */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '16px', marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>Scenes & programming</div>
            <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' }} placeholder="e.g. Good Morning: lights 30%, thermostat 70°F, blinds open&#10;Movie Mode: living room lights 5%, TV on, surround sound&#10;Good Night: all lights off, locks engaged, security armed" value={form.scenes} onChange={e => set('scenes', e.target.value)} />
          </div>

          {/* NOTES */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '16px', marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>Additional notes</div>
            <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} placeholder="Site notes, client preferences, rack location, special requirements..." value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          <button onClick={() => onGenerate(form)} style={{ ...primaryBtn, width: '100%', padding: '12px', fontSize: 13 }}>
            Generate Composer Pro build doc →
          </button>
        </div>

        {/* RIGHT — DRIVER LIBRARY */}
        <div style={{ position: 'sticky', top: 0 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border2)', background: 'var(--bg3)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Driver library</div>
              <input style={{ ...inp, fontSize: 12 }} placeholder="Search drivers..." value={driverSearch} onChange={e => setDriverSearch(e.target.value)} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                {DRIVER_CATS.map(cat => (
                  <button key={cat} onClick={() => setDriverCat(cat)} style={{ padding: '3px 8px', borderRadius: 5, fontSize: 10.5, fontWeight: 600, cursor: 'pointer', border: `1px solid ${driverCat === cat ? 'var(--accent)' : 'var(--border)'}`, background: driverCat === cat ? 'rgba(0,102,204,0.08)' : 'transparent', color: driverCat === cat ? 'var(--accent)' : 'var(--text2)', fontFamily: 'var(--font)' }}>{cat}</button>
                ))}
              </div>
            </div>
            {form.selectedDrivers.length > 0 && (
              <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border2)', background: 'rgba(0,102,204,0.04)' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', marginBottom: 5 }}>SELECTED — {form.selectedDrivers.length}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {form.selectedDrivers.map(d => (
                    <span key={d.name} onClick={() => toggleDriver(d)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 4, fontSize: 10.5, fontWeight: 600, background: 'rgba(0,102,204,0.1)', color: 'var(--accent)', cursor: 'pointer' }}>
                      {d.name} ×
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {filteredDrivers.map(driver => {
                const selected = form.selectedDrivers.find(d => d.name === driver.name)
                return (
                  <div key={driver.name} onClick={() => toggleDriver(driver)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: '1px solid var(--border2)', cursor: 'pointer', background: selected ? 'rgba(0,102,204,0.04)' : 'transparent', transition: 'background 0.1s' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: selected ? 'var(--accent)' : 'var(--text)' }}>{driver.name}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>{driver.cat} · {driver.conn}</div>
                    </div>
                    <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--border)'}`, background: selected ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {selected && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function BuildChecklist({ form, checklist, onBack }) {
  const [checked, setChecked] = useState({})
  const total = checklist.reduce((a, p) => a + p.items.length, 0)
  const done = Object.values(checked).filter(Boolean).length
  const pct = Math.round((done / total) * 100)

  const toggle = (key) => setChecked(c => ({ ...c, [key]: !c[key] }))

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
      <div style={{ maxWidth: 780, margin: '0 auto' }}>

        {/* PROJECT SUMMARY CARD */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{form.projectName || 'Untitled Project'}</div>
              {form.linkedJob && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(0,102,204,0.08)', color: 'var(--accent)' }}>Linked to job</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>
              {form.client && <span>{form.client} · </span>}
              <span>{form.controller}</span>
              {form.version && <span> · v{form.version}</span>}
              {form.installer && <span> · {form.installer}</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>
              {form.rooms.filter(r => r.name).length} rooms
              {form.ovrc && <span> · OVRC: {form.ovrc}</span>}
              {form.date && <span> · {form.date}</span>}
            </div>
            {form.selectedDrivers.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {form.selectedDrivers.map(d => (
                  <span key={d.name} style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border2)' }}>{d.name}</span>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
            <button onClick={onBack} style={{ ...ghostBtn, fontSize: 11 }}>Edit form</button>
            <button onClick={() => window.print()} style={{ ...ghostBtn, fontSize: 11 }}>Print</button>
          </div>
        </div>

        {/* PROGRESS */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '12px 18px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Progress</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: pct === 100 ? '#248a3d' : 'var(--accent)' }}>{pct}% — {done}/{total}</div>
          </div>
          <div style={{ height: 5, background: 'var(--bg4)', borderRadius: 5, overflow: 'hidden' }}>
            <div style={{ height: 5, width: `${pct}%`, background: pct === 100 ? '#34c759' : 'var(--accent)', borderRadius: 5, transition: 'width 0.3s' }} />
          </div>
        </div>

        {/* CHECKLIST */}
        {checklist.map((phase, pi) => {
          const phaseDone = phase.items.filter((_, ii) => checked[`${pi}-${ii}`]).length
          return (
            <div key={pi} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', background: 'var(--bg3)', borderBottom: '1px solid var(--border2)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: phase.color, flexShrink: 0 }} />
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{phase.title}</div>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: phaseDone === phase.items.length ? '#248a3d' : 'var(--text3)' }}>{phaseDone}/{phase.items.length}</div>
              </div>
              {phase.items.map((item, ii) => {
                const key = `${pi}-${ii}`
                const isDone = !!checked[key]
                return (
                  <div key={ii} onClick={() => toggle(key)} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 16px', borderBottom: ii < phase.items.length - 1 ? '1px solid var(--border2)' : 'none', cursor: 'pointer', opacity: isDone ? 0.55 : 1, transition: 'opacity 0.15s' }}>
                    <div style={{ width: 18, height: 18, minWidth: 18, borderRadius: 4, border: `1.5px solid ${isDone ? '#34c759' : 'var(--border)'}`, background: isDone ? '#34c759' : 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2, transition: 'all 0.15s' }}>
                      {isDone && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', textDecoration: isDone ? 'line-through' : 'none', marginBottom: 2 }}>{item.text}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5 }}>{item.detail}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}

        {form.notes && (
          <div style={{ background: 'var(--abg)', border: '1px solid rgba(255,149,0,0.2)', borderRadius: 10, padding: '12px 16px', marginTop: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#c93400', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Notes</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>{form.notes}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ComposerBuilds() {
  const [view, setView] = useState('list')
  const [form, setForm] = useState(null)
  const [checklist, setChecklist] = useState(null)
  const [savedBuilds, setSavedBuilds] = useState([])
  const [existingJobs, setExistingJobs] = useState([])
  const [drivers, setDrivers] = useState([])

  useEffect(() => {
    Promise.all([
      apiGet('/api/composer-builds').catch(() => []),
      apiGet('/api/jobs').catch(() => []),
      apiGet('/api/drivers').catch(() => []),
    ]).then(([builds, jobs, drvs]) => {
      setSavedBuilds(builds.map(b => ({
        ...b,
        client: b.client_name || '',
        date: b.build_date ? new Date(b.build_date).toLocaleDateString() : '',
      })))
      setExistingJobs(jobs.map(j => ({ ...j, client: j.client_name || '' })))
      setDrivers(drvs.map(d => ({ ...d, cat: d.category, conn: d.connection, file: d.filename })))
    })
  }, [])

  const SAVED_BUILDS = savedBuilds

  const handleGenerate = (formData) => {
    setForm(formData)
    setChecklist(generateChecklist(formData))
    setView('checklist')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Composer builds</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {view !== 'list' && <button onClick={() => setView('list')} style={{ ...ghostBtn, fontSize: 11 }}>← All builds</button>}
          {view === 'list' && <button onClick={() => setView('form')} style={{ ...primaryBtn, fontSize: 12 }}>+ New build doc</button>}
        </div>
      </div>

      {view === 'list' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Total builds', value: SAVED_BUILDS.length, color: 'var(--text)' },
              { label: 'In progress', value: SAVED_BUILDS.filter(b => b.progress < 100 && b.progress > 0).length, color: '#0066cc' },
              { label: 'Complete', value: SAVED_BUILDS.filter(b => b.progress === 100).length, color: '#248a3d' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 11, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>{s.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
          {SAVED_BUILDS.length === 0 && (
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>No build docs yet</div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 14 }}>Generate your first Composer Pro build checklist.</div>
              <button onClick={() => setView('form')} style={{ ...primaryBtn, fontSize: 12 }}>+ New build doc</button>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SAVED_BUILDS.map(build => (
              <div key={build.id} onClick={() => setView('form')} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 11, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.12s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{build.name}</div>
                      {build.progress === 100 && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(52,199,89,0.09)', color: '#248a3d' }}>Complete</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>{build.client} · {build.date} · {build.phases} phases</div>
                    <div style={{ height: 4, background: 'var(--bg4)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: 4, width: `${build.progress}%`, background: build.progress === 100 ? '#34c759' : 'var(--accent)', borderRadius: 4 }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: build.progress === 100 ? '#248a3d' : 'var(--accent)', flexShrink: 0 }}>{build.progress}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'form' && <BuildForm onGenerate={handleGenerate} existingJobs={existingJobs} drivers={drivers} />}
      {view === 'checklist' && form && checklist && <BuildChecklist form={form} checklist={checklist} onBack={() => setView('form')} />}
    </div>
  )
}
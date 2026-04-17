import { useState } from 'react'

const DRIVERS = [
  { id: 1, name: 'Sony Bravia TV (IP)', cat: 'AV', conn: 'IP', file: 'sony_bravia_ip.c4z', added: 'Mar 12 2026' },
  { id: 2, name: 'Samsung TV (IP)', cat: 'AV', conn: 'IP', file: 'samsung_tv_ip.c4z', added: 'Mar 12 2026' },
  { id: 3, name: 'LG TV (IP)', cat: 'AV', conn: 'IP', file: 'lg_tv_ip.c4z', added: 'Mar 12 2026' },
  { id: 4, name: 'Apple TV 4K', cat: 'AV', conn: 'IP', file: 'apple_tv_4k.c4z', added: 'Mar 14 2026' },
  { id: 5, name: 'Denon AVR (IP)', cat: 'AV', conn: 'IP', file: 'denon_avr_ip.c4z', added: 'Feb 28 2026' },
  { id: 6, name: 'Yamaha AVR (IP)', cat: 'AV', conn: 'IP', file: 'yamaha_avr_ip.c4z', added: 'Feb 28 2026' },
  { id: 7, name: 'Sonos (IP)', cat: 'Audio', conn: 'IP', file: 'sonos_ip.c4z', added: 'Jan 10 2026' },
  { id: 8, name: 'Triad One Streamer', cat: 'Audio', conn: 'IP', file: 'triad_one.c4z', added: 'Jan 10 2026' },
  { id: 9, name: 'Triad Matrix Amp', cat: 'Audio', conn: 'IP', file: 'triad_matrix.c4z', added: 'Jan 10 2026' },
  { id: 10, name: 'Lutron RadioRA 3', cat: 'Lighting', conn: 'IP', file: 'lutron_radiora3.c4z', added: 'Dec 5 2025' },
  { id: 11, name: 'Lutron Caseta Pro', cat: 'Lighting', conn: 'IP', file: 'lutron_caseta_pro.c4z', added: 'Dec 5 2025' },
  { id: 12, name: 'Ketra Lighting', cat: 'Lighting', conn: 'IP', file: 'ketra.c4z', added: 'Feb 1 2026' },
  { id: 13, name: 'Control4 Dimmer', cat: 'Lighting', conn: 'Zigbee', file: 'c4_dimmer.c4z', added: 'Nov 20 2025' },
  { id: 14, name: 'Ecobee Thermostat', cat: 'HVAC', conn: 'IP', file: 'ecobee.c4z', added: 'Jan 15 2026' },
  { id: 15, name: 'Nest Thermostat', cat: 'HVAC', conn: 'IP', file: 'nest.c4z', added: 'Jan 15 2026' },
  { id: 16, name: 'Honeywell T6 Pro', cat: 'HVAC', conn: 'IP', file: 'honeywell_t6.c4z', added: 'Jan 15 2026' },
  { id: 17, name: 'DSC Security Panel', cat: 'Security', conn: 'RS232', file: 'dsc_panel.c4z', added: 'Mar 1 2026' },
  { id: 18, name: 'Alarm.com', cat: 'Security', conn: 'IP', file: 'alarm_com.c4z', added: 'Mar 1 2026' },
  { id: 19, name: 'Liftmaster MyQ', cat: 'Security', conn: 'IP', file: 'liftmaster_myq.c4z', added: 'Mar 1 2026' },
  { id: 20, name: 'Araknis Switch', cat: 'Network', conn: 'IP', file: 'araknis_switch.c4z', added: 'Nov 10 2025' },
  { id: 21, name: 'Ubiquiti UniFi', cat: 'Network', conn: 'IP', file: 'ubiquiti_unifi.c4z', added: 'Nov 10 2025' },
  { id: 22, name: 'Pakedge Router', cat: 'Network', conn: 'IP', file: 'pakedge_router.c4z', added: 'Nov 10 2025' },
  { id: 23, name: 'Lutron Sivoia QS', cat: 'Shades', conn: 'IP', file: 'lutron_sivoia.c4z', added: 'Feb 20 2026' },
  { id: 24, name: 'Hunter Douglas', cat: 'Shades', conn: 'IP', file: 'hunter_douglas.c4z', added: 'Feb 20 2026' },
]

const CATS = ['All', 'AV', 'Audio', 'Lighting', 'HVAC', 'Security', 'Network', 'Shades']

const catColors = {
  AV: { bg: 'rgba(0,102,204,0.08)', color: '#0066cc' },
  Audio: { bg: 'rgba(83,74,183,0.09)', color: '#534AB7' },
  Lighting: { bg: 'rgba(255,149,0,0.09)', color: '#c93400' },
  HVAC: { bg: 'rgba(52,199,89,0.09)', color: '#248a3d' },
  Security: { bg: 'rgba(255,59,48,0.08)', color: '#d70015' },
  Network: { bg: 'rgba(174,174,178,0.12)', color: '#6e6e73' },
  Shades: { bg: 'rgba(255,149,0,0.08)', color: '#c93400' },
}

const connColors = {
  IP: { bg: 'rgba(0,102,204,0.08)', color: '#0066cc' },
  RS232: { bg: 'rgba(83,74,183,0.09)', color: '#534AB7' },
  Zigbee: { bg: 'rgba(52,199,89,0.09)', color: '#248a3d' },
}

const primaryBtn = { padding: '8px 18px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#1d1d1f', color: '#fff', fontFamily: 'var(--font)' }
const ghostBtn = { padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontFamily: 'var(--font)' }

function UploadModal({ onClose }) {
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState(null)
  const [cat, setCat] = useState('AV')

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 14, width: 460, boxShadow: '0 8px 40px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px', borderBottom: '1px solid var(--border2)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Upload driver</div>
          <button onClick={onClose} style={{ background: 'var(--bg4)', border: 'none', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', color: 'var(--text2)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ padding: '18px 22px' }}>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); setFile(e.dataTransfer.files[0]) }}
            style={{ border: `2px dashed ${dragging ? 'var(--accent)' : file ? '#34c759' : 'var(--border)'}`, borderRadius: 10, padding: '32px 20px', textAlign: 'center', background: dragging ? 'rgba(0,102,204,0.04)' : file ? 'rgba(52,199,89,0.04)' : 'var(--bg3)', transition: 'all 0.15s', marginBottom: 14, cursor: 'pointer' }}
            onClick={() => document.getElementById('fileInput').click()}
          >
            <input id="fileInput" type="file" accept=".c4z" style={{ display: 'none' }} onChange={e => setFile(e.target.files[0])} />
            {file ? (
              <>
                <div style={{ fontSize: 28, marginBottom: 6 }}>✓</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#248a3d' }}>{file.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{(file.size / 1024).toFixed(1)} KB</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 28, marginBottom: 6 }}>📦</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Drop .c4z file here</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>or click to browse</div>
              </>
            )}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Category</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {CATS.filter(c => c !== 'All').map(c => (
                <button key={c} onClick={() => setCat(c)} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', border: `1px solid ${cat === c ? 'var(--accent)' : 'var(--border)'}`, background: cat === c ? 'rgba(0,102,204,0.08)' : 'transparent', color: cat === c ? 'var(--accent)' : 'var(--text2)', fontFamily: 'var(--font)' }}>{c}</button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border2)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={ghostBtn}>Cancel</button>
          <button style={{ ...primaryBtn, opacity: file ? 1 : 0.4, cursor: file ? 'pointer' : 'not-allowed' }}>Add to library</button>
        </div>
      </div>
    </div>
  )
}

export default function DriverLibrary() {
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('All')
  const [showUpload, setShowUpload] = useState(false)
  const [selected, setSelected] = useState(null)

  const filtered = DRIVERS.filter(d => {
    const matchCat = cat === 'All' || d.cat === cat
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) || d.file.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const counts = CATS.filter(c => c !== 'All').map(c => ({ cat: c, count: DRIVERS.filter(d => d.cat === c).length }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Driver library</div>
        <button onClick={() => setShowUpload(true)} style={{ ...primaryBtn, fontSize: 12 }}>+ Upload driver</button>
      </div>

      {/* STATS */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', overflowX: 'auto', flexShrink: 0 }}>
        {counts.map(c => (
          <div key={c.cat} onClick={() => setCat(c.cat)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 8, border: `1px solid ${cat === c.cat ? 'var(--accent)' : 'var(--border2)'}`, background: cat === c.cat ? 'rgba(0,102,204,0.06)' : 'var(--bg3)', cursor: 'pointer', flexShrink: 0 }}>
            <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: catColors[c.cat]?.bg, color: catColors[c.cat]?.color }}>{c.cat}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{c.count}</span>
          </div>
        ))}
        <div onClick={() => setCat('All')} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 8, border: `1px solid ${cat === 'All' ? 'var(--accent)' : 'var(--border2)'}`, background: cat === 'All' ? 'rgba(0,102,204,0.06)' : 'var(--bg3)', cursor: 'pointer', flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)' }}>All</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{DRIVERS.length}</span>
        </div>
      </div>

      {/* SEARCH */}
      <div style={{ padding: '10px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
        <input
          style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, color: 'var(--text)', fontFamily: 'var(--font)', outline: 'none' }}
          placeholder="Search drivers by name or filename..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* DRIVER LIST */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, marginBottom: 12 }}>{filtered.length} driver{filtered.length !== 1 ? 's' : ''}</div>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', padding: '8px 16px', background: 'var(--bg3)', borderBottom: '1px solid var(--border2)' }}>
            {['Driver', 'Category', 'Connection', 'Added', ''].map(h => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</div>
            ))}
          </div>
          {filtered.map((driver, i) => (
            <div key={driver.id} onClick={() => setSelected(selected?.id === driver.id ? null : driver)} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', padding: '11px 16px', borderBottom: i < filtered.length - 1 ? '1px solid var(--border2)' : 'none', alignItems: 'center', cursor: 'pointer', background: selected?.id === driver.id ? 'rgba(0,102,204,0.04)' : 'transparent', transition: 'background 0.1s' }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{driver.name}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>{driver.file}</div>
              </div>
              <div>
                <span style={{ padding: '2px 8px', borderRadius: 5, fontSize: 10.5, fontWeight: 700, background: catColors[driver.cat]?.bg, color: catColors[driver.cat]?.color }}>{driver.cat}</span>
              </div>
              <div>
                <span style={{ padding: '2px 8px', borderRadius: 5, fontSize: 10.5, fontWeight: 700, background: connColors[driver.conn]?.bg, color: connColors[driver.conn]?.color }}>{driver.conn}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{driver.added}</div>
              <button onClick={e => { e.stopPropagation() }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', whiteSpace: 'nowrap' }}>
                ···
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
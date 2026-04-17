import { useState } from 'react'

const INVENTORY = [
  { id: 1, name: 'Control4 EA-5', cat: 'Controllers', qty: 2, onOrder: 1, location: 'Main warehouse', cost: 1899, supplier: 'SnapOne', status: 'In stock' },
  { id: 2, name: 'Control4 EA-3', cat: 'Controllers', qty: 1, onOrder: 2, location: 'Main warehouse', cost: 999, supplier: 'SnapOne', status: 'In stock' },
  { id: 3, name: 'Lutron RadioRA 3 Bridge', cat: 'Lighting', qty: 3, onOrder: 0, location: 'Main warehouse', cost: 449, supplier: 'Lutron', status: 'In stock' },
  { id: 4, name: 'Lutron Caseta Smart Bridge Pro', cat: 'Lighting', qty: 1, onOrder: 0, location: 'Main warehouse', cost: 179, supplier: 'Lutron', status: 'Low stock' },
  { id: 5, name: 'Sonos Amp', cat: 'Audio', qty: 4, onOrder: 2, location: 'Main warehouse', cost: 699, supplier: 'Sonos', status: 'In stock' },
  { id: 6, name: 'Triad One Streamer', cat: 'Audio', qty: 2, onOrder: 0, location: 'Van', cost: 499, supplier: 'SnapOne', status: 'In stock' },
  { id: 7, name: 'Araknis 8-Port Switch', cat: 'Network', qty: 5, onOrder: 3, location: 'Main warehouse', cost: 299, supplier: 'SnapOne', status: 'In stock' },
  { id: 8, name: 'Araknis WAP', cat: 'Network', qty: 3, onOrder: 0, location: 'Main warehouse', cost: 249, supplier: 'SnapOne', status: 'In stock' },
  { id: 9, name: 'WattBox 600 Series', cat: 'Power', qty: 2, onOrder: 4, location: 'Main warehouse', cost: 349, supplier: 'SnapOne', status: 'In stock' },
  { id: 10, name: 'Ecobee Smart Thermostat', cat: 'HVAC', qty: 0, onOrder: 3, location: '—', cost: 249, supplier: 'Ecobee', status: 'On order' },
  { id: 11, name: 'Control4 8-Button Keypad', cat: 'Keypads', qty: 6, onOrder: 0, location: 'Main warehouse', cost: 299, supplier: 'SnapOne', status: 'In stock' },
  { id: 12, name: 'Control4 Dimmer Switch', cat: 'Keypads', qty: 0, onOrder: 8, location: '—', cost: 149, supplier: 'SnapOne', status: 'On order' },
]

const CATS = ['All', 'Controllers', 'Lighting', 'Audio', 'Network', 'Power', 'HVAC', 'Keypads']

const statusStyles = {
  'In stock': { bg: 'rgba(52,199,89,0.09)', color: '#248a3d' },
  'Low stock': { bg: 'rgba(255,149,0,0.09)', color: '#c93400' },
  'On order': { bg: 'rgba(0,102,204,0.08)', color: '#0066cc' },
  'Out of stock': { bg: 'rgba(255,59,48,0.08)', color: '#d70015' },
}

const primaryBtn = { padding: '8px 18px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#1d1d1f', color: '#fff', fontFamily: 'var(--font)' }
const ghostBtn = { padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontFamily: 'var(--font)' }
const inp = { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 11px', fontSize: 12.5, color: 'var(--text)', fontFamily: 'var(--font)', outline: 'none' }
const lbl = { fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5 }

function AddItemModal({ onClose }) {
  const [form, setForm] = useState({ name: '', cat: 'Controllers', qty: '', onOrder: '', location: '', cost: '', supplier: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 14, width: 500, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px', borderBottom: '1px solid var(--border2)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Add inventory item</div>
          <button onClick={onClose} style={{ background: 'var(--bg4)', border: 'none', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', color: 'var(--text2)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ padding: '18px 22px' }}>
          <div style={{ marginBottom: 12 }}>
            <div style={lbl}>Item name</div>
            <input style={inp} placeholder="e.g. Control4 EA-5" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={lbl}>Category</div>
              <select style={inp} value={form.cat} onChange={e => set('cat', e.target.value)}>
                {CATS.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <div style={lbl}>Supplier</div>
              <input style={inp} placeholder="e.g. SnapOne" value={form.supplier} onChange={e => set('supplier', e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={lbl}>Qty in stock</div>
              <input style={inp} type="number" placeholder="0" value={form.qty} onChange={e => set('qty', e.target.value)} />
            </div>
            <div>
              <div style={lbl}>Qty on order</div>
              <input style={inp} type="number" placeholder="0" value={form.onOrder} onChange={e => set('onOrder', e.target.value)} />
            </div>
            <div>
              <div style={lbl}>Unit cost ($)</div>
              <input style={inp} type="number" placeholder="0" value={form.cost} onChange={e => set('cost', e.target.value)} />
            </div>
          </div>
          <div>
            <div style={lbl}>Location</div>
            <input style={inp} placeholder="e.g. Main warehouse" value={form.location} onChange={e => set('location', e.target.value)} />
          </div>
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border2)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={ghostBtn}>Cancel</button>
          <button style={primaryBtn}>Add item</button>
        </div>
      </div>
    </div>
  )
}

export default function Inventory() {
  const [cat, setCat] = useState('All')
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [tab, setTab] = useState('stock')

  const filtered = INVENTORY.filter(item => {
    const matchCat = cat === 'All' || item.cat === cat
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) || item.supplier.toLowerCase().includes(search.toLowerCase())
    const matchTab = tab === 'stock' ? item.qty > 0 : item.onOrder > 0
    return matchCat && matchSearch && matchTab
  })

  const totalValue = INVENTORY.reduce((a, i) => a + (i.cost * i.qty), 0)
  const onOrderCount = INVENTORY.reduce((a, i) => a + i.onOrder, 0)
  const lowStock = INVENTORY.filter(i => i.status === 'Low stock' || i.status === 'Out of stock').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {showAdd && <AddItemModal onClose={() => setShowAdd(false)} />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Inventory</div>
        <button onClick={() => setShowAdd(true)} style={{ ...primaryBtn, fontSize: 12 }}>+ Add item</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, padding: '14px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
        {[
          { label: 'Stock value', value: '$' + totalValue.toLocaleString(), color: '#248a3d' },
          { label: 'Items on order', value: onOrderCount, color: '#0066cc' },
          { label: 'Low or out of stock', value: lowStock, color: '#c93400' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 9, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
        <div style={{ display: 'flex', padding: '0 24px' }}>
          {[
            { key: 'stock', label: 'In stock (' + INVENTORY.filter(i => i.qty > 0).length + ')' },
            { key: 'order', label: 'On order (' + INVENTORY.filter(i => i.onOrder > 0).length + ')' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '10px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'transparent', color: tab === t.key ? 'var(--accent)' : 'var(--text2)', borderBottom: '2px solid ' + (tab === t.key ? 'var(--accent)' : 'transparent'), fontFamily: 'var(--font)', transition: 'all 0.12s' }}>{t.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '8px 24px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            style={{ flex: 1, minWidth: 200, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', fontSize: 12.5, color: 'var(--text)', fontFamily: 'var(--font)', outline: 'none' }}
            placeholder="Search items..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {CATS.map(c => (
            <button key={c} onClick={() => setCat(c)} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid ' + (cat === c ? 'var(--accent)' : 'var(--border)'), background: cat === c ? 'rgba(0,102,204,0.08)' : 'transparent', color: cat === c ? 'var(--accent)' : 'var(--text2)', fontFamily: 'var(--font)', whiteSpace: 'nowrap' }}>{c}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, marginBottom: 12 }}>{filtered.length} item{filtered.length !== 1 ? 's' : ''}</div>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 0.8fr 0.8fr 1fr 1fr 1fr', padding: '8px 16px', background: 'var(--bg3)', borderBottom: '1px solid var(--border2)' }}>
            {['Item', 'Category', 'In stock', 'On order', 'Location', 'Cost', 'Status'].map(h => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</div>
            ))}
          </div>
          {filtered.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>No items found</div>
          )}
          {filtered.map((item, i) => (
            <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 0.8fr 0.8fr 1fr 1fr 1fr', padding: '11px 16px', borderBottom: i < filtered.length - 1 ? '1px solid var(--border2)' : 'none', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{item.name}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>{item.supplier}</div>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text2)', fontWeight: 500 }}>{item.cat}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: item.qty === 0 ? '#d70015' : item.qty <= 1 ? '#c93400' : 'var(--text)' }}>{item.qty}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: item.onOrder > 0 ? '#0066cc' : 'var(--text3)' }}>{item.onOrder > 0 ? item.onOrder : '—'}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>{item.location}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>${item.cost.toLocaleString()}</div>
              <div>
                <span style={{ padding: '2px 8px', borderRadius: 5, fontSize: 10.5, fontWeight: 700, background: statusStyles[item.status].bg, color: statusStyles[item.status].color }}>{item.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

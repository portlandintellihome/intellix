import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Briefcase, Users, HeadphonesIcon,
  CalendarDays, Wrench, Library, Package,
  Bot, Users2, BarChart2, Plug, Settings, LogOut, Mail, FolderOpen
} from 'lucide-react'
import Dashboard from './Dashboard'
import './index.css'
import JobsProposals from './JobsProposals'
import Clients from './Clients'
import SupportTickets from './SupportTickets'
import CalendarPage from './Calendar'
import ComposerBuilds from './ComposerBuilds'
import DriverLibrary from './DriverLibrary'
import Inventory from './Inventory'
import IntelixAssist from './IntelixAssist'
import Team from './Team'
import Reporting from './Reporting'
import Integrations from './Integrations'
import SettingsPage from './Settings'
import Outreach from './Outreach'
import HomeDoc from './HomeDoc'
import Login from './Login'
import ChangePassword from './ChangePassword'

const TOKEN_KEY = 'intellix_token'




const NAV = [
  { section: 'Main' },
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/jobs', label: 'Jobs & proposals', icon: Briefcase },
  { path: '/clients', label: 'Clients', icon: Users },
  { path: '/tickets', label: 'Support tickets', icon: HeadphonesIcon },
  { path: '/calendar', label: 'Calendar', icon: CalendarDays },
  { path: '/outreach', label: 'Outreach', icon: Mail },
  { section: 'Workspace' },
  { path: '/composer', label: 'Composer builds', icon: Wrench },
  { path: '/drivers', label: 'Driver library', icon: Library },
  { path: '/inventory', label: 'Inventory', icon: Package },
  { path: '/homedoc', label: 'HomeDoc', icon: FolderOpen },
  { path: '/assist', label: 'Intellix Assist', icon: Bot },
  { section: 'Admin' },
  { path: '/team', label: 'Team', icon: Users2 },
  { path: '/reporting', label: 'Reporting', icon: BarChart2 },
  { path: '/integrations', label: 'Integrations & APIs', icon: Plug },
  { path: '/settings', label: 'Settings', icon: Settings },
]

function Placeholder({ title }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '13px 24px', background: 'var(--bg2)',
        borderBottom: '1px solid var(--border2)', flexShrink: 0
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13, fontWeight: 500 }}>
        {title} — coming soon
      </div>
    </div>
  )
}

function initialsOf(name) {
  if (!name) return '?'
  return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function App() {
  const [dark, setDark] = useState(false)
  const [user, setUser] = useState(null)
  const [authChecking, setAuthChecking] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) { setAuthChecking(false); return }
    const base = import.meta.env.VITE_API_URL || ''
    fetch(`${base}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async res => {
        if (!res.ok) throw new Error('invalid')
        setUser(await res.json())
      })
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setAuthChecking(false))
  }, [])

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }

  if (authChecking) {
    return (
      <div className={dark ? 'dark' : ''} style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text3)', fontSize: 13, fontFamily: 'var(--font)' }}>
        Loading…
      </div>
    )
  }

  if (!user) {
    return (
      <div className={dark ? 'dark' : ''}>
        <Login onLogin={setUser} />
      </div>
    )
  }

  if (user.must_change_password) {
    return (
      <div className={dark ? 'dark' : ''}>
        <ChangePassword user={user} onDone={setUser} onLogout={logout} />
      </div>
    )
  }

  return (
    <div className={dark ? 'dark' : ''} style={{ height: '100vh', display: 'flex', background: 'var(--bg)' }}>
      <BrowserRouter>
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* SIDEBAR */}
          <div style={{
            width: 220, minWidth: 220, background: 'var(--bg2)',
            borderRight: '1px solid var(--border2)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            <div style={{ padding: '22px 18px 14px' }}>
  <svg viewBox="0 0 160 52" width="140" height="46" xmlns="http://www.w3.org/2000/svg">
    <text
      x="0" y="34"
      fontFamily="Montserrat, sans-serif"
      fontWeight="700"
      fontSize="36"
      letterSpacing="-1"
      fill={dark ? '#e8eaf0' : '#1d1d1f'}
    >
      intelli
    </text>
    <text
      x="101" y="34"
      fontFamily="Montserrat, sans-serif"
      fontWeight="700"
      fontSize="36"
      letterSpacing="-1"
      fill={dark ? '#3b7cff' : '#0066cc'}
    >
      x
    </text>
    <line
      x1="0" y1="39"
      x2="148" y2="39"
      stroke={dark ? '#ffffff22' : '#00000018'}
      strokeWidth="0.75"
    />
    <circle cx="3" cy="44" r="2.5" fill="#34c759" />
    <circle cx="11" cy="44" r="2.5" fill="#ff9500" />
    <circle cx="19" cy="44" r="2.5" fill="#ff3b30" />
    <circle cx="27" cy="44" r="2.5" fill="#0066cc" />
    <text
      x="35" y="48"
      fontFamily="Montserrat, sans-serif"
      fontWeight="500"
      fontSize="6.5"
      letterSpacing="2.2"
      fill={dark ? '#4a5568' : '#aeaeb2'}
    >
      HOME AUTOMATION HUB
    </text>
  </svg>
</div>

            <nav style={{ flex: 1, padding: '4px 10px', overflowY: 'auto' }}>
              {NAV.map((item, i) => {
                if (item.section) return (
                  <div key={i} style={{
                    fontSize: 10, fontWeight: 600, color: 'var(--text3)',
                    padding: '14px 8px 5px', textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>{item.section}</div>
                )
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    style={({ isActive }) => ({
                      display: 'flex', alignItems: 'center', gap: 9,
                      padding: '8px 10px', borderRadius: 8, marginBottom: 1,
                      fontSize: 12.5, fontWeight: isActive ? 600 : 500,
                      color: isActive ? 'var(--accent)' : 'var(--text2)',
                      background: isActive ? 'rgba(0,102,204,0.08)' : 'transparent',
                      textDecoration: 'none', transition: 'all 0.12s'
                    })}
                  >
                    <Icon size={15} strokeWidth={1.8} />
                    {item.label}
                  </NavLink>
                )
              })}
            </nav>

            <div style={{
              padding: 12, borderTop: '1px solid var(--border2)',
              display: 'flex', alignItems: 'center', gap: 6
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--accent)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: '#fff'
              }}>{initialsOf(user.name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
                <div style={{ fontSize: 9.5, color: 'var(--text3)' }}>{user.role}</div>
              </div>
              <button
                onClick={() => setDark(!dark)}
                title={dark ? 'Light mode' : 'Dark mode'}
                style={{
                  width: 26, height: 26, borderRadius: 7,
                  background: 'var(--bg3)', border: '1px solid var(--border2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--text2)', flexShrink: 0
                }}
              >
                {dark
                  ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                  : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
                }
              </button>
              <button
                onClick={logout}
                title="Sign out"
                style={{
                  width: 26, height: 26, borderRadius: 7,
                  background: 'var(--bg3)', border: '1px solid var(--border2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--text2)', flexShrink: 0
                }}
              >
                <LogOut size={12} strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* MAIN CONTENT */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Routes>
              <Route path="/" element={<Dashboard setupDone={false} />} />
              <Route path="/jobs" element={<JobsProposals />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/tickets" element={<SupportTickets />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/outreach" element={<Outreach />} />
              <Route path="/homedoc" element={<HomeDoc />} />
              <Route path="/homedoc/:id" element={<HomeDoc />} />
              <Route path="/composer" element={<ComposerBuilds />} />
              <Route path="/drivers" element={<DriverLibrary />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/assist" element={<IntelixAssist />} />
              <Route path="/team" element={<Team />} />
              <Route path="/reporting" element={<Reporting />} />
              <Route path="/integrations" element={<Integrations />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </div>

        </div>
      </BrowserRouter>
    </div>
  )
}
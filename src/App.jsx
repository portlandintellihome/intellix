import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom'
import {
  LayoutDashboard, Briefcase, Users, HeadphonesIcon,
  CalendarDays, Wrench, Library, Package,
  Bot, Users2, BarChart2, Plug, Settings, LogOut, Mail, FolderOpen,
  Menu, X
} from 'lucide-react'
import './index.css'
import Login from './Login'
import ChangePassword from './ChangePassword'
import ForgotPassword from './ForgotPassword'
import ResetPassword from './ResetPassword'
import { useIsMobile } from './lib/useIsMobile'

const Dashboard = lazy(() => import('./Dashboard'))
const JobsProposals = lazy(() => import('./JobsProposals'))
const Clients = lazy(() => import('./Clients'))
const SupportTickets = lazy(() => import('./SupportTickets'))
const CalendarPage = lazy(() => import('./Calendar'))
const ComposerBuilds = lazy(() => import('./ComposerBuilds'))
const DriverLibrary = lazy(() => import('./DriverLibrary'))
const Inventory = lazy(() => import('./Inventory'))
const IntelixAssist = lazy(() => import('./IntelixAssist'))
const Team = lazy(() => import('./Team'))
const Reporting = lazy(() => import('./Reporting'))
const Integrations = lazy(() => import('./Integrations'))
const SettingsPage = lazy(() => import('./Settings'))
const Outreach = lazy(() => import('./Outreach'))
const HomeDoc = lazy(() => import('./HomeDoc'))

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

// Role-based access. Admin sees everything; other roles get an explicit
// allowlist of route paths. The user's role comes from the user object
// loaded by /api/auth/me on mount — the JWT only carries id+email so we
// rely on the freshly-fetched role from the server.
const ROLE_ACCESS = {
  Admin: '*',
  Programmer: new Set(['/', '/jobs', '/composer', '/drivers', '/homedoc', '/assist', '/todo']),
  Technician: new Set(['/', '/jobs', '/tickets', '/calendar', '/composer', '/todo']),
}

function canAccess(role, path) {
  if (role === 'Admin') return true
  const allowed = ROLE_ACCESS[role]
  if (allowed) return allowed.has(path)
  // Unknown role (legacy "Employee" etc.) — default to Dashboard only.
  return path === '/'
}

// Filter NAV: drop items the role can't see, then drop section headers
// whose entire group has been emptied.
function visibleNav(role) {
  const filtered = NAV.filter(item => item.section || canAccess(role, item.path))
  return filtered.filter((item, i) => {
    if (!item.section) return true
    const next = filtered[i + 1]
    return next && !next.section
  })
}

const BOTTOM_NAV = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { path: '/jobs', label: 'Jobs', icon: Briefcase },
  { path: '/composer', label: 'Composer', icon: Wrench },
  { path: '/calendar', label: 'Calendar', icon: CalendarDays },
  { path: '/assist', label: 'Assist', icon: Bot },
]

function initialsOf(name) {
  if (!name) return '?'
  return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function IntellixLogo({ dark, compact = false }) {
  if (compact) {
    return (
      <svg viewBox="0 0 100 24" width={88} height={22} xmlns="http://www.w3.org/2000/svg" aria-label="Intellix">
        <text x="0" y="18" fontFamily="Montserrat, sans-serif" fontWeight="700" fontSize="20" letterSpacing="-0.5" fill={dark ? '#e8eaf0' : '#1d1d1f'}>intelli</text>
        <text x="56" y="18" fontFamily="Montserrat, sans-serif" fontWeight="700" fontSize="20" letterSpacing="-0.5" fill={dark ? '#3b7cff' : '#0066cc'}>x</text>
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 160 52" width={140} height={46} xmlns="http://www.w3.org/2000/svg" aria-label="Intellix">
      <text x="0" y="34" fontFamily="Montserrat, sans-serif" fontWeight="700" fontSize="36" letterSpacing="-1" fill={dark ? '#e8eaf0' : '#1d1d1f'}>intelli</text>
      <text x="101" y="34" fontFamily="Montserrat, sans-serif" fontWeight="700" fontSize="36" letterSpacing="-1" fill={dark ? '#3b7cff' : '#0066cc'}>x</text>
      <line x1="0" y1="39" x2="148" y2="39" stroke={dark ? '#ffffff22' : '#00000018'} strokeWidth="0.75" />
      <circle cx="3" cy="44" r="2.5" fill="#34c759" />
      <circle cx="11" cy="44" r="2.5" fill="#ff9500" />
      <circle cx="19" cy="44" r="2.5" fill="#ff3b30" />
      <circle cx="27" cy="44" r="2.5" fill="#0066cc" />
      <text x="35" y="48" fontFamily="Montserrat, sans-serif" fontWeight="500" fontSize="6.5" letterSpacing="2.2" fill={dark ? '#4a5568' : '#aeaeb2'}>HOME AUTOMATION HUB</text>
    </svg>
  )
}

function AppShell({ user, dark, setDark, logout }) {
  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  // Assist on mobile takes over the full screen (like a native chat app):
  // no bottom nav, no reserved padding. Keyboard rises naturally into the
  // collapsed viewport instead of fighting with a fixed nav bar.
  const assistFullScreen = isMobile && location.pathname === '/assist'
  const nav = visibleNav(user.role)
  const bottomNav = BOTTOM_NAV.filter(item => canAccess(user.role, item.path))
  const guard = (path, element) => canAccess(user.role, path) ? element : <Navigate to="/" replace />

  // Close mobile sidebar whenever the route changes.
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  // If the viewport grows back to desktop, make sure the overlay isn't stuck open.
  useEffect(() => {
    if (!isMobile) setSidebarOpen(false)
  }, [isMobile])

  const closeSidebar = () => setSidebarOpen(false)

  const sidebarStyle = isMobile
    ? {
        position: 'fixed', top: 0, left: 0, bottom: 0, right: 0,
        zIndex: 100, background: 'var(--bg2)',
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.22s ease',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }
    : {
        width: 220, minWidth: 220, background: 'var(--bg2)',
        borderRight: '1px solid var(--border2)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }

  const iconBtn = (size = 32) => ({
    width: size, height: size, borderRadius: 7,
    background: 'var(--bg3)', border: '1px solid var(--border2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: 'var(--text2)', flexShrink: 0, padding: 0,
  })

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      background: 'var(--bg)',
    }}>

      {/* Mobile topbar */}
      {isMobile && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px',
          paddingTop: 'max(8px, env(safe-area-inset-top))',
          background: 'var(--bg2)',
          borderBottom: '1px solid var(--border2)',
          flexShrink: 0, zIndex: 80,
        }}>
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            style={{
              width: 44, height: 44,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text)', padding: 0,
            }}
          >
            <Menu size={22} strokeWidth={2} />
          </button>
          <IntellixLogo dark={dark} compact />
          <div style={{ width: 44 }} />
        </div>
      )}

      {/* Mobile backdrop */}
      {isMobile && sidebarOpen && (
        <div
          onClick={closeSidebar}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside style={sidebarStyle} aria-hidden={isMobile && !sidebarOpen}>

        {/* Mobile close button */}
        {isMobile && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 14px 0' }}>
            <button
              onClick={closeSidebar}
              aria-label="Close menu"
              style={{
                width: 44, height: 44,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10,
                cursor: 'pointer', color: 'var(--text2)', padding: 0,
              }}
            >
              <X size={20} strokeWidth={2} />
            </button>
          </div>
        )}

        <div style={{ padding: isMobile ? '4px 22px 14px' : '22px 18px 14px' }}>
          <IntellixLogo dark={dark} />
        </div>

        <nav style={{ flex: 1, padding: '4px 10px', overflowY: 'auto' }}>
          {nav.map((item, i) => {
            if (item.section) return (
              <div key={i} style={{
                fontSize: 10, fontWeight: 600, color: 'var(--text3)',
                padding: '14px 8px 5px', textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>{item.section}</div>
            )
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: isMobile ? '12px 12px' : '8px 10px',
                  borderRadius: 8, marginBottom: isMobile ? 2 : 1,
                  fontSize: isMobile ? 14 : 12.5,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--accent)' : 'var(--text2)',
                  background: isActive ? 'rgba(0,102,204,0.08)' : 'transparent',
                  textDecoration: 'none', transition: 'all 0.12s',
                  minHeight: isMobile ? 44 : undefined,
                })}
              >
                <Icon size={isMobile ? 18 : 15} strokeWidth={1.8} />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        <div style={{
          padding: 12, borderTop: '1px solid var(--border2)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{
            width: isMobile ? 36 : 28, height: isMobile ? 36 : 28,
            minWidth: isMobile ? 36 : 28, borderRadius: '50%',
            background: 'var(--accent)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: isMobile ? 12 : 10, fontWeight: 700, color: '#fff',
          }}>{initialsOf(user.name)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? 13 : 11.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
            <div style={{ fontSize: isMobile ? 11 : 9.5, color: 'var(--text3)' }}>{user.role}</div>
          </div>
          <button
            onClick={() => setDark(!dark)}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            style={iconBtn(isMobile ? 40 : 28)}
          >
            {dark
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>}
          </button>
          <button
            onClick={logout}
            aria-label="Sign out"
            style={iconBtn(isMobile ? 40 : 28)}
          >
            <LogOut size={14} strokeWidth={2} />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{
        flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0,
        paddingBottom: (isMobile && !assistFullScreen) ? 'calc(56px + env(safe-area-inset-bottom))' : 0,
      }}>
        <Suspense fallback={
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13, fontFamily: 'var(--font)' }}>Loading…</div>
        }>
          <Routes>
            <Route path="/" element={guard('/', <Dashboard setupDone={false} />)} />
            <Route path="/jobs" element={guard('/jobs', <JobsProposals />)} />
            <Route path="/clients" element={guard('/clients', <Clients />)} />
            <Route path="/tickets" element={guard('/tickets', <SupportTickets />)} />
            <Route path="/calendar" element={guard('/calendar', <CalendarPage />)} />
            <Route path="/outreach" element={guard('/outreach', <Outreach />)} />
            <Route path="/homedoc" element={guard('/homedoc', <HomeDoc />)} />
            <Route path="/homedoc/:id" element={guard('/homedoc', <HomeDoc />)} />
            <Route path="/composer" element={guard('/composer', <ComposerBuilds />)} />
            <Route path="/drivers" element={guard('/drivers', <DriverLibrary />)} />
            <Route path="/inventory" element={guard('/inventory', <Inventory />)} />
            <Route path="/assist" element={guard('/assist', <IntelixAssist />)} />
            <Route path="/team" element={guard('/team', <Team />)} />
            <Route path="/reporting" element={guard('/reporting', <Reporting />)} />
            <Route path="/integrations" element={guard('/integrations', <Integrations />)} />
            <Route path="/settings" element={guard('/settings', <SettingsPage />)} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

      {/* Mobile bottom nav — hidden on /assist so the chat UI owns the full
          screen (no bar floating between the input and the keyboard on iOS). */}
      {isMobile && !assistFullScreen && (
        <nav style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          background: 'var(--bg2)',
          borderTop: '1px solid var(--border2)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          zIndex: 80,
        }}>
          {bottomNav.map(item => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                style={({ isActive }) => ({
                  flex: 1,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 3,
                  padding: '8px 4px',
                  minHeight: 56,
                  textDecoration: 'none',
                  color: isActive ? 'var(--accent)' : 'var(--text2)',
                  fontFamily: 'var(--font)',
                })}
              >
                <Icon size={20} strokeWidth={2} />
                <span style={{ fontSize: 10.5, fontWeight: 600 }}>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
      )}
    </div>
  )
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

  // Keep html element in sync with the in-app theme toggle so html/body
  // (which sit outside the app wrapper) pick up the correct --bg value.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }

  return (
    <div className={dark ? 'dark' : ''}>
      <BrowserRouter>
        <AppRouter
          user={user}
          setUser={setUser}
          dark={dark}
          setDark={setDark}
          authChecking={authChecking}
          logout={logout}
        />
      </BrowserRouter>
    </div>
  )
}

function AppRouter({ user, setUser, dark, setDark, authChecking, logout }) {
  const location = useLocation()

  // Public auth-flow pages — accessible whether logged in or not, so the
  // user can recover from an unknown-password situation without first
  // signing in. Render before any auth gate.
  if (location.pathname === '/forgot-password') return <ForgotPassword />
  if (location.pathname === '/reset-password') return <ResetPassword />

  if (authChecking) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text3)', fontSize: 13, fontFamily: 'var(--font)' }}>
        Loading…
      </div>
    )
  }
  if (!user) return <Login onLogin={setUser} />
  if (user.must_change_password) return <ChangePassword user={user} onDone={setUser} onLogout={logout} />

  return <AppShell user={user} dark={dark} setDark={setDark} logout={logout} />
}

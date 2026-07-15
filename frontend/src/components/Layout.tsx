import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Bell,
  CalendarDays,
  FileText,
  Inbox,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  Menu,
  MessageSquareWarning,
  ScrollText,
  Search,
  Settings,
  X,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { getCurrentWeeklyCycle, listAppeals } from '../api/endpoints'
import { Avatar, Badge, IconButton, cn } from './ui'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const AGENT_NAV: NavItem[] = [
  { to: '/agent', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/agent/requests', label: 'My Requests', icon: FileText },
  { to: '/agent/appeals', label: 'My Appeals', icon: MessageSquareWarning },
  { to: '/agent/audit', label: 'Audit Trail', icon: ScrollText },
]

const MANAGER_NAV: NavItem[] = [
  { to: '/manager', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/manager/requests', label: 'Requests', icon: Inbox },
  { to: '/manager/roster', label: 'Roster', icon: CalendarDays },
  { to: '/manager/appeals', label: 'Appeals', icon: MessageSquareWarning },
  { to: '/manager/config', label: 'Configuration', icon: Settings },
  { to: '/manager/audit', label: 'Audit Log', icon: ScrollText },
]

function SidebarLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-2.5 rounded-btn px-2.5 py-[7px] text-[13px] font-medium transition-colors',
          isActive ? 'bg-accent-subtle text-accent-subtle-fg' : 'text-ink-secondary hover:bg-surface-hover hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn('size-[18px] shrink-0', isActive ? 'text-accent' : 'text-ink-muted group-hover:text-ink-secondary')} strokeWidth={2} />
          {item.label}
        </>
      )}
    </NavLink>
  )
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-8 items-center justify-center rounded-[9px] bg-accent text-accent-fg shadow-xs">
        <CalendarDays className="size-[18px]" strokeWidth={2.25} />
      </div>
      <div className="leading-tight">
        <div className="text-[13px] font-semibold tracking-[-0.01em] text-ink">CallRoster</div>
        <div className="text-[11px] text-ink-muted">Workforce Ops</div>
      </div>
    </div>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { role } = useAuth()
  const nav = role === 'manager' ? MANAGER_NAV : role === 'agent' ? AGENT_NAV : []
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center px-4">
        <BrandMark />
      </div>
      <nav className="scroll-thin flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">General</p>
        <SidebarLink item={{ to: '/', label: 'Published Roster', icon: CalendarDays, end: true }} onNavigate={onNavigate} />
        {nav.length > 0 && (
          <>
            <p className="px-2.5 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
              {role === 'manager' ? 'Manage' : 'My workspace'}
            </p>
            {nav.map((item) => (
              <SidebarLink key={item.to} item={item} onNavigate={onNavigate} />
            ))}
          </>
        )}
      </nav>
    </div>
  )
}

function CurrentWeekPill() {
  const { data } = useQuery({ queryKey: ['current-cycle-header'], queryFn: getCurrentWeeklyCycle, retry: false })
  if (!data) return null
  const monday = new Date(`${data.week_start_date}T00:00:00`)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return (
    <div className="hidden items-center gap-2 rounded-input border border-line bg-surface px-2.5 py-1.5 md:flex">
      <CalendarDays className="size-4 text-ink-muted" />
      <span className="text-[13px] font-medium text-ink">
        {fmt(monday)} – {fmt(sunday)}
      </span>
      <Badge tone={data.status === 'locked' ? 'neutral' : data.status === 'published' ? 'info' : 'accent'}>
        {data.status}
      </Badge>
    </div>
  )
}

function NotificationsBell() {
  const { role } = useAuth()
  const { data } = useQuery({
    queryKey: ['pending-appeals-count'],
    queryFn: () => listAppeals('pending'),
    enabled: role === 'manager',
    retry: false,
  })
  const count = data?.length ?? 0
  return (
    <div className="relative">
      <IconButton icon={Bell} label="Notifications" />
      {count > 0 && (
        <span className="absolute right-1 top-1 flex size-[9px] items-center justify-center">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#dc2626] opacity-60" />
          <span className="relative inline-flex size-[7px] rounded-full bg-[#dc2626]" />
        </span>
      )}
    </div>
  )
}

function ProfileMenu() {
  const { role, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const label = role === 'manager' ? 'Manager' : 'Agent'
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className="flex items-center gap-2 rounded-btn py-1 pl-1 pr-2 transition-colors hover:bg-surface-hover"
      >
        <Avatar name={label} size={28} />
        <span className="hidden text-[13px] font-medium text-ink sm:block">{label}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-40 w-44 rounded-input border border-line bg-surface p-1 shadow-pop">
          <div className="px-2.5 py-2">
            <p className="text-[13px] font-medium text-ink">{label} account</p>
            <p className="text-xs text-ink-muted">Signed in</p>
          </div>
          <div className="my-1 h-px bg-line" />
          <button
            onMouseDown={logout}
            className="flex w-full items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-[13px] text-ink-secondary hover:bg-surface-hover hover:text-ink"
          >
            <LogOut className="size-4" /> Log out
          </button>
        </div>
      )}
    </div>
  )
}

export default function Layout() {
  const { isAuthenticated } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  // Unauthenticated: slim top bar, centred content (login + public roster).
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen">
        <header className="sticky top-0 z-30 border-b border-line bg-surface/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
            <NavLink to="/">
              <BrandMark />
            </NavLink>
            <NavLink
              to="/login"
              className="inline-flex h-8 items-center rounded-btn bg-accent px-3.5 text-[13px] font-medium text-accent-fg shadow-xs transition-colors hover:bg-accent-hover"
            >
              Log in
            </NavLink>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
          <Outlet />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[236px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen border-r border-line bg-surface lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-[1px]" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 border-r border-line bg-surface shadow-pop">
            <div className="absolute right-2 top-3">
              <IconButton icon={X} label="Close menu" onClick={() => setMobileOpen(false)} size="sm" />
            </div>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        {/* Top header */}
        <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <button
              onClick={() => setMobileOpen(true)}
              className="inline-flex size-8 items-center justify-center rounded-btn text-ink-muted hover:bg-surface-hover hover:text-ink lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>

            {/* Search */}
            <div className="relative hidden max-w-md flex-1 sm:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
              <input
                type="search"
                placeholder="Search agents, shifts, requests…"
                className="h-8 w-full rounded-input border border-line bg-surface-muted pl-9 pr-3 text-[13px] text-ink placeholder:text-ink-subtle focus:border-accent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent-ring/50"
              />
            </div>

            <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
              <CurrentWeekPill />
              <NotificationsBell />
              <div className="hidden h-6 w-px bg-line sm:block" />
              <ProfileMenu />
            </div>
          </div>
        </header>

        <main key={location.pathname} className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

import { Link, Outlet, useLocation } from 'react-router-dom'
import { PageTitle, cn } from '../../../components/ui'

const TABS = [
  { to: '/manager/config/skills', label: 'Skills' },
  { to: '/manager/config/shifts', label: 'Shift Templates' },
  { to: '/manager/config/coverage', label: 'Coverage' },
  { to: '/manager/config/agents', label: 'Agents' },
  { to: '/manager/config/leave-balances', label: 'Leave Balances' },
  { to: '/manager/config/weekly-cycles', label: 'Weekly Cycles' },
  { to: '/manager/config/solver', label: 'Solver Weights' },
]

export default function ConfigHome() {
  const location = useLocation()
  // The index route renders SkillsConfig, so treat /config and /config/skills alike.
  const active = location.pathname === '/manager/config' ? '/manager/config/skills' : location.pathname
  return (
    <div>
      <PageTitle subtitle="Everything here is call-center-specific — nothing is hardcoded.">Configuration</PageTitle>
      <div className="scroll-thin mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => {
          const isActive = active === t.to
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                '-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-medium transition-colors',
                isActive
                  ? 'border-accent text-ink'
                  : 'border-transparent text-ink-muted hover:border-line-strong hover:text-ink',
              )}
            >
              {t.label}
            </Link>
          )
        })}
      </div>
      <Outlet />
    </div>
  )
}

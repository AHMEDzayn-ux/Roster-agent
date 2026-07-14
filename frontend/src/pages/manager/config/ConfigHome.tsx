import { Link, Outlet, useLocation } from 'react-router-dom'
import { PageTitle } from '../../../components/ui'

const TABS = [
  { to: '/manager/config/skills', label: 'Skills' },
  { to: '/manager/config/shifts', label: 'Shift Templates' },
  { to: '/manager/config/coverage', label: 'Coverage Requirements' },
  { to: '/manager/config/agents', label: 'Agents' },
  { to: '/manager/config/leave-balances', label: 'Leave Balances' },
  { to: '/manager/config/weekly-cycles', label: 'Weekly Cycles' },
  { to: '/manager/config/solver', label: 'Solver Weights' },
]

export default function ConfigHome() {
  const location = useLocation()
  return (
    <div>
      <PageTitle subtitle="Everything here is call-center-specific — nothing is hardcoded.">Configuration</PageTitle>
      <div className="mb-5 flex flex-wrap gap-1 border-b border-slate-200 pb-2">
        {TABS.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              location.pathname === t.to ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <Outlet />
    </div>
  )
}

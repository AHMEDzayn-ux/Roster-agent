import { Link } from 'react-router-dom'
import { Card, PageTitle } from '../../components/ui'

const LINKS = [
  { to: '/manager/requests', label: 'Requests Inbox', desc: 'Review and triage weekly requests' },
  { to: '/manager/roster', label: 'Roster', desc: 'Generate, review, export/import, publish & lock' },
  { to: '/manager/appeals', label: 'Appeals Inbox', desc: 'Review agent appeals of denied requests' },
  { to: '/manager/config', label: 'Configuration', desc: 'Skills, agents, shifts, coverage, solver weights' },
  { to: '/manager/audit', label: 'Audit Log', desc: 'Full history of manual overrides and appeal decisions' },
]

export default function ManagerDashboard() {
  return (
    <div>
      <PageTitle subtitle="Everything needed to run the weekly roster cycle.">Manager Dashboard</PageTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        {LINKS.map((l) => (
          <Link key={l.to} to={l.to}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <h2 className="font-medium text-slate-900">{l.label}</h2>
              <p className="mt-1 text-sm text-slate-500">{l.desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

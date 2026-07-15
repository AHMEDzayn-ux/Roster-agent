import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  CalendarClock,
  CalendarPlus,
  CircleGauge,
  ClipboardList,
  MessageSquareWarning,
  Settings,
  UserCheck,
  Users,
} from 'lucide-react'
import {
  getCurrentPublicRoster,
  getCurrentWeeklyCycle,
  listAgents,
  listAppeals,
  listRequestsForWeek,
} from '../../api/endpoints'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageTitle,
  StatTile,
  StatusBadge,
  cn,
} from '../../components/ui'
import { OffChip, RosterGrid, ShiftChip, ShiftLegend, localISO } from '../../components/RosterGrid'
import { REQUEST_TYPE_LABELS } from '../../components/ui'
import { SHIFT_COLORS, compactShiftRange } from '../../lib/rosterGrid'
import type { PublicAssignment } from '../../types'

const LEAVE_TYPES = new Set(['leave_full', 'leave_half', 'leave_multi'])

export default function ManagerDashboard() {
  const agentsQuery = useQuery({ queryKey: ['agents'], queryFn: listAgents })
  const rosterQuery = useQuery({ queryKey: ['public-roster', ''], queryFn: getCurrentPublicRoster, retry: false })
  const cycleQuery = useQuery({ queryKey: ['current-cycle'], queryFn: getCurrentWeeklyCycle, retry: false })
  const appealsQuery = useQuery({ queryKey: ['appeals', 'pending'], queryFn: () => listAppeals('pending'), retry: false })

  const requestsQuery = useQuery({
    queryKey: ['requests-for-week', cycleQuery.data?.id],
    queryFn: () => listRequestsForWeek(cycleQuery.data!.id),
    enabled: Boolean(cycleQuery.data?.id),
  })

  const today = localISO(new Date())
  const assignments = rosterQuery.data?.assignments ?? []

  // ---- derived metrics (all from real endpoint data) ----
  const activeAgents = (agentsQuery.data ?? []).filter((a) => a.active).length
  const scheduledToday = assignments.filter((a) => a.date === today).length
  const offToday = Math.max(activeAgents - scheduledToday, 0)
  const staffedPct = activeAgents ? Math.round((scheduledToday / activeAgents) * 100) : 0

  const pendingRequests = (requestsQuery.data ?? []).filter((r) => r.status === 'pending')
  const leaveRequests = (requestsQuery.data ?? []).filter((r) => LEAVE_TYPES.has(r.request_type))
  const pendingAppeals = appealsQuery.data?.length ?? 0

  const agentName = (id: number) => agentsQuery.data?.find((a) => a.id === id)?.name ?? `Agent #${id}`

  // ---- roster preview grid ----
  const gridDays = useMemo(
    () => [...new Set(assignments.map((a) => a.date))].sort((a, b) => a.localeCompare(b)),
    [assignments],
  )
  const gridRows = useMemo(
    () =>
      [...new Set(assignments.map((a) => a.agent_name))]
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({ key: name, name })),
    [assignments],
  )
  const byAgentDate = useMemo(() => {
    const map = new Map<string, PublicAssignment>()
    for (const a of assignments) map.set(`${a.agent_name}|${a.date}`, a)
    return map
  }, [assignments])

  const warnings: { tone: 'warning' | 'info'; text: string }[] = []
  if (!cycleQuery.data) warnings.push({ tone: 'warning', text: 'No weekly cycle is currently open for requests.' })
  if (!rosterQuery.data) warnings.push({ tone: 'info', text: 'No roster has been published for the current week yet.' })
  if (pendingAppeals > 0) warnings.push({ tone: 'info', text: `${pendingAppeals} appeal${pendingAppeals === 1 ? '' : 's'} awaiting your response.` })
  if (pendingRequests.length > 0)
    warnings.push({ tone: 'warning', text: `${pendingRequests.length} request${pendingRequests.length === 1 ? '' : 's'} still to triage.` })

  return (
    <div>
      <PageTitle
        subtitle="Operational overview of the current weekly cycle — staffing, requests and approvals."
        actions={
          <>
            <Link to="/manager/requests">
              <Button variant="secondary" size="md" icon={ClipboardList}>
                Requests
              </Button>
            </Link>
            <Link to="/manager/roster">
              <Button size="md" icon={CalendarPlus}>
                Open roster
              </Button>
            </Link>
          </>
        }
      >
        Dashboard
      </PageTitle>

      {/* Quick metrics */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Active agents" value={activeAgents} icon={Users} loading={agentsQuery.isLoading} />
        <StatTile label="Scheduled today" value={scheduledToday} icon={UserCheck} tone="success" loading={rosterQuery.isLoading} />
        <StatTile label="Off today" value={offToday} icon={CalendarClock} loading={rosterQuery.isLoading || agentsQuery.isLoading} />
        <StatTile
          label="Open requests"
          value={pendingRequests.length}
          icon={ClipboardList}
          tone={pendingRequests.length ? 'warning' : 'neutral'}
          loading={requestsQuery.isLoading}
        />
        <StatTile
          label="Pending appeals"
          value={pendingAppeals}
          icon={MessageSquareWarning}
          tone={pendingAppeals ? 'critical' : 'neutral'}
          loading={appealsQuery.isLoading}
        />
        <StatTile
          label="Staffed today"
          value={`${staffedPct}%`}
          icon={CircleGauge}
          tone={staffedPct >= 80 ? 'success' : staffedPct >= 50 ? 'warning' : 'critical'}
          hint={`${scheduledToday} of ${activeAgents} agents`}
        />
      </div>

      {/* Main layout: roster (70%) + context sidebar (30%) */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0">
          <Card padded={false}>
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <h2 className="text-[13px] font-semibold text-ink">This week's roster</h2>
                {rosterQuery.data && <StatusBadge status={rosterQuery.data.status} />}
              </div>
              <ShiftLegend entries={Object.entries(SHIFT_COLORS) as [string, string][]} />
            </div>
            {gridDays.length === 0 ? (
              <div className="p-4 pt-0">
                <EmptyState
                  title="No published roster"
                  text="Generate and publish a roster from the Roster workspace to see the weekly schedule here."
                  icon={CalendarPlus}
                  action={
                    <Link to="/manager/roster">
                      <Button size="md" icon={CalendarPlus}>
                        Go to roster
                      </Button>
                    </Link>
                  }
                />
              </div>
            ) : (
              <div className="p-2 pt-0">
                <RosterGrid
                  days={gridDays}
                  rows={gridRows}
                  maxHeight="calc(100vh - 340px)"
                  renderCell={(agent, day) => {
                    const a = byAgentDate.get(`${agent}|${day}`)
                    if (!a) return <OffChip />
                    return (
                      <ShiftChip
                        label={compactShiftRange(a.shift_start, a.shift_end)}
                        colorClass={SHIFT_COLORS[a.shift_name]}
                        title={`${a.shift_name} (${a.shift_start}–${a.shift_end}) — ${a.skill_name}`}
                      />
                    )
                  }}
                />
              </div>
            )}
          </Card>
        </section>

        <aside className="flex flex-col gap-5">
          {/* Warnings / insights */}
          <Card>
            <CardHeader title="Attention" description="What needs a decision this cycle" />
            {warnings.length === 0 ? (
              <p className="text-[13px] text-ink-muted">Everything is up to date. Nothing needs your attention.</p>
            ) : (
              <ul className="space-y-2">
                {warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-ink-secondary">
                    <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', w.tone === 'warning' ? 'bg-warning' : 'bg-info')} />
                    {w.text}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Pending requests / approvals */}
          <Card>
            <CardHeader
              title="Requests to triage"
              actions={
                <Link to="/manager/requests" className="text-xs font-medium text-accent hover:text-accent-hover">
                  View all
                </Link>
              }
            />
            {pendingRequests.length === 0 ? (
              <p className="text-[13px] text-ink-muted">No pending requests for the current week.</p>
            ) : (
              <ul className="divide-y divide-line">
                {pendingRequests.slice(0, 5).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-ink">{agentName(r.agent_id)}</p>
                      <p className="truncate text-xs text-ink-muted">
                        {REQUEST_TYPE_LABELS[r.request_type]} · {r.requested_start_date}
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Quick actions */}
          <Card>
            <CardHeader title="Quick actions" />
            <div className="grid grid-cols-1 gap-1.5">
              <QuickAction to="/manager/roster" icon={CalendarPlus} label="Generate & publish roster" />
              <QuickAction to="/manager/requests" icon={ClipboardList} label="Review weekly requests" badge={pendingRequests.length || undefined} />
              <QuickAction to="/manager/appeals" icon={MessageSquareWarning} label="Respond to appeals" badge={pendingAppeals || undefined} />
              <QuickAction to="/manager/config" icon={Settings} label="Configuration" />
            </div>
            {leaveRequests.length > 0 && (
              <p className="mt-3 border-t border-line pt-3 text-xs text-ink-muted">
                {leaveRequests.length} leave request{leaveRequests.length === 1 ? '' : 's'} logged this week.
              </p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  )
}

function QuickAction({
  to,
  icon: Icon,
  label,
  badge,
}: {
  to: string
  icon: typeof Settings
  label: string
  badge?: number
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-2.5 rounded-btn px-2.5 py-2 text-[13px] font-medium text-ink-secondary transition-colors hover:bg-surface-muted hover:text-ink"
    >
      <Icon className="size-4 text-ink-muted group-hover:text-ink-secondary" />
      <span className="flex-1">{label}</span>
      {badge ? <Badge tone="accent">{badge}</Badge> : <ArrowRight className="size-3.5 text-ink-subtle opacity-0 transition-opacity group-hover:opacity-100" />}
    </Link>
  )
}

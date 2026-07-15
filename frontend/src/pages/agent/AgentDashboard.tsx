import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, CheckCircle2, Clock, FilePlus2, Wallet, XCircle } from 'lucide-react'
import { getMyLeaveBalance, listMyRequests } from '../../api/endpoints'
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  LoadingText,
  PageTitle,
  StatTile,
  StatusBadge,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  REQUEST_TYPE_LABELS,
} from '../../components/ui'

export default function AgentDashboard() {
  const balanceQuery = useQuery({ queryKey: ['my-leave-balance'], queryFn: () => getMyLeaveBalance(), retry: false })
  const requestsQuery = useQuery({ queryKey: ['my-requests'], queryFn: () => listMyRequests() })

  const requests = requestsQuery.data ?? []
  const pending = requests.filter((r) => r.status === 'pending').length
  const approved = requests.filter((r) => r.status === 'approved').length
  const denied = requests.filter((r) => r.status === 'denied').length

  return (
    <div>
      <PageTitle
        subtitle="Your requests, leave balance and quick actions."
        actions={
          <Link to="/agent/requests">
            <Button icon={FilePlus2}>New request</Button>
          </Link>
        }
      >
        Dashboard
      </PageTitle>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="Leave remaining"
          value={balanceQuery.data ? balanceQuery.data.remaining_balance : '—'}
          icon={Wallet}
          tone="accent"
          hint={balanceQuery.data ? `of ${balanceQuery.data.total_leave_days_allotted} days` : 'No balance on file'}
          loading={balanceQuery.isLoading}
        />
        <StatTile label="Pending" value={pending} icon={Clock} tone={pending ? 'warning' : 'neutral'} loading={requestsQuery.isLoading} />
        <StatTile label="Approved" value={approved} icon={CheckCircle2} tone="success" loading={requestsQuery.isLoading} />
        <StatTile label="Denied" value={denied} icon={XCircle} tone={denied ? 'critical' : 'neutral'} loading={requestsQuery.isLoading} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-ink">Recent requests</h2>
            <Link to="/agent/requests" className="text-xs font-medium text-accent hover:text-accent-hover">
              View all
            </Link>
          </div>
          {requestsQuery.isLoading && <LoadingText />}
          {requestsQuery.data && requests.length === 0 && (
            <EmptyState title="No requests yet" text="Submit a request and it will show up here." icon={FilePlus2} />
          )}
          {requests.length > 0 && (
            <Table>
              <Thead>
                <Tr>
                  <Th>Type</Th>
                  <Th>Date</Th>
                  <Th>Status</Th>
                </Tr>
              </Thead>
              <Tbody>
                {requests.slice(0, 8).map((r) => (
                  <Tr key={r.id}>
                    <Td className="font-medium text-ink">{REQUEST_TYPE_LABELS[r.request_type]}</Td>
                    <Td className="tabular-nums">
                      {r.requested_start_date}
                      {r.requested_end_date ? ` → ${r.requested_end_date}` : ''}
                    </Td>
                    <Td>
                      <StatusBadge status={r.status} />
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </section>

        <aside className="flex flex-col gap-5">
          <Card>
            <CardHeader title="Quick actions" />
            <div className="grid gap-1.5">
              <AgentAction to="/agent/requests" icon={FilePlus2} label="Submit a request" />
              <AgentAction to="/" icon={CalendarDays} label="View published roster" />
              <AgentAction to="/agent/appeals" icon={ArrowRight} label="My appeals" />
            </div>
          </Card>
          {balanceQuery.data && (
            <Card>
              <CardHeader title="Leave balance" />
              <div className="flex items-end gap-2">
                <span className="text-3xl font-semibold tabular-nums text-ink">{balanceQuery.data.remaining_balance}</span>
                <span className="pb-1 text-[13px] text-ink-muted">/ {balanceQuery.data.total_leave_days_allotted} days</span>
              </div>
              <div className="mt-3 space-y-1.5 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Taken</span>
                  <span className="tabular-nums text-ink">{balanceQuery.data.leave_days_taken}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Half-days</span>
                  <span className="tabular-nums text-ink">{balanceQuery.data.half_days_taken}</span>
                </div>
              </div>
            </Card>
          )}
        </aside>
      </div>
    </div>
  )
}

function AgentAction({ to, icon: Icon, label }: { to: string; icon: typeof CalendarDays; label: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-2.5 rounded-btn px-2.5 py-2 text-[13px] font-medium text-ink-secondary transition-colors hover:bg-surface-muted hover:text-ink"
    >
      <Icon className="size-4 text-ink-muted group-hover:text-ink-secondary" />
      <span className="flex-1">{label}</span>
      <ArrowRight className="size-3.5 text-ink-subtle opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  )
}

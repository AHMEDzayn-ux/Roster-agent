import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getMyLeaveBalance, listMyRequests } from '../../api/endpoints'
import { Card, EmptyState, LoadingText, PageTitle, StatusBadge, REQUEST_TYPE_LABELS } from '../../components/ui'

export default function AgentDashboard() {
  const balanceQuery = useQuery({ queryKey: ['my-leave-balance'], queryFn: () => getMyLeaveBalance(), retry: false })
  const requestsQuery = useQuery({ queryKey: ['my-requests'], queryFn: () => listMyRequests() })

  return (
    <div>
      <PageTitle subtitle="Your requests, leave balance, and quick actions.">Agent Dashboard</PageTitle>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-sm font-medium text-slate-500">Annual leave balance</h2>
          {balanceQuery.isLoading && <LoadingText />}
          {balanceQuery.isError && <p className="text-sm text-slate-500">No leave balance on file yet.</p>}
          {balanceQuery.data && (
            <p className="text-2xl font-semibold text-slate-900">
              {balanceQuery.data.remaining_balance}{' '}
              <span className="text-sm font-normal text-slate-500">/ {balanceQuery.data.total_leave_days_allotted} days remaining</span>
            </p>
          )}
        </Card>
        <Card>
          <h2 className="mb-2 text-sm font-medium text-slate-500">Quick actions</h2>
          <div className="flex flex-col gap-2 text-sm">
            <Link className="text-slate-900 underline" to="/agent/requests">
              Submit a new request →
            </Link>
            <Link className="text-slate-900 underline" to="/">
              View the published roster →
            </Link>
          </div>
        </Card>
      </div>

      <h2 className="mb-2 text-lg font-medium text-slate-800">Recent requests</h2>
      {requestsQuery.isLoading && <LoadingText />}
      {requestsQuery.data && requestsQuery.data.length === 0 && <EmptyState text="You haven't submitted any requests yet." />}
      {requestsQuery.data && requestsQuery.data.length > 0 && (
        <Card>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-1.5 pr-4">Type</th>
                <th className="py-1.5 pr-4">Date</th>
                <th className="py-1.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {requestsQuery.data.slice(0, 5).map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-1.5 pr-4">{REQUEST_TYPE_LABELS[r.request_type]}</td>
                  <td className="py-1.5 pr-4">{r.requested_start_date}</td>
                  <td className="py-1.5">
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}

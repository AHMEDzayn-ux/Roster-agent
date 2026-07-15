import { useQuery } from '@tanstack/react-query'
import { listMyAppeals } from '../../api/endpoints'
import { Card, EmptyState, LoadingText, PageTitle, StatusBadge } from '../../components/ui'

export default function MyAppeals() {
  const query = useQuery({ queryKey: ['my-appeals'], queryFn: listMyAppeals })

  return (
    <div>
      <PageTitle subtitle="Appeals you've submitted for denied requests, and the manager's response.">My Appeals</PageTitle>
      {query.isLoading && <LoadingText />}
      {query.data && query.data.length === 0 && <EmptyState text="You haven't submitted any appeals." />}
      {query.data && query.data.length > 0 && (
        <div className="space-y-3">
          {query.data.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-ink-muted">Request #{a.weekly_request_id}</p>
                  <p className="mt-1 text-[13px] text-ink">“{a.appeal_reason}”</p>
                  {a.manager_response && (
                    <p className="mt-2 rounded-input bg-surface-muted px-3 py-2 text-[13px] text-ink-secondary">
                      <span className="font-medium text-ink">Manager response:</span> {a.manager_response}
                    </p>
                  )}
                </div>
                <StatusBadge status={a.status} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

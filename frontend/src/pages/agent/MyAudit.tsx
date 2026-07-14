import { useQuery } from '@tanstack/react-query'
import { listMyAuditLog } from '../../api/endpoints'
import { Card, EmptyState, LoadingText, PageTitle } from '../../components/ui'

export default function MyAudit() {
  const query = useQuery({ queryKey: ['my-audit'], queryFn: listMyAuditLog })

  return (
    <div>
      <PageTitle subtitle="Transparency log: any manual change that affected one of your requests, and why.">
        My Audit Trail
      </PageTitle>
      {query.isLoading && <LoadingText />}
      {query.data && query.data.length === 0 && <EmptyState text="No changes have been logged against your requests." />}
      {query.data && query.data.length > 0 && (
        <div className="space-y-3">
          {query.data.map((e) => (
            <Card key={e.id}>
              <p className="text-xs text-slate-500">{new Date(e.timestamp).toLocaleString()}</p>
              <p className="mt-1 font-medium text-slate-800">{e.action_type.replaceAll('_', ' ')}</p>
              <p className="text-sm text-slate-600">
                {e.old_value} → {e.new_value}
              </p>
              {e.reason && <p className="mt-1 text-sm text-slate-700">Reason: {e.reason}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

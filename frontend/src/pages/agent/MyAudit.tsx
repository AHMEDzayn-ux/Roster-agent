import { useQuery } from '@tanstack/react-query'
import { listMyAuditLog } from '../../api/endpoints'
import { EmptyState, LoadingText, PageTitle } from '../../components/ui'

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
        <div className="relative space-y-0 border-l border-line pl-5">
          {query.data.map((e) => (
            <div key={e.id} className="relative pb-5 last:pb-0">
              <span className="absolute -left-[23px] top-1 size-2.5 rounded-full border-2 border-surface bg-accent" />
              <p className="text-xs tabular-nums text-ink-muted">{new Date(e.timestamp).toLocaleString()}</p>
              <p className="mt-0.5 text-[13px] font-semibold capitalize text-ink">{e.action_type.replaceAll('_', ' ')}</p>
              <p className="text-[13px] text-ink-secondary">
                {e.old_value ?? '—'} <span className="text-ink-subtle">→</span> {e.new_value ?? '—'}
              </p>
              {e.reason && <p className="mt-0.5 text-[13px] text-ink-muted">Reason: {e.reason}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

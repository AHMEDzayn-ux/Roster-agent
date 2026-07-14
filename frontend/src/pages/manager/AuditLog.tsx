import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listAuditLog } from '../../api/endpoints'
import { Card, EmptyState, Field, Input, LoadingText, PageTitle } from '../../components/ui'

export default function AuditLog() {
  const [actionType, setActionType] = useState('')
  const [targetType, setTargetType] = useState('')

  const query = useQuery({
    queryKey: ['audit-log', actionType, targetType],
    queryFn: () =>
      listAuditLog({
        action_type: actionType || undefined,
        target_type: targetType || undefined,
      }),
  })

  return (
    <div>
      <PageTitle subtitle="Full history of manual overrides, imports, and appeal resolutions.">Audit Log</PageTitle>

      <Card className="mb-5">
        <div className="flex flex-wrap gap-4">
          <div className="w-56">
            <Field label="Filter by action type">
              <Input placeholder="e.g. roster_manual_override" value={actionType} onChange={(e) => setActionType(e.target.value)} />
            </Field>
          </div>
          <div className="w-56">
            <Field label="Filter by target type">
              <Input placeholder="e.g. weekly_request" value={targetType} onChange={(e) => setTargetType(e.target.value)} />
            </Field>
          </div>
        </div>
      </Card>

      {query.isLoading && <LoadingText />}
      {query.data && query.data.length === 0 && <EmptyState text="No matching audit entries." />}
      {query.data && query.data.length > 0 && (
        <div className="space-y-2">
          {query.data.map((e) => (
            <Card key={e.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-slate-500">
                    {new Date(e.timestamp).toLocaleString()} · actor #{e.actor_id ?? 'system'} · {e.target_type} #{e.target_id}
                  </p>
                  <p className="font-medium text-slate-800">{e.action_type.replaceAll('_', ' ')}</p>
                  <p className="text-sm text-slate-600">
                    {e.old_value} → {e.new_value}
                  </p>
                  {e.reason && <p className="mt-1 text-sm text-slate-700">Reason: {e.reason}</p>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

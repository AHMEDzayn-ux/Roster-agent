import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listAuditLog } from '../../api/endpoints'
import { Card, EmptyState, Field, Input, LoadingText, PageTitle, Select } from '../../components/ui'

const ACTION_LABELS: Record<string, string> = {
  roster_generated: 'Roster generated',
  roster_published: 'Roster published',
  roster_locked: 'Roster locked',
  request_denied: 'Request denied',
  request_outcome_overridden: 'Request outcome overridden',
  roster_manual_override: 'Manual roster override',
  roster_import_override: 'Excel import override',
}

export default function AuditLog() {
  const [actionType, setActionType] = useState('')
  const [targetType, setTargetType] = useState('')
  const [keyword, setKeyword] = useState('')

  // Load everything, filter client-side for instant search across all fields.
  const query = useQuery({ queryKey: ['audit-log'], queryFn: () => listAuditLog({}) })

  const actionTypes = useMemo(
    () => [...new Set((query.data ?? []).map((e) => e.action_type))].sort(),
    [query.data],
  )
  const targetTypes = useMemo(
    () => [...new Set((query.data ?? []).map((e) => e.target_type))].sort(),
    [query.data],
  )

  const entries = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return (query.data ?? []).filter((e) => {
      if (actionType && e.action_type !== actionType) return false
      if (targetType && e.target_type !== targetType) return false
      if (kw) {
        const hay = [e.action_type, e.target_type, e.old_value, e.new_value, e.reason, `#${e.target_id}`, `actor #${e.actor_id}`]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(kw)) return false
      }
      return true
    })
  }, [query.data, actionType, targetType, keyword])

  const label = (a: string) => ACTION_LABELS[a] ?? a.replaceAll('_', ' ')

  return (
    <div>
      <PageTitle subtitle="Full history of sensitive operations — roster generation, publish/lock, request denials, overrides, imports and appeal resolutions.">
        Audit Log
      </PageTitle>

      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-64">
            <Field label="Search">
              <Input placeholder="agent, reason, value…" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            </Field>
          </div>
          <div className="w-56">
            <Field label="Action">
              <Select value={actionType} onChange={(e) => setActionType(e.target.value)}>
                <option value="">All actions</option>
                {actionTypes.map((a) => (
                  <option key={a} value={a}>
                    {label(a)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="w-56">
            <Field label="Target">
              <Select value={targetType} onChange={(e) => setTargetType(e.target.value)}>
                <option value="">All targets</option>
                {targetTypes.map((t) => (
                  <option key={t} value={t}>
                    {t.replaceAll('_', ' ')}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {(actionType || targetType || keyword) && (
            <span className="ml-auto text-xs text-slate-500">
              {entries.length} of {query.data?.length ?? 0} entries
            </span>
          )}
        </div>
      </Card>

      {query.isLoading && <LoadingText />}
      {query.data && entries.length === 0 && <EmptyState text="No matching audit entries." />}
      {entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((e) => (
            <Card key={e.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-slate-500">
                    {new Date(e.timestamp).toLocaleString()} · actor #{e.actor_id ?? 'system'} · {e.target_type} #{e.target_id}
                  </p>
                  <p className="font-medium text-slate-800">{label(e.action_type)}</p>
                  {(e.old_value || e.new_value) && (
                    <p className="text-sm text-slate-600">
                      {e.old_value ?? '—'} → {e.new_value ?? '—'}
                    </p>
                  )}
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

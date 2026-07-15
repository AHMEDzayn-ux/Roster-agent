import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { listAuditLog } from '../../api/endpoints'
import {
  Badge,
  EmptyState,
  Field,
  Input,
  LoadingText,
  PageTitle,
  ScrollTable,
  Select,
  Tbody,
  Td,
  Th,
  Thead,
  Toolbar,
  Tr,
} from '../../components/ui'

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

  const query = useQuery({ queryKey: ['audit-log'], queryFn: () => listAuditLog({}) })

  const actionTypes = useMemo(() => [...new Set((query.data ?? []).map((e) => e.action_type))].sort(), [query.data])
  const targetTypes = useMemo(() => [...new Set((query.data ?? []).map((e) => e.target_type))].sort(), [query.data])

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
      <PageTitle subtitle="Full history of sensitive operations — roster generation, publish/lock, denials, overrides, imports and appeal resolutions.">
        Audit Log
      </PageTitle>

      <Toolbar>
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-2.5 top-[30px] size-3.5 -translate-y-1/2 text-ink-muted" />
          <Field label="Search">
            <Input className="pl-8" placeholder="agent, reason, value…" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          </Field>
        </div>
        <div className="w-52">
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
        <div className="w-52">
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
        <span className="ml-auto self-end pb-1.5 text-xs text-ink-muted">
          {entries.length} of {query.data?.length ?? 0} entries
        </span>
      </Toolbar>

      {query.isLoading && <LoadingText />}
      {query.data && entries.length === 0 && <EmptyState text="No matching audit entries." />}
      {entries.length > 0 && (
        <ScrollTable>
          <Thead>
            <Tr>
              <Th className="min-w-[150px]">When</Th>
              <Th>Action</Th>
              <Th>Target</Th>
              <Th>Change</Th>
              <Th>Reason</Th>
              <Th>Actor</Th>
            </Tr>
          </Thead>
          <Tbody>
            {entries.map((e) => (
              <Tr key={e.id}>
                <Td className="whitespace-nowrap tabular-nums text-ink-muted">{new Date(e.timestamp).toLocaleString()}</Td>
                <Td>
                  <span className="font-medium text-ink">{label(e.action_type)}</span>
                </Td>
                <Td className="whitespace-nowrap">
                  <Badge tone="neutral">
                    {e.target_type} #{e.target_id}
                  </Badge>
                </Td>
                <Td className="text-ink-secondary">
                  {e.old_value || e.new_value ? (
                    <span className="tabular-nums">
                      {e.old_value ?? '—'} <span className="text-ink-subtle">→</span> {e.new_value ?? '—'}
                    </span>
                  ) : (
                    <span className="text-ink-subtle">—</span>
                  )}
                </Td>
                <Td className="max-w-[280px] text-ink-secondary">{e.reason || <span className="text-ink-subtle">—</span>}</Td>
                <Td className="whitespace-nowrap text-ink-muted">#{e.actor_id ?? 'system'}</Td>
              </Tr>
            ))}
          </Tbody>
        </ScrollTable>
      )}
    </div>
  )
}

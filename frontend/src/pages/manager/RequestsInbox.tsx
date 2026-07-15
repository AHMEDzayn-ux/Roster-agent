import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban } from 'lucide-react'
import { extractErrorMessage } from '../../api/client'
import { denyRequest, listAgents, listRequestsForWeek, listWeeklyCycles } from '../../api/endpoints'
import {
  Alert,
  Avatar,
  Button,
  EmptyState,
  Field,
  Modal,
  PageTitle,
  SegmentedTabs,
  Select,
  StatusBadge,
  Textarea,
  Toolbar,
  REQUEST_TYPE_LABELS,
} from '../../components/ui'
import type { RequestStatus, WeeklyRequest } from '../../types'

type StatusTab = 'all' | RequestStatus

export default function RequestsInbox() {
  const queryClient = useQueryClient()
  const cyclesQuery = useQuery({ queryKey: ['weekly-cycles'], queryFn: listWeeklyCycles })
  const agentsQuery = useQuery({ queryKey: ['agents'], queryFn: listAgents })
  const [cycleId, setCycleId] = useState<string>('')
  const [tab, setTab] = useState<StatusTab>('all')

  const requestsQuery = useQuery({
    queryKey: ['requests-for-week', cycleId],
    queryFn: () => listRequestsForWeek(Number(cycleId)),
    enabled: Boolean(cycleId),
  })

  const [denying, setDenying] = useState<WeeklyRequest | null>(null)
  const [denyReason, setDenyReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const denyMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => denyRequest(id, reason),
    onSuccess: () => {
      setDenying(null)
      setDenyReason('')
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['requests-for-week', cycleId] })
    },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const agentName = (id: number) => agentsQuery.data?.find((a) => a.id === id)?.name ?? `Agent #${id}`

  const all = requestsQuery.data ?? []
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length, pending: 0, approved: 0, denied: 0, appealed: 0 }
    for (const r of all) c[r.status] = (c[r.status] ?? 0) + 1
    return c
  }, [all])
  const filtered = tab === 'all' ? all : all.filter((r) => r.status === tab)

  return (
    <div>
      <PageTitle subtitle="Triage requests before generating the roster. Approvals happen automatically at generation — use this only to reject invalid requests.">
        Requests
      </PageTitle>

      <Toolbar>
        <div className="w-72">
          <Field label="Weekly cycle">
            <Select value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
              <option value="">Select a week…</option>
              {cyclesQuery.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  Week of {c.week_start_date} ({c.status})
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {cycleId && (
          <div className="ml-auto self-end">
            <SegmentedTabs
              value={tab}
              onChange={setTab}
              options={[
                { value: 'all', label: 'All', count: counts.all },
                { value: 'pending', label: 'Pending', count: counts.pending },
                { value: 'approved', label: 'Approved', count: counts.approved },
                { value: 'denied', label: 'Denied', count: counts.denied },
              ]}
            />
          </div>
        )}
      </Toolbar>

      {error && <Alert tone="critical" message={error} className="mb-4" />}

      {!cycleId && <EmptyState text="Select a weekly cycle to see its requests." />}
      {cycleId && requestsQuery.data && all.length === 0 && <EmptyState text="No requests for this week." />}
      {cycleId && all.length > 0 && filtered.length === 0 && <EmptyState text="No requests match this filter." />}

      {filtered.length > 0 && (
        <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-xs">
          {filtered.map((r) => (
            <div key={r.id} className="flex items-start gap-3 px-4 py-3">
              <Avatar name={agentName(r.agent_id)} size={32} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-ink">{agentName(r.agent_id)}</span>
                  <span className="text-ink-subtle">·</span>
                  <span className="text-[13px] text-ink-secondary">{REQUEST_TYPE_LABELS[r.request_type]}</span>
                </div>
                <p className="text-xs tabular-nums text-ink-muted">
                  {r.requested_start_date}
                  {r.requested_end_date ? ` → ${r.requested_end_date}` : ''}
                </p>
                {r.reason && <p className="mt-1 text-[13px] text-ink-secondary">“{r.reason}”</p>}
                {r.denial_reason && <p className="mt-1 text-[13px] text-critical">Denied: {r.denial_reason}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge status={r.status} />
                {r.status === 'pending' && (
                  <Button variant="secondary" size="sm" icon={Ban} onClick={() => setDenying(r)}>
                    Reject
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={denying != null}
        onClose={() => setDenying(null)}
        title="Reject request"
        description={denying ? `${agentName(denying.agent_id)} — ${REQUEST_TYPE_LABELS[denying.request_type]}` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDenying(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!denyReason || denyMutation.isPending}
              loading={denyMutation.isPending}
              onClick={() => denying && denyMutation.mutate({ id: denying.id, reason: denyReason })}
            >
              Confirm reject
            </Button>
          </>
        }
      >
        <Field label="Reason for rejecting" required>
          <Textarea
            autoFocus
            placeholder="Explain why this request is invalid…"
            value={denyReason}
            onChange={(e) => setDenyReason(e.target.value)}
          />
        </Field>
      </Modal>
    </div>
  )
}

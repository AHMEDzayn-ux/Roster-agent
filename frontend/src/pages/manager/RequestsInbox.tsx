import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { extractErrorMessage } from '../../api/client'
import { denyRequest, listAgents, listRequestsForWeek, listWeeklyCycles } from '../../api/endpoints'
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  LoadingText,
  PageTitle,
  REQUEST_TYPE_LABELS,
  Select,
  StatusBadge,
} from '../../components/ui'

export default function RequestsInbox() {
  const queryClient = useQueryClient()
  const cyclesQuery = useQuery({ queryKey: ['weekly-cycles'], queryFn: listWeeklyCycles })
  const agentsQuery = useQuery({ queryKey: ['agents'], queryFn: listAgents })
  const [cycleId, setCycleId] = useState<string>('')

  const requestsQuery = useQuery({
    queryKey: ['requests-for-week', cycleId],
    queryFn: () => listRequestsForWeek(Number(cycleId)),
    enabled: Boolean(cycleId),
  })

  const [denyingId, setDenyingId] = useState<number | null>(null)
  const [denyReason, setDenyReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const denyMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => denyRequest(id, reason),
    onSuccess: () => {
      setDenyingId(null)
      setDenyReason('')
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['requests-for-week', cycleId] })
    },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const agentName = (id: number) => agentsQuery.data?.find((a) => a.id === id)?.name ?? `Agent #${id}`

  return (
    <div>
      <PageTitle subtitle="Triage requests before generating the roster. Approval happens automatically when the roster is generated — this is only for rejecting invalid requests.">
        Requests Inbox
      </PageTitle>

      <Card className="mb-5">
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
      </Card>

      {!cycleId && <EmptyState text="Select a weekly cycle to see its requests." />}
      {cycleId && requestsQuery.isLoading && <LoadingText />}
      {cycleId && requestsQuery.data && requestsQuery.data.length === 0 && <EmptyState text="No requests for this week." />}

      {requestsQuery.data && requestsQuery.data.length > 0 && (
        <div className="space-y-3">
          <ErrorBanner message={error} />
          {requestsQuery.data.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-slate-800">
                    {agentName(r.agent_id)} — {REQUEST_TYPE_LABELS[r.request_type]}
                  </p>
                  <p className="text-sm text-slate-500">
                    {r.requested_start_date}
                    {r.requested_end_date ? ` → ${r.requested_end_date}` : ''}
                  </p>
                  {r.reason && <p className="mt-1 text-sm text-slate-600">"{r.reason}"</p>}
                  {r.denial_reason && <p className="mt-1 text-sm text-red-600">Denied: {r.denial_reason}</p>}
                </div>
                <StatusBadge status={r.status} />
              </div>

              {r.status === 'pending' && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  {denyingId === r.id ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Reason for rejecting this request"
                        value={denyReason}
                        onChange={(e) => setDenyReason(e.target.value)}
                      />
                      <Button
                        variant="danger"
                        disabled={denyMutation.isPending || !denyReason}
                        onClick={() => denyMutation.mutate({ id: r.id, reason: denyReason })}
                      >
                        Confirm reject
                      </Button>
                      <Button variant="secondary" onClick={() => setDenyingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button variant="secondary" onClick={() => setDenyingId(r.id)}>
                      Reject as invalid
                    </Button>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

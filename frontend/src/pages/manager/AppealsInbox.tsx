import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { extractErrorMessage } from '../../api/client'
import { listAgents, listAppeals, reviewAppeal } from '../../api/endpoints'
import {
  Alert,
  Avatar,
  Button,
  EmptyState,
  Field,
  LoadingText,
  Modal,
  PageTitle,
  StatusBadge,
  Textarea,
} from '../../components/ui'
import type { Appeal, AppealStatus } from '../../types'

export default function AppealsInbox() {
  const queryClient = useQueryClient()
  const appealsQuery = useQuery({ queryKey: ['appeals'], queryFn: () => listAppeals() })
  const agentsQuery = useQuery({ queryKey: ['agents'], queryFn: listAgents })

  const [reviewing, setReviewing] = useState<Appeal | null>(null)
  const [response, setResponse] = useState('')
  const [error, setError] = useState<string | null>(null)

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: AppealStatus }) => reviewAppeal(id, status, response),
    onSuccess: () => {
      setReviewing(null)
      setResponse('')
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['appeals'] })
    },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const agentName = (id: number) => agentsQuery.data?.find((a) => a.id === id)?.name ?? `Agent #${id}`

  return (
    <div>
      <PageTitle subtitle="Approving an appeal re-opens the request for the solver to reconsider on the next roster generation — it doesn't grant it directly.">
        Appeals
      </PageTitle>

      {error && <Alert tone="critical" message={error} className="mb-4" />}
      {appealsQuery.isLoading && <LoadingText />}
      {appealsQuery.data && appealsQuery.data.length === 0 && <EmptyState text="No appeals to review." />}

      {appealsQuery.data && appealsQuery.data.length > 0 && (
        <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-xs">
          {appealsQuery.data.map((a) => (
            <div key={a.id} className="flex items-start gap-3 px-4 py-3">
              <Avatar name={agentName(a.agent_id)} size={32} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-ink">{agentName(a.agent_id)}</span>
                  <span className="text-ink-subtle">·</span>
                  <span className="text-xs text-ink-muted">Request #{a.weekly_request_id}</span>
                </div>
                <p className="mt-1 text-[13px] text-ink-secondary">“{a.appeal_reason}”</p>
                {a.manager_response && (
                  <p className="mt-2 rounded-input bg-surface-muted px-3 py-2 text-[13px] text-ink-secondary">
                    <span className="font-medium text-ink">Response:</span> {a.manager_response}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge status={a.status} />
                {a.status === 'pending' && (
                  <Button variant="secondary" size="sm" onClick={() => setReviewing(a)}>
                    Respond
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={reviewing != null}
        onClose={() => setReviewing(null)}
        title="Respond to appeal"
        description={reviewing ? `${agentName(reviewing.agent_id)} — request #${reviewing.weekly_request_id}` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReviewing(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!response || reviewMutation.isPending}
              onClick={() => reviewing && reviewMutation.mutate({ id: reviewing.id, status: 'denied' })}
            >
              Deny
            </Button>
            <Button
              disabled={!response || reviewMutation.isPending}
              loading={reviewMutation.isPending}
              onClick={() => reviewing && reviewMutation.mutate({ id: reviewing.id, status: 'approved' })}
            >
              Approve
            </Button>
          </>
        }
      >
        {reviewing?.appeal_reason && (
          <p className="mb-3 rounded-input bg-surface-muted px-3 py-2 text-[13px] text-ink-secondary">
            “{reviewing.appeal_reason}”
          </p>
        )}
        <Field label="Response to the agent" required>
          <Textarea autoFocus placeholder="Explain your decision…" value={response} onChange={(e) => setResponse(e.target.value)} />
        </Field>
      </Modal>
    </div>
  )
}

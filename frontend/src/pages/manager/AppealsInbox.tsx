import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { extractErrorMessage } from '../../api/client'
import { listAgents, listAppeals } from '../../api/endpoints'
import { reviewAppeal } from '../../api/endpoints'
import { Button, Card, EmptyState, ErrorBanner, Input, LoadingText, PageTitle, StatusBadge } from '../../components/ui'
import type { AppealStatus } from '../../types'

export default function AppealsInbox() {
  const queryClient = useQueryClient()
  const appealsQuery = useQuery({ queryKey: ['appeals'], queryFn: () => listAppeals() })
  const agentsQuery = useQuery({ queryKey: ['agents'], queryFn: listAgents })

  const [reviewingId, setReviewingId] = useState<number | null>(null)
  const [response, setResponse] = useState('')
  const [error, setError] = useState<string | null>(null)

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: AppealStatus }) => reviewAppeal(id, status, response),
    onSuccess: () => {
      setReviewingId(null)
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
        Appeals Inbox
      </PageTitle>

      {appealsQuery.isLoading && <LoadingText />}
      {appealsQuery.data && appealsQuery.data.length === 0 && <EmptyState text="No appeals." />}

      {appealsQuery.data && appealsQuery.data.length > 0 && (
        <div className="space-y-3">
          <ErrorBanner message={error} />
          {appealsQuery.data.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-slate-800">
                    {agentName(a.agent_id)} — request #{a.weekly_request_id}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">"{a.appeal_reason}"</p>
                  {a.manager_response && (
                    <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{a.manager_response}</p>
                  )}
                </div>
                <StatusBadge status={a.status} />
              </div>

              {a.status === 'pending' && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  {reviewingId === a.id ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Response to the agent (required)"
                        value={response}
                        onChange={(e) => setResponse(e.target.value)}
                      />
                      <Button
                        disabled={reviewMutation.isPending || !response}
                        onClick={() => reviewMutation.mutate({ id: a.id, status: 'approved' })}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        disabled={reviewMutation.isPending || !response}
                        onClick={() => reviewMutation.mutate({ id: a.id, status: 'denied' })}
                      >
                        Deny
                      </Button>
                      <Button variant="secondary" onClick={() => setReviewingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button variant="secondary" onClick={() => setReviewingId(a.id)}>
                      Respond
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

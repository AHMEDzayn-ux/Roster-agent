import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { extractErrorMessage } from '../../../api/client'
import { createLeaveBalance, getAgentLeaveBalance, listAgents, updateLeaveBalance } from '../../../api/endpoints'
import { Button, Card, ErrorBanner, Field, Input, Select, SuccessBanner } from '../../../components/ui'

export default function LeaveBalancesConfig() {
  const queryClient = useQueryClient()
  const agentsQuery = useQuery({ queryKey: ['agents'], queryFn: listAgents })
  const [agentId, setAgentId] = useState('')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [total, setTotal] = useState('21')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const balanceQuery = useQuery({
    queryKey: ['agent-leave-balance', agentId, year],
    queryFn: () => getAgentLeaveBalance(Number(agentId), Number(year)),
    enabled: Boolean(agentId),
    retry: false,
  })

  const saveMutation = useMutation({
    mutationFn: () =>
      balanceQuery.data
        ? updateLeaveBalance(Number(agentId), Number(total), Number(year))
        : createLeaveBalance({ agent_id: Number(agentId), year: Number(year), total_leave_days_allotted: Number(total) }),
    onSuccess: () => {
      setSuccess(balanceQuery.data ? 'Leave allotment updated.' : 'Leave balance created.')
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['agent-leave-balance', agentId, year] })
    },
    onError: (err) => {
      setError(extractErrorMessage(err))
      setSuccess(null)
    },
  })

  return (
    <div>
      <Card>
        <h2 className="mb-3 font-medium text-slate-800">View / create an agent's annual leave balance</h2>
        <ErrorBanner message={error} />
        <SuccessBanner message={success} />
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Agent">
            <Select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="w-56">
              <option value="">Select…</option>
              {agentsQuery.data?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Year">
            <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="w-28" />
          </Field>
        </div>

        {agentId && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            {balanceQuery.data ? (
              <p className="text-sm text-slate-700">
                Allotted: <strong>{balanceQuery.data.total_leave_days_allotted}</strong> · Taken:{' '}
                {balanceQuery.data.leave_days_taken} (+{balanceQuery.data.half_days_taken} half-days) · Remaining:{' '}
                <strong>{balanceQuery.data.remaining_balance}</strong>
              </p>
            ) : (
              <p className="mb-3 text-sm text-slate-500">No leave balance on file for this agent/year yet.</p>
            )}
            <div className="mt-3 flex items-end gap-3">
              <Field label="Total days allotted">
                <Input type="number" min={0} step="0.5" value={total} onChange={(e) => setTotal(e.target.value)} className="w-32" />
              </Field>
              <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                {balanceQuery.data ? 'Update allotment' : 'Create balance'}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

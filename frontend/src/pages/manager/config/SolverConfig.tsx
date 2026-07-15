import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { extractErrorMessage } from '../../../api/client'
import { getSolverWeights, updateSolverWeights } from '../../../api/endpoints'
import { Button, Card, ErrorBanner, Field, Input, LoadingText, SuccessBanner } from '../../../components/ui'
import type { SolverWeights } from '../../../types'

const LABELS: Record<keyof SolverWeights, string> = {
  leave_weight: 'Leave requests',
  off_day_request_weight: 'Off-day requests',
  shift_change_weight: 'Shift-change requests',
  overtime_weight: 'Overtime requests',
  fairness_weight: 'Fairness (spread denials across agents)',
}

export default function SolverConfig() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['solver-config'], queryFn: getSolverWeights })
  const [weights, setWeights] = useState<SolverWeights | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (query.data) setWeights(query.data)
  }, [query.data])

  const saveMutation = useMutation({
    mutationFn: () => updateSolverWeights(weights!),
    onSuccess: () => {
      setSuccess('Solver weights updated.')
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['solver-config'] })
    },
    onError: (err) => {
      setError(extractErrorMessage(err))
      setSuccess(null)
    },
  })

  if (query.isLoading || !weights) return <LoadingText />

  return (
    <Card className="max-w-xl">
      <h2 className="mb-1 font-medium text-ink">Soft-constraint priority weights</h2>
      <p className="mb-4 text-xs text-ink-muted">
        Higher weight = the solver works harder to honor it. Coverage, no-double-booking, the one-rest-day-per-week rule,
        and an agent's <strong>fixed</strong> off-day are always <strong>hard</strong> constraints — they are guaranteed
        and never weighted here.
      </p>
      <ErrorBanner message={error} />
      <SuccessBanner message={success} />
      <form
        onSubmit={(e) => {
          e.preventDefault()
          saveMutation.mutate()
        }}
        className="space-y-3"
      >
        {(Object.keys(LABELS) as (keyof SolverWeights)[]).map((key) => (
          <Field key={key} label={LABELS[key]}>
            <Input
              type="number"
              min={0}
              step="1"
              value={weights[key]}
              onChange={(e) => setWeights({ ...weights, [key]: Number(e.target.value) })}
              className="w-32"
            />
          </Field>
        ))}
        <Button type="submit" disabled={saveMutation.isPending}>
          Save weights
        </Button>
      </form>
    </Card>
  )
}

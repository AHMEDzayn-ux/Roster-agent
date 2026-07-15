import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { extractErrorMessage } from '../../../api/client'
import { createWeeklyCycle, listWeeklyCycles } from '../../../api/endpoints'
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  LoadingText,
  StatusBadge,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '../../../components/ui'

export default function WeeklyCyclesConfig() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['weekly-cycles'], queryFn: listWeeklyCycles })
  const [weekStart, setWeekStart] = useState('')
  const [error, setError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: () => createWeeklyCycle(weekStart),
    onSuccess: () => {
      setWeekStart('')
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['weekly-cycles'] })
    },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  return (
    <div>
      <Card className="mb-5">
        <h2 className="mb-3 font-medium text-ink">Create a weekly cycle</h2>
        <p className="mb-3 text-xs text-ink-muted">
          Must be a Monday. The Thursday request deadline, Friday publish window, and Saturday-midnight auto-lock are all
          computed automatically.
        </p>
        <ErrorBanner message={error} />
        <form
          onSubmit={(e) => {
            e.preventDefault()
            createMutation.mutate()
          }}
          className="flex items-end gap-3"
        >
          <Field label="Week start (Monday)">
            <Input type="date" required value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
          </Field>
          <Button type="submit" disabled={createMutation.isPending}>
            Create
          </Button>
        </form>
      </Card>

      {query.isLoading && <LoadingText />}
      {query.data && query.data.length === 0 && <EmptyState text="No weekly cycles yet." />}
      {query.data && query.data.length > 0 && (
        <Table>
          <Thead>
            <Tr>
              <Th>Week start</Th>
              <Th>Request deadline</Th>
              <Th>Lock timestamp</Th>
              <Th>Status</Th>
            </Tr>
          </Thead>
          <Tbody>
            {query.data.map((c) => (
              <Tr key={c.id}>
                <Td className="font-medium text-ink">{c.week_start_date}</Td>
                <Td>{new Date(c.request_deadline).toLocaleString()}</Td>
                <Td>{new Date(c.lock_timestamp).toLocaleString()}</Td>
                <Td>
                  <StatusBadge status={c.status} />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  )
}

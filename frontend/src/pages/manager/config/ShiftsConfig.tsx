import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { extractErrorMessage } from '../../../api/client'
import { createShiftTemplate, deleteShiftTemplate, listShiftTemplates } from '../../../api/endpoints'
import { Button, Card, EmptyState, ErrorBanner, Field, Input, LoadingText } from '../../../components/ui'

export default function ShiftsConfig() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['shift-templates'], queryFn: listShiftTemplates })
  const [name, setName] = useState('')
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('18:00')
  const [breakMinutes, setBreakMinutes] = useState('60')
  const [error, setError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: () =>
      createShiftTemplate({
        name,
        start_time: `${start}:00`,
        end_time: `${end}:00`,
        break_duration_minutes: breakMinutes ? Number(breakMinutes) : null,
      }),
    onSuccess: () => {
      setName('')
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['shift-templates'] })
    },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteShiftTemplate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shift-templates'] }),
    onError: (err) => setError(extractErrorMessage(err)),
  })

  return (
    <div>
      <Card className="mb-5">
        <h2 className="mb-3 font-medium text-slate-800">Add a shift template</h2>
        <p className="mb-3 text-xs text-slate-500">
          Shifts can overlap and can wrap past midnight (e.g. 21:00 → 06:00). Break time is for reporting only — placement is a floor-management decision, not scheduled here.
        </p>
        <ErrorBanner message={error} />
        <form
          onSubmit={(e) => {
            e.preventDefault()
            createMutation.mutate()
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <Field label="Name">
            <Input placeholder="Morning" required value={name} onChange={(e) => setName(e.target.value)} className="w-40" />
          </Field>
          <Field label="Start">
            <Input type="time" required value={start} onChange={(e) => setStart(e.target.value)} className="w-32" />
          </Field>
          <Field label="End">
            <Input type="time" required value={end} onChange={(e) => setEnd(e.target.value)} className="w-32" />
          </Field>
          <Field label="Break (min)">
            <Input type="number" min={0} value={breakMinutes} onChange={(e) => setBreakMinutes(e.target.value)} className="w-24" />
          </Field>
          <Button type="submit" disabled={createMutation.isPending}>
            Add
          </Button>
        </form>
      </Card>

      {query.isLoading && <LoadingText />}
      {query.data && query.data.length === 0 && <EmptyState text="No shift templates configured yet." />}
      {query.data && query.data.length > 0 && (
        <div className="space-y-2">
          {query.data.map((s) => (
            <Card key={s.id} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-800">{s.name}</p>
                <p className="text-sm text-slate-500">
                  {s.start_time}–{s.end_time}
                  {s.break_duration_minutes ? ` · ${s.break_duration_minutes} min break` : ''}
                </p>
              </div>
              <Button variant="danger" onClick={() => deleteMutation.mutate(s.id)}>
                Delete
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { extractErrorMessage } from '../../../api/client'
import { createAgent, deleteAgent, listAgents, listShiftTemplates, listSkills, updateAgent } from '../../../api/endpoints'
import { Button, Card, EmptyState, ErrorBanner, Field, Input, LoadingText, Select, WEEKDAY_NAMES } from '../../../components/ui'

export default function AgentsConfig() {
  const queryClient = useQueryClient()
  const agentsQuery = useQuery({ queryKey: ['agents'], queryFn: listAgents })
  const skillsQuery = useQuery({ queryKey: ['skills'], queryFn: listSkills })
  const shiftsQuery = useQuery({ queryKey: ['shift-templates'], queryFn: listShiftTemplates })

  const [name, setName] = useState('')
  const [shiftId, setShiftId] = useState('')
  const [skillIds, setSkillIds] = useState<number[]>([])
  const [offDayType, setOffDayType] = useState<'fixed' | 'flexible'>('flexible')
  const [offDay, setOffDay] = useState('6')
  const [error, setError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: () =>
      createAgent({
        name,
        default_shift_id: shiftId ? Number(shiftId) : undefined,
        skill_ids: skillIds,
        default_off_day_type: offDayType,
        default_off_day: offDayType === 'fixed' ? Number(offDay) : undefined,
      }),
    onSuccess: () => {
      setName('')
      setSkillIds([])
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => updateAgent(id, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAgent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const skillName = (id: number) => skillsQuery.data?.find((s) => s.id === id)?.name ?? `#${id}`
  const shiftName = (id: number | null) => (id ? shiftsQuery.data?.find((s) => s.id === id)?.name ?? `#${id}` : '—')

  return (
    <div>
      <Card className="mb-5">
        <h2 className="mb-3 font-medium text-slate-800">Add an agent</h2>
        <ErrorBanner message={error} />
        <form
          onSubmit={(e) => {
            e.preventDefault()
            createMutation.mutate()
          }}
          className="grid gap-3 sm:grid-cols-2"
        >
          <Field label="Name">
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Default shift">
            <Select value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
              <option value="">None</option>
              {shiftsQuery.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.start_time}–{s.end_time})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Default off-day type">
            <Select value={offDayType} onChange={(e) => setOffDayType(e.target.value as 'fixed' | 'flexible')}>
              <option value="flexible">Flexible (solver decides)</option>
              <option value="fixed">Fixed weekday</option>
            </Select>
          </Field>
          {offDayType === 'fixed' && (
            <Field label="Fixed off-day">
              <Select value={offDay} onChange={(e) => setOffDay(e.target.value)}>
                {WEEKDAY_NAMES.map((d, i) => (
                  <option key={i} value={i}>
                    {d}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <div className="sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-slate-600">Skills</span>
            <div className="flex flex-wrap gap-2">
              {skillsQuery.data?.map((s) => (
                <label key={s.id} className="flex items-center gap-1.5 rounded-md border border-slate-300 px-2 py-1 text-sm">
                  <input
                    type="checkbox"
                    checked={skillIds.includes(s.id)}
                    onChange={(e) =>
                      setSkillIds((prev) => (e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)))
                    }
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={createMutation.isPending}>
              Add agent
            </Button>
          </div>
        </form>
      </Card>

      {agentsQuery.isLoading && <LoadingText />}
      {agentsQuery.data && agentsQuery.data.length === 0 && <EmptyState text="No agents yet." />}
      {agentsQuery.data && agentsQuery.data.length > 0 && (
        <div className="space-y-2">
          {agentsQuery.data.map((a) => (
            <Card key={a.id} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-800">
                  {a.name} {!a.active && <span className="ml-2 text-xs text-slate-400">(inactive)</span>}
                </p>
                <p className="text-sm text-slate-500">
                  Shift: {shiftName(a.default_shift_id)} · Off-day: {a.default_off_day_type === 'fixed' ? WEEKDAY_NAMES[a.default_off_day ?? 0] : 'flexible'} · Skills:{' '}
                  {a.skill_ids.map(skillName).join(', ') || '—'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => toggleActiveMutation.mutate({ id: a.id, active: !a.active })}>
                  {a.active ? 'Deactivate' : 'Activate'}
                </Button>
                <Button variant="danger" onClick={() => deleteMutation.mutate(a.id)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

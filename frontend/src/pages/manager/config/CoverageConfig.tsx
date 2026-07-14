import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { extractErrorMessage } from '../../../api/client'
import { createCoverageRequirement, deleteCoverageRequirement, listCoverageRequirements, listSkills } from '../../../api/endpoints'
import { Button, Card, EmptyState, ErrorBanner, Field, Input, LoadingText, Select, WEEKDAY_NAMES } from '../../../components/ui'

export default function CoverageConfig() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['coverage-requirements'], queryFn: listCoverageRequirements })
  const skillsQuery = useQuery({ queryKey: ['skills'], queryFn: listSkills })

  const [dayOfWeek, setDayOfWeek] = useState('0')
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('10:00')
  const [skillId, setSkillId] = useState('')
  const [minRequired, setMinRequired] = useState('1')
  const [isPeak, setIsPeak] = useState(false)
  const [weight, setWeight] = useState('1')
  const [error, setError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: () =>
      createCoverageRequirement({
        day_of_week: Number(dayOfWeek),
        time_slot_start: `${start}:00`,
        time_slot_end: `${end}:00`,
        skill_id: Number(skillId),
        min_agents_required: Number(minRequired),
        is_peak: isPeak,
        weight: Number(weight),
      }),
    onSuccess: () => {
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['coverage-requirements'] })
    },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCoverageRequirement(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['coverage-requirements'] }),
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const skillName = (id: number) => skillsQuery.data?.find((s) => s.id === id)?.name ?? `Skill #${id}`

  return (
    <div>
      <Card className="mb-5">
        <h2 className="mb-3 font-medium text-slate-800">Add a coverage requirement</h2>
        <p className="mb-3 text-xs text-slate-500">
          Minimum staffing per time slot per skill, not per named shift — the solver checks every shift that overlaps this slot.
        </p>
        <ErrorBanner message={error} />
        <form
          onSubmit={(e) => {
            e.preventDefault()
            createMutation.mutate()
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <Field label="Day">
            <Select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} className="w-32">
              {WEEKDAY_NAMES.map((d, i) => (
                <option key={i} value={i}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Start">
            <Input type="time" required value={start} onChange={(e) => setStart(e.target.value)} className="w-28" />
          </Field>
          <Field label="End">
            <Input type="time" required value={end} onChange={(e) => setEnd(e.target.value)} className="w-28" />
          </Field>
          <Field label="Skill">
            <Select required value={skillId} onChange={(e) => setSkillId(e.target.value)} className="w-44">
              <option value="">Select…</option>
              {skillsQuery.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Min agents">
            <Input type="number" min={0} required value={minRequired} onChange={(e) => setMinRequired(e.target.value)} className="w-24" />
          </Field>
          <Field label="Weight">
            <Input type="number" min={0} step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-20" />
          </Field>
          <label className="flex items-center gap-1.5 pb-1.5 text-sm text-slate-600">
            <input type="checkbox" checked={isPeak} onChange={(e) => setIsPeak(e.target.checked)} />
            Peak
          </label>
          <Button type="submit" disabled={createMutation.isPending}>
            Add
          </Button>
        </form>
      </Card>

      {query.isLoading && <LoadingText />}
      {query.data && query.data.length === 0 && <EmptyState text="No coverage requirements configured yet." />}
      {query.data && query.data.length > 0 && (
        <div className="space-y-2">
          {query.data
            .sort((a, b) => a.day_of_week - b.day_of_week || a.time_slot_start.localeCompare(b.time_slot_start))
            .map((c) => (
              <Card key={c.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-800">
                    {WEEKDAY_NAMES[c.day_of_week]} {c.time_slot_start}–{c.time_slot_end} · {skillName(c.skill_id)}
                    {c.is_peak && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Peak</span>}
                  </p>
                  <p className="text-sm text-slate-500">
                    Min {c.min_agents_required} agents · weight {c.weight}
                  </p>
                </div>
                <Button variant="danger" onClick={() => deleteMutation.mutate(c.id)}>
                  Delete
                </Button>
              </Card>
            ))}
        </div>
      )}
    </div>
  )
}

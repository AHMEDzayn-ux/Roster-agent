import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { extractErrorMessage } from '../../../api/client'
import {
  createCoverageRequirement,
  deleteCoverageRequirement,
  listCoverageRequirements,
  listSkills,
  updateCoverageRequirement,
} from '../../../api/endpoints'
import type { CoverageRequirement } from '../../../types'
import {
  Button,
  CellCheckbox,
  CellNumber,
  CellSelect,
  CellTime,
  EditBar,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  LoadingText,
  ScrollTable,
  Select,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  WEEKDAY_NAMES,
} from '../../../components/ui'

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

  const [editing, setEditing] = useState(false)
  const [rows, setRows] = useState<CoverageRequirement[]>([])

  useEffect(() => {
    if (!editing && query.data) setRows(query.data)
  }, [query.data, editing])

  const dirtyRows = rows.filter((r) => {
    const orig = query.data?.find((o) => o.id === r.id)
    return (
      orig &&
      (orig.day_of_week !== r.day_of_week ||
        orig.time_slot_start !== r.time_slot_start ||
        orig.time_slot_end !== r.time_slot_end ||
        orig.skill_id !== r.skill_id ||
        orig.min_agents_required !== r.min_agents_required ||
        orig.weight !== r.weight ||
        orig.is_peak !== r.is_peak)
    )
  })

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

  const saveMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(
        dirtyRows.map((r) =>
          updateCoverageRequirement(r.id, {
            day_of_week: r.day_of_week,
            time_slot_start: r.time_slot_start.length === 5 ? `${r.time_slot_start}:00` : r.time_slot_start,
            time_slot_end: r.time_slot_end.length === 5 ? `${r.time_slot_end}:00` : r.time_slot_end,
            skill_id: r.skill_id,
            min_agents_required: r.min_agents_required,
            weight: r.weight,
            is_peak: r.is_peak,
          }),
        ),
      )
    },
    onSuccess: () => {
      setError(null)
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['coverage-requirements'] })
    },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const updateRow = (id: number, patch: Partial<CoverageRequirement>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const skillName = (id: number) => skillsQuery.data?.find((s) => s.id === id)?.name ?? `Skill #${id}`
  const skillOptions = (skillsQuery.data ?? []).map((s) => ({ value: s.id, label: s.name }))
  const dayOptions = WEEKDAY_NAMES.map((d, i) => ({ value: i, label: d }))

  return (
    <div>
      <details className="mb-3 rounded-card border border-line bg-surface shadow-xs">
        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-ink">+ Add a coverage requirement</summary>
        <div className="border-t border-line p-3">
          <p className="mb-3 text-xs text-ink-muted">
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
            <label className="flex items-center gap-1.5 pb-1.5 text-sm text-ink-secondary">
              <input type="checkbox" checked={isPeak} onChange={(e) => setIsPeak(e.target.checked)} />
              Peak
            </label>
            <Button type="submit" disabled={createMutation.isPending}>
              Add
            </Button>
          </form>
        </div>
      </details>

      {query.isLoading && <LoadingText />}
      {query.data && query.data.length === 0 && <EmptyState text="No coverage requirements configured yet." />}
      {query.data && query.data.length > 0 && (
        <>
          <ErrorBanner message={editing ? error : null} />
          <EditBar
            editing={editing}
            dirtyCount={dirtyRows.length}
            saving={saveMutation.isPending}
            onEdit={() => setEditing(true)}
            onSave={() => saveMutation.mutate()}
            onCancel={() => {
              setRows(query.data ?? [])
              setEditing(false)
              setError(null)
            }}
          />
          <ScrollTable>
            <Thead>
              <Tr>
                <Th>Day</Th>
                <Th>Start</Th>
                <Th>End</Th>
                <Th>Skill</Th>
                <Th>Min agents</Th>
                <Th>Weight</Th>
                <Th>Peak</Th>
                {!editing && <Th></Th>}
              </Tr>
            </Thead>
            <Tbody>
              {rows
                .slice()
                .sort((a, b) => a.day_of_week - b.day_of_week || a.time_slot_start.localeCompare(b.time_slot_start))
                .map((c) => (
                  <Tr key={c.id}>
                    <Td className="font-medium text-ink">
                      <CellSelect editing={editing} value={c.day_of_week} onChange={(v) => updateRow(c.id, { day_of_week: v })} options={dayOptions} />
                    </Td>
                    <Td>
                      <CellTime editing={editing} value={c.time_slot_start.slice(0, 5)} onChange={(v) => updateRow(c.id, { time_slot_start: v })} />
                    </Td>
                    <Td>
                      <CellTime editing={editing} value={c.time_slot_end.slice(0, 5)} onChange={(v) => updateRow(c.id, { time_slot_end: v })} />
                    </Td>
                    <Td>
                      <CellSelect
                        editing={editing}
                        value={c.skill_id}
                        onChange={(v) => updateRow(c.id, { skill_id: v })}
                        options={skillOptions}
                        display={skillName(c.skill_id)}
                      />
                    </Td>
                    <Td>
                      <CellNumber editing={editing} value={c.min_agents_required} onChange={(v) => updateRow(c.id, { min_agents_required: v ?? 0 })} />
                    </Td>
                    <Td>
                      <CellNumber editing={editing} value={c.weight} onChange={(v) => updateRow(c.id, { weight: v ?? 0 })} step="0.1" />
                    </Td>
                    <Td>
                      {editing ? (
                        <CellCheckbox editing checked={c.is_peak} onChange={(v) => updateRow(c.id, { is_peak: v })} />
                      ) : c.is_peak ? (
                        <span className="inline-flex items-center rounded-full border border-warning-border bg-warning-subtle px-2 py-0.5 text-[11px] font-medium text-warning">
                          Peak
                        </span>
                      ) : (
                        '—'
                      )}
                    </Td>
                    {!editing && (
                      <Td className="text-right">
                        <Button variant="danger" onClick={() => deleteMutation.mutate(c.id)}>
                          Delete
                        </Button>
                      </Td>
                    )}
                  </Tr>
                ))}
            </Tbody>
          </ScrollTable>
        </>
      )}
    </div>
  )
}

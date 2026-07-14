import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { extractErrorMessage } from '../../../api/client'
import { createAgent, deleteAgent, listAgents, listShiftTemplates, listSkills, updateAgent } from '../../../api/endpoints'
import type { Agent } from '../../../types'
import {
  Button,
  CellCheckbox,
  CellMultiSelect,
  CellNumber,
  CellSelect,
  CellText,
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
  const [offDaysPerWeek, setOffDaysPerWeek] = useState('1')
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [rows, setRows] = useState<Agent[]>([])

  const [nameFilter, setNameFilter] = useState('')
  const [defaultShiftFilter, setDefaultShiftFilter] = useState('')
  const [possibleShiftFilter, setPossibleShiftFilter] = useState<number[]>([])
  const [offDayTypeFilter, setOffDayTypeFilter] = useState('')
  const [fixedDayFilter, setFixedDayFilter] = useState('')
  const [skillFilter, setSkillFilter] = useState<number[]>([])
  const [activeFilter, setActiveFilter] = useState('')

  useEffect(() => {
    if (!editing && agentsQuery.data) setRows(agentsQuery.data)
  }, [agentsQuery.data, editing])

  const dirtyRows = rows.filter((r) => {
    const orig = agentsQuery.data?.find((o) => o.id === r.id)
    if (!orig) return false
    return (
      orig.name !== r.name ||
      orig.default_shift_id !== r.default_shift_id ||
      orig.default_off_day_type !== r.default_off_day_type ||
      orig.default_off_day !== r.default_off_day ||
      orig.default_off_days_per_week !== r.default_off_days_per_week ||
      orig.active !== r.active ||
      orig.skill_ids.slice().sort().join(',') !== r.skill_ids.slice().sort().join(',') ||
      orig.possible_shift_ids.slice().sort().join(',') !== r.possible_shift_ids.slice().sort().join(',')
    )
  })

  const createMutation = useMutation({
    mutationFn: () =>
      createAgent({
        name,
        default_shift_id: shiftId ? Number(shiftId) : undefined,
        skill_ids: skillIds,
        default_off_day_type: offDayType,
        default_off_day: offDayType === 'fixed' ? Number(offDay) : undefined,
        default_off_days_per_week: Number(offDaysPerWeek),
      }),
    onSuccess: () => {
      setName('')
      setSkillIds([])
      setOffDaysPerWeek('1')
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAgent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(
        dirtyRows.map((r) =>
          updateAgent(r.id, {
            name: r.name,
            default_shift_id: r.default_shift_id,
            default_off_day_type: r.default_off_day_type,
            default_off_day: r.default_off_day_type === 'fixed' ? r.default_off_day : null,
            default_off_days_per_week: r.default_off_days_per_week,
            active: r.active,
            skill_ids: r.skill_ids,
            possible_shift_ids: r.possible_shift_ids,
          }),
        ),
      )
    },
    onSuccess: () => {
      setError(null)
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const updateRow = (id: number, patch: Partial<Agent>) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const shiftName = (id: number | null) => (id ? shiftsQuery.data?.find((s) => s.id === id)?.name ?? `#${id}` : '—')
  const shiftOptions = [{ value: 0, label: 'None' }, ...(shiftsQuery.data ?? []).map((s) => ({ value: s.id, label: s.name }))]
  const offDayTypeOptions = [
    { value: 'flexible', label: 'Flexible' },
    { value: 'fixed', label: 'Fixed' },
  ]
  const weekdayOptions = WEEKDAY_NAMES.map((d, i) => ({ value: i, label: d }))
  const skillOptions = (skillsQuery.data ?? []).map((s) => ({ id: s.id, label: s.name }))
  const shiftMultiOptions = (shiftsQuery.data ?? []).map((s) => ({ id: s.id, label: s.name }))

  const filteredRows = useMemo(() => {
    return rows.filter((a) => {
      if (nameFilter && !a.name.toLowerCase().includes(nameFilter.toLowerCase())) return false
      if (defaultShiftFilter && String(a.default_shift_id ?? '') !== defaultShiftFilter) return false
      if (possibleShiftFilter.length && !possibleShiftFilter.some((id) => a.possible_shift_ids.includes(id))) return false
      if (offDayTypeFilter && a.default_off_day_type !== offDayTypeFilter) return false
      if (fixedDayFilter && String(a.default_off_day ?? '') !== fixedDayFilter) return false
      if (skillFilter.length && !skillFilter.some((id) => a.skill_ids.includes(id))) return false
      if (activeFilter && String(a.active) !== activeFilter) return false
      return true
    })
  }, [rows, nameFilter, defaultShiftFilter, possibleShiftFilter, offDayTypeFilter, fixedDayFilter, skillFilter, activeFilter])

  const hasActiveFilters =
    nameFilter || defaultShiftFilter || possibleShiftFilter.length || offDayTypeFilter || fixedDayFilter || skillFilter.length || activeFilter

  const clearFilters = () => {
    setNameFilter('')
    setDefaultShiftFilter('')
    setPossibleShiftFilter([])
    setOffDayTypeFilter('')
    setFixedDayFilter('')
    setSkillFilter([])
    setActiveFilter('')
  }

  return (
    <div>
      <details className="mb-3 rounded-lg border border-slate-200 bg-white shadow-sm">
        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-slate-700">+ Add an agent</summary>
        <div className="border-t border-slate-100 p-3">
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
            <Field label="Off days per week">
              <Input type="number" min={0} max={7} value={offDaysPerWeek} onChange={(e) => setOffDaysPerWeek(e.target.value)} />
            </Field>
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
        </div>
      </details>

      {agentsQuery.isLoading && <LoadingText />}
      {agentsQuery.data && agentsQuery.data.length === 0 && <EmptyState text="No agents yet." />}
      {agentsQuery.data && agentsQuery.data.length > 0 && (
        <>
          <ErrorBanner message={editing ? error : null} />

          <div className="mb-3 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="w-40">
              <Field label="Name">
                <Input placeholder="Search name…" value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} />
              </Field>
            </div>
            <div className="w-40">
              <Field label="Default shift">
                <Select value={defaultShiftFilter} onChange={(e) => setDefaultShiftFilter(e.target.value)}>
                  <option value="">All</option>
                  {shiftsQuery.data?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="w-56">
              <span className="mb-1 block text-xs font-medium text-slate-600">Possible shifts</span>
              <CellMultiSelect editing selected={possibleShiftFilter} onChange={setPossibleShiftFilter} options={shiftMultiOptions} />
            </div>
            <div className="w-36">
              <Field label="Off-day type">
                <Select value={offDayTypeFilter} onChange={(e) => setOffDayTypeFilter(e.target.value)}>
                  <option value="">All</option>
                  <option value="flexible">Flexible</option>
                  <option value="fixed">Fixed</option>
                </Select>
              </Field>
            </div>
            <div className="w-36">
              <Field label="Fixed day">
                <Select value={fixedDayFilter} onChange={(e) => setFixedDayFilter(e.target.value)}>
                  <option value="">All</option>
                  {WEEKDAY_NAMES.map((d, i) => (
                    <option key={i} value={i}>
                      {d}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="w-56">
              <span className="mb-1 block text-xs font-medium text-slate-600">Skills (any match)</span>
              <CellMultiSelect editing selected={skillFilter} onChange={setSkillFilter} options={skillOptions} />
            </div>
            <div className="w-32">
              <Field label="Active">
                <Select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
                  <option value="">All</option>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </Select>
              </Field>
            </div>
            {hasActiveFilters && (
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
            <span className="ml-auto text-xs text-slate-500">
              {filteredRows.length} of {rows.length} agents
            </span>
          </div>

          <EditBar
            editing={editing}
            dirtyCount={dirtyRows.length}
            saving={saveMutation.isPending}
            onEdit={() => setEditing(true)}
            onSave={() => saveMutation.mutate()}
            onCancel={() => {
              setRows(agentsQuery.data ?? [])
              setEditing(false)
              setError(null)
            }}
          />
          <ScrollTable>
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Default shift</Th>
                <Th>Possible shifts</Th>
                <Th>Off-day type</Th>
                <Th>Fixed day</Th>
                <Th>Off days/wk</Th>
                <Th>Skills</Th>
                <Th>Active</Th>
                {!editing && <Th></Th>}
              </Tr>
            </Thead>
            <Tbody>
              {filteredRows.map((a) => (
                <Tr key={a.id}>
                  <Td className="font-medium text-slate-800">
                    <CellText editing={editing} value={a.name} onChange={(v) => updateRow(a.id, { name: v })} />
                  </Td>
                  <Td>
                    <CellSelect
                      editing={editing}
                      value={a.default_shift_id ?? 0}
                      onChange={(v) => updateRow(a.id, { default_shift_id: v === 0 ? null : v })}
                      options={shiftOptions}
                      display={shiftName(a.default_shift_id)}
                    />
                  </Td>
                  <Td className="max-w-xs">
                    <CellMultiSelect
                      editing={editing}
                      selected={a.possible_shift_ids}
                      onChange={(ids) => updateRow(a.id, { possible_shift_ids: ids })}
                      options={shiftMultiOptions}
                    />
                  </Td>
                  <Td>
                    <CellSelect
                      editing={editing}
                      value={a.default_off_day_type}
                      onChange={(v) => updateRow(a.id, { default_off_day_type: v as 'fixed' | 'flexible' })}
                      options={offDayTypeOptions}
                      display={a.default_off_day_type === 'fixed' ? 'Fixed' : 'Flexible'}
                    />
                  </Td>
                  <Td>
                    {a.default_off_day_type === 'fixed' ? (
                      <CellSelect
                        editing={editing}
                        value={a.default_off_day ?? 0}
                        onChange={(v) => updateRow(a.id, { default_off_day: v })}
                        options={weekdayOptions}
                        display={WEEKDAY_NAMES[a.default_off_day ?? 0]}
                      />
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </Td>
                  <Td>
                    <CellNumber
                      editing={editing}
                      value={a.default_off_days_per_week}
                      onChange={(v) => updateRow(a.id, { default_off_days_per_week: v ?? 1 })}
                    />
                  </Td>
                  <Td className="max-w-xs">
                    <CellMultiSelect editing={editing} selected={a.skill_ids} onChange={(ids) => updateRow(a.id, { skill_ids: ids })} options={skillOptions} />
                  </Td>
                  <Td>
                    <CellCheckbox editing={editing} checked={a.active} onChange={(v) => updateRow(a.id, { active: v })} />
                  </Td>
                  {!editing && (
                    <Td className="text-right">
                      <Button variant="danger" onClick={() => deleteMutation.mutate(a.id)}>
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

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { extractErrorMessage } from '../../../api/client'
import { createShiftTemplate, deleteShiftTemplate, listShiftTemplates, updateShiftTemplate } from '../../../api/endpoints'
import type { ShiftTemplate } from '../../../types'
import {
  Button,
  CellNumber,
  CellText,
  CellTime,
  EditBar,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  LoadingText,
  ScrollTable,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '../../../components/ui'

export default function ShiftsConfig() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['shift-templates'], queryFn: listShiftTemplates })
  const [name, setName] = useState('')
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('18:00')
  const [breakMinutes, setBreakMinutes] = useState('60')
  const [maxAgents, setMaxAgents] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [rows, setRows] = useState<ShiftTemplate[]>([])

  useEffect(() => {
    if (!editing && query.data) setRows(query.data)
  }, [query.data, editing])

  const dirtyRows = rows.filter((r) => {
    const orig = query.data?.find((o) => o.id === r.id)
    return (
      orig &&
      (orig.name !== r.name ||
        orig.start_time !== r.start_time ||
        orig.end_time !== r.end_time ||
        orig.break_duration_minutes !== r.break_duration_minutes ||
        orig.max_agents !== r.max_agents)
    )
  })

  const createMutation = useMutation({
    mutationFn: () =>
      createShiftTemplate({
        name,
        start_time: `${start}:00`,
        end_time: `${end}:00`,
        break_duration_minutes: breakMinutes ? Number(breakMinutes) : null,
        max_agents: maxAgents ? Number(maxAgents) : null,
      }),
    onSuccess: () => {
      setName('')
      setMaxAgents('')
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

  const saveMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(
        dirtyRows.map((r) =>
          updateShiftTemplate(r.id, {
            name: r.name,
            start_time: r.start_time.length === 5 ? `${r.start_time}:00` : r.start_time,
            end_time: r.end_time.length === 5 ? `${r.end_time}:00` : r.end_time,
            break_duration_minutes: r.break_duration_minutes,
            max_agents: r.max_agents,
          }),
        ),
      )
    },
    onSuccess: () => {
      setError(null)
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['shift-templates'] })
    },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const updateRow = (id: number, patch: Partial<ShiftTemplate>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  return (
    <div>
      <details className="mb-3 rounded-lg border border-slate-200 bg-white shadow-sm">
        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-slate-700">+ Add a shift template</summary>
        <div className="border-t border-slate-100 p-3">
          <p className="mb-3 text-xs text-slate-500">
            Shifts can overlap and can wrap past midnight (e.g. 21:00 → 06:00). Break time is for reporting only.
            <strong> Max/day</strong> is a hard cap on how many agents may be scheduled on this shift on any single day
            (e.g. Overnight = 2); leave blank for no cap.
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
            <Field label="Max/day">
              <Input type="number" min={1} placeholder="∞" value={maxAgents} onChange={(e) => setMaxAgents(e.target.value)} className="w-24" />
            </Field>
            <Button type="submit" disabled={createMutation.isPending}>
              Add
            </Button>
          </form>
        </div>
      </details>

      {query.isLoading && <LoadingText />}
      {query.data && query.data.length === 0 && <EmptyState text="No shift templates configured yet." />}
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
                <Th>Name</Th>
                <Th>Start</Th>
                <Th>End</Th>
                <Th>Break (min)</Th>
                <Th>Max/day</Th>
                {!editing && <Th></Th>}
              </Tr>
            </Thead>
            <Tbody>
              {rows.map((s) => (
                <Tr key={s.id}>
                  <Td className="font-medium text-slate-800">
                    <CellText editing={editing} value={s.name} onChange={(v) => updateRow(s.id, { name: v })} />
                  </Td>
                  <Td>
                    <CellTime editing={editing} value={s.start_time.slice(0, 5)} onChange={(v) => updateRow(s.id, { start_time: v })} />
                  </Td>
                  <Td>
                    <CellTime editing={editing} value={s.end_time.slice(0, 5)} onChange={(v) => updateRow(s.id, { end_time: v })} />
                  </Td>
                  <Td>
                    <CellNumber editing={editing} value={s.break_duration_minutes} onChange={(v) => updateRow(s.id, { break_duration_minutes: v })} />
                  </Td>
                  <Td>
                    {editing ? (
                      <CellNumber editing value={s.max_agents} onChange={(v) => updateRow(s.id, { max_agents: v })} />
                    ) : s.max_agents == null ? (
                      <span className="text-slate-400">∞</span>
                    ) : (
                      s.max_agents
                    )}
                  </Td>
                  {!editing && (
                    <Td className="text-right">
                      <Button variant="danger" onClick={() => deleteMutation.mutate(s.id)}>
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

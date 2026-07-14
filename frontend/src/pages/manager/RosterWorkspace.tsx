import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient, extractErrorMessage } from '../../api/client'
import {
  generateRoster,
  getRosterAssignments,
  getRosterConflicts,
  getRosterDetail,
  getRosterSatisfaction,
  importRoster,
  listAgents,
  listShiftTemplates,
  listSkills,
  listWeeklyCycles,
  lockRoster,
  overrideAssignment,
  publishRoster,
} from '../../api/endpoints'
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  PageTitle,
  ScrollTable,
  Select,
  StatusBadge,
  SuccessBanner,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '../../components/ui'
import { DEFAULT_SHIFT_COLOR, SHIFT_COLORS, toCompact12h, weekdayLabel } from '../../lib/rosterGrid'
import type { ConflictReport, RosterAssignment, SatisfactionMetric } from '../../types'

export default function RosterWorkspace() {
  const queryClient = useQueryClient()
  const cyclesQuery = useQuery({ queryKey: ['weekly-cycles'], queryFn: listWeeklyCycles })
  const agentsQuery = useQuery({ queryKey: ['agents'], queryFn: listAgents })
  const shiftsQuery = useQuery({ queryKey: ['shift-templates'], queryFn: listShiftTemplates })
  const skillsQuery = useQuery({ queryKey: ['skills'], queryFn: listSkills })

  const [cycleId, setCycleId] = useState('')
  const [rosterId, setRosterId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const rosterQuery = useQuery({
    queryKey: ['roster-detail', rosterId],
    queryFn: () => getRosterDetail(rosterId!),
    enabled: rosterId != null,
  })
  const assignmentsQuery = useQuery({
    queryKey: ['roster-assignments', rosterId],
    queryFn: () => getRosterAssignments(rosterId!),
    enabled: rosterId != null,
  })
  const conflictsQuery = useQuery<ConflictReport[]>({
    queryKey: ['roster-conflicts', rosterId],
    queryFn: () => getRosterConflicts(rosterId!),
    enabled: rosterId != null,
  })
  const satisfactionQuery = useQuery<SatisfactionMetric[]>({
    queryKey: ['roster-satisfaction', rosterId],
    queryFn: () => getRosterSatisfaction(rosterId!),
    enabled: rosterId != null,
  })

  const generateMutation = useMutation({
    mutationFn: () => generateRoster(Number(cycleId)),
    onSuccess: (data) => {
      setRosterId(data.roster.id)
      setError(null)
      setSuccess('Roster generated.')
      invalidateRosterQueries()
    },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const publishMutation = useMutation({
    mutationFn: () => publishRoster(rosterId!),
    onSuccess: () => {
      setSuccess('Roster published — now publicly visible.')
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['roster-detail', rosterId] })
    },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const lockMutation = useMutation({
    mutationFn: () => lockRoster(rosterId!),
    onSuccess: () => {
      setSuccess('Roster locked.')
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['roster-detail', rosterId] })
    },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  function invalidateRosterQueries() {
    queryClient.invalidateQueries({ queryKey: ['roster-assignments', rosterId] })
    queryClient.invalidateQueries({ queryKey: ['roster-conflicts', rosterId] })
    queryClient.invalidateQueries({ queryKey: ['roster-satisfaction', rosterId] })
    queryClient.invalidateQueries({ queryKey: ['roster-detail', rosterId] })
  }

  // --- import ---
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importReason, setImportReason] = useState('')
  const importMutation = useMutation({
    mutationFn: () => importRoster(rosterId!, importFile!, importReason || undefined),
    onSuccess: (data) => {
      setSuccess(
        data.overridden_requests.length
          ? `Import applied. Overridden: ${data.overridden_requests.join('; ')}`
          : 'Import applied cleanly.',
      )
      setError(null)
      setImportFile(null)
      setImportReason('')
      invalidateRosterQueries()
    },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  // --- single-cell override ---
  const [ovAgentId, setOvAgentId] = useState('')
  const [ovDate, setOvDate] = useState('')
  const [ovShiftId, setOvShiftId] = useState('')
  const [ovReason, setOvReason] = useState('')
  const overrideMutation = useMutation({
    mutationFn: () =>
      overrideAssignment(rosterId!, {
        agent_id: Number(ovAgentId),
        date: ovDate,
        shift_id: ovShiftId ? Number(ovShiftId) : null,
        // skill is inferred from the agent's own skills on the backend
        skill_id: null,
        reason: ovReason,
      }),
    onSuccess: (data) => {
      setSuccess(
        data.overridden_requests.length
          ? `Override applied. Reversed: ${data.overridden_requests.join('; ')}`
          : 'Override applied.',
      )
      setError(null)
      setOvReason('')
      invalidateRosterQueries()
    },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const [exporting, setExporting] = useState(false)
  async function handleExport() {
    if (rosterId == null) return
    setExporting(true)
    try {
      const response = await apiClient.get(`/roster/${rosterId}/export`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = `roster_${rosterId}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setExporting(false)
    }
  }

  const agentName = (id: number) => agentsQuery.data?.find((a) => a.id === id)?.name ?? `#${id}`
  const shiftName = (id: number) => shiftsQuery.data?.find((s) => s.id === id)?.name ?? `#${id}`
  const skillName = (id: number) => skillsQuery.data?.find((s) => s.id === id)?.name ?? `#${id}`

  const groupedAssignments = useMemo(() => {
    const map = new Map<string, typeof assignmentsQuery.data>()
    for (const a of assignmentsQuery.data ?? []) {
      const list = map.get(a.date) ?? []
      list.push(a)
      map.set(a.date, list)
    }
    return new Map([...map.entries()].sort())
  }, [assignmentsQuery.data])

  const gridDays = useMemo(() => [...groupedAssignments.keys()], [groupedAssignments])

  const gridAgents = useMemo(() => {
    const ids = new Set<number>()
    for (const a of assignmentsQuery.data ?? []) ids.add(a.agent_id)
    return [...ids].map((id) => ({ id, name: agentName(id) })).sort((a, b) => a.name.localeCompare(b.name))
  }, [assignmentsQuery.data, agentsQuery.data])

  const assignmentByAgentDate = useMemo(() => {
    const map = new Map<string, RosterAssignment>()
    for (const a of assignmentsQuery.data ?? []) map.set(`${a.agent_id}|${a.date}`, a)
    return map
  }, [assignmentsQuery.data])

  function shiftCompactLabel(shiftId: number): string {
    const shift = shiftsQuery.data?.find((s) => s.id === shiftId)
    if (!shift) return `#${shiftId}`
    return `${toCompact12h(shift.start_time)}-${toCompact12h(shift.end_time)}`
  }

  return (
    <div>
      <PageTitle subtitle="Generate the solver-driven roster, review conflicts and satisfaction, edit if needed, then publish and lock.">
        Roster Workspace
      </PageTitle>

      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Weekly cycle">
            <Select value={cycleId} onChange={(e) => setCycleId(e.target.value)} className="w-64">
              <option value="">Select a week…</option>
              {cyclesQuery.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  Week of {c.week_start_date} ({c.status})
                </option>
              ))}
            </Select>
          </Field>
          <Button disabled={!cycleId || generateMutation.isPending} onClick={() => generateMutation.mutate()}>
            {generateMutation.isPending ? 'Generating…' : 'Generate roster'}
          </Button>
          <Field label="Or load an existing roster by id">
            <Input
              type="number"
              className="w-32"
              value={rosterId ?? ''}
              onChange={(e) => setRosterId(e.target.value ? Number(e.target.value) : null)}
            />
          </Field>
        </div>
      </Card>

      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      {rosterId != null && rosterQuery.data && (
        <>
          <Card className="mb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-800">Roster #{rosterQuery.data.id}</p>
                <p className="text-sm text-slate-500">Generated by {rosterQuery.data.generated_by} at {new Date(rosterQuery.data.generated_at).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={rosterQuery.data.status} />
                <Button variant="secondary" disabled={exporting} onClick={handleExport}>
                  {exporting ? 'Exporting…' : 'Export .xlsx'}
                </Button>
                {rosterQuery.data.status === 'draft' && (
                  <Button disabled={publishMutation.isPending} onClick={() => publishMutation.mutate()}>
                    Publish
                  </Button>
                )}
                {rosterQuery.data.status === 'published' && (
                  <Button variant="danger" disabled={lockMutation.isPending} onClick={() => lockMutation.mutate()}>
                    Lock
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {conflictsQuery.data && conflictsQuery.data.length > 0 && (
            <Card className="mb-5">
              <h2 className="mb-2 font-medium text-slate-800">Conflict / toleration report</h2>
              <div className="space-y-2">
                {conflictsQuery.data.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
                    <span>{c.description}</span>
                    <StatusBadge status={c.severity} />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {satisfactionQuery.data && satisfactionQuery.data.length > 0 && (
            <Card className="mb-5">
              <h2 className="mb-2 font-medium text-slate-800">Satisfaction metrics</h2>
              <div className="flex flex-wrap gap-3">
                {satisfactionQuery.data.map((m) => (
                  <div key={m.id} className="rounded-md bg-slate-50 px-3 py-2 text-sm">
                    {m.agent_id ? agentName(m.agent_id) : 'Aggregate'}: <strong>{m.value}%</strong> requests honored
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="mb-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-medium text-slate-800">Assignments</h2>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {Object.entries(SHIFT_COLORS).map(([name, cls]) => (
                  <span key={name} className={`rounded px-1.5 py-0.5 ${cls}`}>
                    {name}
                  </span>
                ))}
              </div>
            </div>
            {assignmentsQuery.data && assignmentsQuery.data.length === 0 && <EmptyState text="No assignments." />}
            {gridDays.length > 0 && (
              <ScrollTable>
                <Thead>
                  <Tr>
                    <Th>Agent</Th>
                    {gridDays.map((d) => (
                      <Th key={d}>
                        {weekdayLabel(d)}
                        <span className="block font-normal normal-case text-slate-400">{d}</span>
                      </Th>
                    ))}
                  </Tr>
                </Thead>
                <Tbody>
                  {gridAgents.map((agent) => (
                    <Tr key={agent.id}>
                      <Td className="font-medium text-slate-800">{agent.name}</Td>
                      {gridDays.map((day) => {
                        const a = assignmentByAgentDate.get(`${agent.id}|${day}`)
                        if (!a) {
                          return (
                            <Td key={day}>
                              <span className="inline-block rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs font-semibold text-slate-500">
                                OFF
                              </span>
                            </Td>
                          )
                        }
                        const shift = shiftsQuery.data?.find((s) => s.id === a.shift_id)
                        const colorCls = (shift && SHIFT_COLORS[shift.name]) || DEFAULT_SHIFT_COLOR
                        return (
                          <Td key={day}>
                            <span
                              className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${colorCls}`}
                              title={`${shiftName(a.shift_id)} — ${skillName(a.skill_covered_id)}`}
                            >
                              {shiftCompactLabel(a.shift_id)}
                            </span>
                          </Td>
                        )
                      })}
                    </Tr>
                  ))}
                </Tbody>
              </ScrollTable>
            )}
          </Card>

          <div className="grid gap-5 sm:grid-cols-2">
            <Card>
              <h2 className="mb-3 font-medium text-slate-800">Re-upload edited Excel</h2>
              <div className="space-y-2">
                <input type="file" accept=".xlsx" onChange={(e) => setImportFile(e.target.files?.[0] ?? null)} className="text-sm" />
                <Input placeholder="Reason (required if it overrides a request outcome)" value={importReason} onChange={(e) => setImportReason(e.target.value)} />
                <Button disabled={!importFile || importMutation.isPending} onClick={() => importMutation.mutate()}>
                  Upload & re-validate
                </Button>
              </div>
            </Card>

            <Card>
              <h2 className="mb-1 font-medium text-slate-800">Single-assignment override</h2>
              <p className="mb-3 text-xs text-slate-500">
                Put an agent on a shift for one day, or set them off. The skill they cover is chosen automatically
                from their own skills; the edit is rejected if it breaks a hard constraint (double-booking, an
                approved leave day, or a coverage minimum).
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Agent">
                  <Select value={ovAgentId} onChange={(e) => setOvAgentId(e.target.value)}>
                    <option value="">Select…</option>
                    {agentsQuery.data?.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Date">
                  <Input type="date" value={ovDate} onChange={(e) => setOvDate(e.target.value)} />
                </Field>
                <div className="col-span-2">
                  <Field label="Shift">
                    <Select value={ovShiftId} onChange={(e) => setOvShiftId(e.target.value)}>
                      <option value="">Off (unassign — give this day off)</option>
                      {shiftsQuery.data?.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.start_time}–{s.end_time})
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Input
                  className="col-span-2"
                  placeholder="Reason (always required)"
                  value={ovReason}
                  onChange={(e) => setOvReason(e.target.value)}
                />
                <Button
                  className="col-span-2"
                  disabled={!ovAgentId || !ovDate || !ovReason || overrideMutation.isPending}
                  onClick={() => overrideMutation.mutate()}
                >
                  Apply override
                </Button>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

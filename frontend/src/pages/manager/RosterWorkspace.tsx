import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Download, Lock, Send, Upload, Wand2 } from 'lucide-react'
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
  CardHeader,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  PageTitle,
  Select,
  StatusBadge,
  SuccessBanner,
  cn,
} from '../../components/ui'
import { OffChip, RosterGrid, ShiftChip, ShiftLegend } from '../../components/RosterGrid'
import { DEFAULT_SHIFT_COLOR, SHIFT_COLORS, toCompact12h } from '../../lib/rosterGrid'
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

  function invalidateRosterQueries() {
    queryClient.invalidateQueries({ queryKey: ['roster-assignments', rosterId] })
    queryClient.invalidateQueries({ queryKey: ['roster-conflicts', rosterId] })
    queryClient.invalidateQueries({ queryKey: ['roster-satisfaction', rosterId] })
    queryClient.invalidateQueries({ queryKey: ['roster-detail', rosterId] })
  }

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

  const gridDays = useMemo(() => {
    const days = new Set<string>()
    for (const a of assignmentsQuery.data ?? []) days.add(a.date)
    return [...days].sort()
  }, [assignmentsQuery.data])

  const gridRows = useMemo(() => {
    const ids = new Set<number>()
    for (const a of assignmentsQuery.data ?? []) ids.add(a.agent_id)
    return [...ids]
      .map((id) => ({ id, name: agentName(id) }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((a) => ({ key: String(a.id), name: a.name }))
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

  // --- selected cell drives the override panel ---
  const [selected, setSelected] = useState<{ rowKey: string; day: string } | null>(null)
  useEffect(() => {
    if (!selected) return
    setOvAgentId(selected.rowKey)
    setOvDate(selected.day)
    const current = assignmentByAgentDate.get(`${selected.rowKey}|${selected.day}`)
    setOvShiftId(current ? String(current.shift_id) : '')
  }, [selected, assignmentByAgentDate])

  const status = rosterQuery.data?.status
  const conflicts = conflictsQuery.data ?? []
  const criticalCount = conflicts.filter((c) => c.severity === 'critical').length

  return (
    <div>
      <PageTitle subtitle="Generate the solver-driven roster, review conflicts, edit inline, then publish and lock.">
        Roster Workspace
      </PageTitle>

      {/* Cycle / generate control */}
      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-72">
            <Field label="Weekly cycle">
              <Select value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
                <option value="">Select a week…</option>
                {cyclesQuery.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    Week of {c.week_start_date} ({c.status})
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button
            icon={Wand2}
            disabled={!cycleId || generateMutation.isPending}
            loading={generateMutation.isPending}
            onClick={() => generateMutation.mutate()}
          >
            Generate roster
          </Button>
          <div className="w-40">
            <Field label="Load existing by ID">
              <Input
                type="number"
                placeholder="Roster ID"
                value={rosterId ?? ''}
                onChange={(e) => setRosterId(e.target.value ? Number(e.target.value) : null)}
              />
            </Field>
          </div>
        </div>
      </Card>

      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      {rosterId == null || !rosterQuery.data ? (
        <EmptyState
          title="No roster loaded"
          text="Pick a weekly cycle and generate a roster, or load an existing one by ID to start reviewing."
          icon={Wand2}
        />
      ) : (
        <>
          {/* Roster action bar */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface px-4 py-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-ink">Roster #{rosterQuery.data.id}</span>
                  <StatusBadge status={rosterQuery.data.status} />
                </div>
                <p className="text-xs text-ink-muted">
                  {rosterQuery.data.generated_by} · {new Date(rosterQuery.data.generated_at).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" icon={Download} disabled={exporting} loading={exporting} onClick={handleExport}>
                Export .xlsx
              </Button>
              {status === 'draft' && (
                <Button icon={Send} disabled={publishMutation.isPending} loading={publishMutation.isPending} onClick={() => publishMutation.mutate()}>
                  Publish
                </Button>
              )}
              {status === 'published' && (
                <Button variant="danger" icon={Lock} disabled={lockMutation.isPending} loading={lockMutation.isPending} onClick={() => lockMutation.mutate()}>
                  Lock
                </Button>
              )}
            </div>
          </div>

          {/* Grid (primary) + context sidebar */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section className="min-w-0">
              <Card padded={false}>
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <h2 className="text-[13px] font-semibold text-ink">Assignments</h2>
                  <ShiftLegend entries={Object.entries(SHIFT_COLORS) as [string, string][]} />
                </div>
                {gridDays.length === 0 ? (
                  <div className="p-4 pt-0">
                    <EmptyState text="This roster has no assignments." />
                  </div>
                ) : (
                  <div className="p-2 pt-0">
                    <RosterGrid
                      days={gridDays}
                      rows={gridRows}
                      selectedCell={selected}
                      onSelectCell={(rowKey, day) => setSelected({ rowKey, day })}
                      renderCell={(rowKey, day) => {
                        const a = assignmentByAgentDate.get(`${rowKey}|${day}`)
                        if (!a) return <OffChip />
                        const shift = shiftsQuery.data?.find((s) => s.id === a.shift_id)
                        return (
                          <ShiftChip
                            label={shiftCompactLabel(a.shift_id)}
                            colorClass={(shift && SHIFT_COLORS[shift.name]) || DEFAULT_SHIFT_COLOR}
                            title={`${shiftName(a.shift_id)} — ${skillName(a.skill_covered_id)}`}
                          />
                        )
                      }}
                    />
                  </div>
                )}
              </Card>
            </section>

            <aside className="flex flex-col gap-5">
              {/* Health summary */}
              <Card>
                <CardHeader title="Roster health" />
                <div className="grid grid-cols-2 gap-3">
                  <HealthStat
                    label="Conflicts"
                    value={conflicts.length}
                    tone={criticalCount > 0 ? 'critical' : conflicts.length > 0 ? 'warning' : 'success'}
                  />
                  <HealthStat
                    label="Requests honored"
                    value={
                      satisfactionQuery.data && satisfactionQuery.data.length
                        ? `${Math.round(
                            satisfactionQuery.data.reduce((s, m) => s + m.value, 0) / satisfactionQuery.data.length,
                          )}%`
                        : '—'
                    }
                    tone="info"
                  />
                </div>
              </Card>

              {/* Selected cell / override */}
              <Card>
                <CardHeader title="Edit assignment" description={selected ? undefined : 'Select a cell in the grid, or choose an agent and date.'} />
                {selected && (
                  <div className="mb-3 rounded-input border border-accent-ring/40 bg-accent-subtle px-3 py-2">
                    <p className="text-[13px] font-medium text-ink">{agentName(Number(selected.rowKey))}</p>
                    <p className="text-xs text-ink-muted">{selected.day}</p>
                  </div>
                )}
                <div className="space-y-3">
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
                  <Field label="Shift">
                    <Select value={ovShiftId} onChange={(e) => setOvShiftId(e.target.value)}>
                      <option value="">Off (give this day off)</option>
                      {shiftsQuery.data?.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.start_time}–{s.end_time})
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Reason" required>
                    <Input placeholder="Always required" value={ovReason} onChange={(e) => setOvReason(e.target.value)} />
                  </Field>
                  <p className="text-xs leading-relaxed text-ink-muted">
                    The covered skill is chosen automatically. Rejected if it breaks a hard constraint (double-booking, an
                    approved leave day, or a coverage minimum).
                  </p>
                  <Button
                    className="w-full"
                    disabled={!ovAgentId || !ovDate || !ovReason || overrideMutation.isPending}
                    loading={overrideMutation.isPending}
                    onClick={() => overrideMutation.mutate()}
                  >
                    Apply override
                  </Button>
                </div>
              </Card>

              {/* Conflicts */}
              {conflicts.length > 0 && (
                <Card>
                  <CardHeader title="Conflict report" />
                  <ul className="space-y-2">
                    {conflicts.map((c) => (
                      <li key={c.id} className="flex items-start gap-2 text-[13px]">
                        {c.severity === 'critical' ? (
                          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-critical" />
                        ) : (
                          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                        )}
                        <span className="text-ink-secondary">{c.description}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {/* Import */}
              <Card>
                <CardHeader title="Re-upload edited Excel" description="Round-trip the exported sheet with your edits." />
                <div className="space-y-2.5">
                  <label className="flex cursor-pointer items-center gap-2 rounded-input border border-dashed border-line-strong bg-surface-muted px-3 py-2.5 text-[13px] text-ink-secondary hover:border-accent hover:bg-accent-subtle/40">
                    <Upload className="size-4 text-ink-muted" />
                    <span className="truncate">{importFile ? importFile.name : 'Choose .xlsx file…'}</span>
                    <input type="file" accept=".xlsx" className="hidden" onChange={(e) => setImportFile(e.target.files?.[0] ?? null)} />
                  </label>
                  <Input
                    placeholder="Reason (if it overrides a request)"
                    value={importReason}
                    onChange={(e) => setImportReason(e.target.value)}
                  />
                  <Button
                    variant="secondary"
                    className="w-full"
                    icon={Upload}
                    disabled={!importFile || importMutation.isPending}
                    loading={importMutation.isPending}
                    onClick={() => importMutation.mutate()}
                  >
                    Upload & re-validate
                  </Button>
                </div>
              </Card>
            </aside>
          </div>
        </>
      )}
    </div>
  )
}

function HealthStat({
  label,
  value,
  tone,
}: {
  label: string
  value: React.ReactNode
  tone: 'success' | 'warning' | 'critical' | 'info'
}) {
  const toneClass = {
    success: 'text-success',
    warning: 'text-warning',
    critical: 'text-critical',
    info: 'text-info',
  }[tone]
  return (
    <div className="rounded-input border border-line bg-surface-muted px-3 py-2.5">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className={cn('mt-0.5 text-xl font-semibold tabular-nums', toneClass)}>{value}</div>
    </div>
  )
}

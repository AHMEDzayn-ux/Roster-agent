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
  Select,
  StatusBadge,
  SuccessBanner,
} from '../../components/ui'
import type { ConflictReport, SatisfactionMetric } from '../../types'

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
  const [ovSkillId, setOvSkillId] = useState('')
  const [ovReason, setOvReason] = useState('')
  const overrideMutation = useMutation({
    mutationFn: () =>
      overrideAssignment(rosterId!, {
        agent_id: Number(ovAgentId),
        date: ovDate,
        shift_id: ovShiftId ? Number(ovShiftId) : null,
        skill_id: ovSkillId ? Number(ovSkillId) : null,
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
            <h2 className="mb-3 font-medium text-slate-800">Assignments</h2>
            {assignmentsQuery.data && assignmentsQuery.data.length === 0 && <EmptyState text="No assignments." />}
            {groupedAssignments.size > 0 && (
              <div className="space-y-4">
                {[...groupedAssignments.entries()].map(([date, rows]) => (
                  <div key={date}>
                    <h3 className="mb-1 text-sm font-medium text-slate-600">{date}</h3>
                    <table className="w-full text-left text-sm">
                      <tbody>
                        {rows?.map((a) => (
                          <tr key={a.id} className="border-b border-slate-100 last:border-0">
                            <td className="py-1 pr-4">{agentName(a.agent_id)}</td>
                            <td className="py-1 pr-4">{shiftName(a.shift_id)}</td>
                            <td className="py-1 pr-4">{skillName(a.skill_covered_id)}</td>
                            <td className="py-1 text-xs text-slate-400">{a.source}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
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
              <h2 className="mb-3 font-medium text-slate-800">Single-assignment override</h2>
              <div className="grid grid-cols-2 gap-2">
                <Select value={ovAgentId} onChange={(e) => setOvAgentId(e.target.value)}>
                  <option value="">Agent…</option>
                  {agentsQuery.data?.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
                <Input type="date" value={ovDate} onChange={(e) => setOvDate(e.target.value)} />
                <Select value={ovShiftId} onChange={(e) => setOvShiftId(e.target.value)}>
                  <option value="">No shift (unassign)</option>
                  {shiftsQuery.data?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
                <Select value={ovSkillId} onChange={(e) => setOvSkillId(e.target.value)}>
                  <option value="">Skill…</option>
                  {skillsQuery.data?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
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

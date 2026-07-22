import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Sparkles } from 'lucide-react'
import { extractErrorMessage } from '../../../api/client'
import { createLeaveBalance, listAgents, listLeaveBalances, updateLeaveBalance } from '../../../api/endpoints'
import {
  Badge,
  Button,
  CellNumber,
  Checkbox,
  EditBar,
  ErrorBanner,
  Field,
  Input,
  LoadingText,
  ScrollTable,
  SuccessBanner,
  Tbody,
  Td,
  Th,
  Thead,
  Toolbar,
  Tr,
} from '../../../components/ui'

interface Row {
  agentId: number
  agentName: string
  hasBalance: boolean
  allotted: number
  taken: number
  halfDays: number
  remaining: number
}

export default function LeaveBalancesConfig() {
  const queryClient = useQueryClient()
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const agentsQuery = useQuery({ queryKey: ['agents'], queryFn: listAgents })
  const balancesQuery = useQuery({ queryKey: ['leave-balances', year], queryFn: () => listLeaveBalances(Number(year)) })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [rows, setRows] = useState<Row[]>([])

  const [search, setSearch] = useState('')
  const [missingOnly, setMissingOnly] = useState(false)
  const [grantDefault, setGrantDefault] = useState('21')

  const buildRows = (): Row[] => {
    const balances = balancesQuery.data ?? []
    return (agentsQuery.data ?? [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((a) => {
        const b = balances.find((x) => x.agent_id === a.id)
        return {
          agentId: a.id,
          agentName: a.name,
          hasBalance: Boolean(b),
          allotted: b?.total_leave_days_allotted ?? 0,
          taken: b?.leave_days_taken ?? 0,
          halfDays: b?.half_days_taken ?? 0,
          remaining: b?.remaining_balance ?? 0,
        }
      })
  }

  useEffect(() => {
    if (!editing && agentsQuery.data && balancesQuery.data) setRows(buildRows())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentsQuery.data, balancesQuery.data, editing])

  const original = agentsQuery.data && balancesQuery.data ? buildRows() : []
  const dirtyRows = rows.filter((r) => {
    const orig = original.find((o) => o.agentId === r.agentId)
    return orig && orig.allotted !== r.allotted
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(
        dirtyRows.map((r) =>
          r.hasBalance
            ? updateLeaveBalance(r.agentId, r.allotted, Number(year))
            : createLeaveBalance({ agent_id: r.agentId, year: Number(year), total_leave_days_allotted: r.allotted }),
        ),
      )
    },
    onSuccess: () => {
      setError(null)
      setSuccess(`${dirtyRows.length} balance${dirtyRows.length === 1 ? '' : 's'} saved.`)
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['leave-balances', year] })
    },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const missingRows = rows.filter((r) => !r.hasBalance)
  const grantMutation = useMutation({
    mutationFn: async () => {
      const amount = Number(grantDefault) || 0
      await Promise.all(
        missingRows.map((r) =>
          createLeaveBalance({ agent_id: r.agentId, year: Number(year), total_leave_days_allotted: amount }),
        ),
      )
    },
    onSuccess: () => {
      setError(null)
      setSuccess(`Granted ${grantDefault} days to ${missingRows.length} agent${missingRows.length === 1 ? '' : 's'}.`)
      queryClient.invalidateQueries({ queryKey: ['leave-balances', year] })
    },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const updateRow = (agentId: number, allotted: number) =>
    setRows((prev) => prev.map((r) => (r.agentId === agentId ? { ...r, allotted } : r)))

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (missingOnly && r.hasBalance) return false
      if (q && !r.agentName.toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, search, missingOnly])

  const withBalance = rows.filter((r) => r.hasBalance).length
  const isLoading = agentsQuery.isLoading || balancesQuery.isLoading

  return (
    <div>
      <Toolbar>
        <div className="w-24">
          <Field label="Year">
            <Input
              type="number"
              value={year}
              onChange={(e) => {
                setYear(e.target.value)
                setEditing(false)
                setSuccess(null)
              }}
            />
          </Field>
        </div>
        <div className="relative w-56">
          <Search className="pointer-events-none absolute left-2.5 top-[30px] size-3.5 -translate-y-1/2 text-ink-muted" />
          <Field label="Search agent">
            <Input className="pl-8" placeholder="Name…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </Field>
        </div>
        <div className="pb-1.5">
          <Checkbox label="Missing only" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} />
        </div>
        <div className="ml-auto flex items-center gap-2 self-end pb-0.5">
          <Badge tone={withBalance === rows.length ? 'success' : 'warning'}>
            {withBalance} / {rows.length} have a balance
          </Badge>
        </div>
      </Toolbar>

      {isLoading && <LoadingText />}
      {!isLoading && (
        <>
          <ErrorBanner message={error} />
          <SuccessBanner message={success} />

          {missingRows.length > 0 && !editing && (
            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-card border border-warning-border bg-warning-subtle px-3.5 py-2.5">
              <span className="text-[13px] text-ink-secondary">
                <span className="font-semibold text-ink">{missingRows.length}</span> agent
                {missingRows.length === 1 ? '' : 's'} have no balance for {year}.
              </span>
              <div className="ml-auto flex items-center gap-2">
                <div className="w-24">
                  <Input
                    type="number"
                    step="0.5"
                    min={0}
                    value={grantDefault}
                    onChange={(e) => setGrantDefault(e.target.value)}
                    aria-label="Days to grant"
                  />
                </div>
                <Button
                  icon={Sparkles}
                  disabled={grantMutation.isPending}
                  loading={grantMutation.isPending}
                  onClick={() => grantMutation.mutate()}
                >
                  Grant to all missing
                </Button>
              </div>
            </div>
          )}

          <EditBar
            editing={editing}
            dirtyCount={dirtyRows.length}
            saving={saveMutation.isPending}
            onEdit={() => {
              setEditing(true)
              setSuccess(null)
            }}
            onSave={() => saveMutation.mutate()}
            onCancel={() => {
              setRows(buildRows())
              setEditing(false)
              setError(null)
            }}
          />
          <ScrollTable>
            <Thead>
              <Tr>
                <Th>Agent</Th>
                <Th>Allotted</Th>
                <Th>Taken</Th>
                <Th>Half-days taken</Th>
                <Th>Remaining</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredRows.map((r) => (
                <Tr key={r.agentId}>
                  <Td className="font-medium text-ink">
                    <span className="inline-flex items-center gap-2">
                      {r.agentName}
                      {!r.hasBalance && <Badge tone="warning">No balance</Badge>}
                    </span>
                  </Td>
                  <Td>
                    <CellNumber editing={editing} value={r.allotted} onChange={(v) => updateRow(r.agentId, v ?? 0)} step="0.5" />
                  </Td>
                  <Td className="tabular-nums">{r.taken}</Td>
                  <Td className="tabular-nums">{r.halfDays}</Td>
                  <Td className="tabular-nums">{r.hasBalance ? r.remaining : <span className="text-ink-subtle">—</span>}</Td>
                </Tr>
              ))}
            </Tbody>
          </ScrollTable>
          {!editing && (
            <p className="mt-2 text-xs text-ink-muted">
              Tip: click <span className="font-medium text-ink-secondary">Edit table</span> to set an agent's allotment
              inline — saving creates a balance for any agent that doesn't have one yet.
            </p>
          )}
        </>
      )}
    </div>
  )
}

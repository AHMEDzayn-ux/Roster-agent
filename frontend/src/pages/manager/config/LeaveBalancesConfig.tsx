import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { extractErrorMessage } from '../../../api/client'
import { createLeaveBalance, listAgents, listLeaveBalances, updateLeaveBalance } from '../../../api/endpoints'
import {
  CellNumber,
  EditBar,
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

  const [editing, setEditing] = useState(false)
  const [rows, setRows] = useState<Row[]>([])

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
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['leave-balances', year] })
    },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const updateRow = (agentId: number, allotted: number) =>
    setRows((prev) => prev.map((r) => (r.agentId === agentId ? { ...r, allotted } : r)))

  const isLoading = agentsQuery.isLoading || balancesQuery.isLoading

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <Field label="Year">
          <Input
            type="number"
            value={year}
            onChange={(e) => {
              setYear(e.target.value)
              setEditing(false)
            }}
            className="w-28"
          />
        </Field>
      </div>

      {isLoading && <LoadingText />}
      {!isLoading && (
        <>
          <ErrorBanner message={editing ? error : null} />
          <EditBar
            editing={editing}
            dirtyCount={dirtyRows.length}
            saving={saveMutation.isPending}
            onEdit={() => setEditing(true)}
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
              {rows.map((r) => (
                <Tr key={r.agentId}>
                  <Td className="font-medium text-slate-800">
                    {r.agentName}
                    {!r.hasBalance && <span className="ml-2 text-xs text-slate-400">(no record yet)</span>}
                  </Td>
                  <Td>
                    <CellNumber editing={editing} value={r.allotted} onChange={(v) => updateRow(r.agentId, v ?? 0)} step="0.5" />
                  </Td>
                  <Td>{r.taken}</Td>
                  <Td>{r.halfDays}</Td>
                  <Td>{r.hasBalance ? r.remaining : <span className="text-slate-400">—</span>}</Td>
                </Tr>
              ))}
            </Tbody>
          </ScrollTable>
        </>
      )}
    </div>
  )
}

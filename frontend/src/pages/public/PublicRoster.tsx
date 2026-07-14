import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCurrentPublicRoster, getPublicRosterForWeek } from '../../api/endpoints'
import { extractErrorMessage } from '../../api/client'
import {
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  LoadingText,
  PageTitle,
  ScrollTable,
  StatusBadge,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '../../components/ui'
import { DEFAULT_SHIFT_COLOR, SHIFT_COLORS, compactShiftRange, weekdayLabel } from '../../lib/rosterGrid'
import type { PublicAssignment } from '../../types'

// Converts an ISO week input value ("2026-W29") to that week's Monday date ("2026-07-13").
function isoWeekToMonday(isoWeek: string): string {
  const [yearStr, weekStr] = isoWeek.split('-W')
  const year = Number(yearStr)
  const week = Number(weekStr)
  // ISO week 1 is the week containing the year's first Thursday.
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Monday = new Date(jan4)
  jan4Monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7))
  const monday = new Date(jan4Monday)
  monday.setUTCDate(jan4Monday.getUTCDate() + (week - 1) * 7)
  return monday.toISOString().slice(0, 10)
}

export default function PublicRoster() {
  const [weekOverride, setWeekOverride] = useState('')
  const [skillFilter, setSkillFilter] = useState('')

  const weekStartDate = weekOverride ? isoWeekToMonday(weekOverride) : ''

  const query = useQuery({
    queryKey: ['public-roster', weekStartDate],
    queryFn: () => (weekStartDate ? getPublicRosterForWeek(weekStartDate) : getCurrentPublicRoster()),
    retry: false,
  })

  const visibleAssignments = useMemo(() => {
    if (!query.data) return [] as PublicAssignment[]
    if (!skillFilter) return query.data.assignments
    return query.data.assignments.filter((a) => a.skill_name.toLowerCase().includes(skillFilter.toLowerCase()))
  }, [query.data, skillFilter])

  const gridDays = useMemo(
    () => [...new Set(visibleAssignments.map((a) => a.date))].sort((a, b) => a.localeCompare(b)),
    [visibleAssignments],
  )

  const gridAgents = useMemo(
    () => [...new Set(visibleAssignments.map((a) => a.agent_name))].sort((a, b) => a.localeCompare(b)),
    [visibleAssignments],
  )

  const byAgentDate = useMemo(() => {
    const map = new Map<string, PublicAssignment>()
    for (const a of visibleAssignments) map.set(`${a.agent_name}|${a.date}`, a)
    return map
  }, [visibleAssignments])

  return (
    <div>
      <PageTitle subtitle="Full weekly schedule — visible to everyone, no login required.">Published Roster</PageTitle>

      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-48">
            <Field label="View a specific week">
              <Input type="week" value={weekOverride} onChange={(e) => setWeekOverride(e.target.value)} />
            </Field>
          </div>
          <div className="w-56">
            <Field label="Filter by skill">
              <Input placeholder="e.g. Cash Handling" value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)} />
            </Field>
          </div>
        </div>
      </Card>

      {query.isLoading && <LoadingText text="Loading roster…" />}
      {query.isError && <ErrorBanner message={extractErrorMessage(query.error)} />}

      {query.data && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-medium text-slate-800">Week of {query.data.week_start_date}</h2>
            <StatusBadge status={query.data.status} />
            <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {Object.entries(SHIFT_COLORS).map(([name, cls]) => (
                <span key={name} className={`rounded px-1.5 py-0.5 ${cls}`}>
                  {name}
                </span>
              ))}
            </div>
          </div>

          {gridDays.length === 0 ? (
            <EmptyState text="No assignments to show for this week." />
          ) : (
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
                  <Tr key={agent}>
                    <Td className="font-medium text-slate-800">{agent}</Td>
                    {gridDays.map((day) => {
                      const a = byAgentDate.get(`${agent}|${day}`)
                      if (!a) {
                        return (
                          <Td key={day}>
                            <span className="inline-block rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs font-semibold text-slate-500">
                              OFF
                            </span>
                          </Td>
                        )
                      }
                      const colorCls = SHIFT_COLORS[a.shift_name] || DEFAULT_SHIFT_COLOR
                      return (
                        <Td key={day}>
                          <span
                            className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${colorCls}`}
                            title={`${a.shift_name} (${a.shift_start}–${a.shift_end}) — ${a.skill_name}`}
                          >
                            {compactShiftRange(a.shift_start, a.shift_end)}
                          </span>
                        </Td>
                      )
                    })}
                  </Tr>
                ))}
              </Tbody>
            </ScrollTable>
          )}
        </>
      )}
    </div>
  )
}

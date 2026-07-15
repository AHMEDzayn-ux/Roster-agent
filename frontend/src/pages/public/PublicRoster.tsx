import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarX2 } from 'lucide-react'
import { getCurrentPublicRoster, getPublicRosterForWeek } from '../../api/endpoints'
import { extractErrorMessage } from '../../api/client'
import {
  ErrorBanner,
  Field,
  Input,
  LoadingText,
  PageTitle,
  StatusBadge,
  Toolbar,
} from '../../components/ui'
import { OffChip, RosterGrid, ShiftChip, ShiftLegend } from '../../components/RosterGrid'
import { SHIFT_COLORS, compactShiftRange } from '../../lib/rosterGrid'
import type { PublicAssignment } from '../../types'

// Converts an ISO week input value ("2026-W29") to that week's Monday date ("2026-07-13").
function isoWeekToMonday(isoWeek: string): string {
  const [yearStr, weekStr] = isoWeek.split('-W')
  const year = Number(yearStr)
  const week = Number(weekStr)
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

  const gridRows = useMemo(
    () =>
      [...new Set(visibleAssignments.map((a) => a.agent_name))]
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({ key: name, name })),
    [visibleAssignments],
  )

  const byAgentDate = useMemo(() => {
    const map = new Map<string, PublicAssignment>()
    for (const a of visibleAssignments) map.set(`${a.agent_name}|${a.date}`, a)
    return map
  }, [visibleAssignments])

  return (
    <div>
      <PageTitle subtitle="The full weekly schedule — visible to everyone, no login required.">Published Roster</PageTitle>

      <Toolbar>
        <div className="w-44">
          <Field label="View a specific week">
            <Input type="week" value={weekOverride} onChange={(e) => setWeekOverride(e.target.value)} />
          </Field>
        </div>
        <div className="w-56">
          <Field label="Filter by skill">
            <Input placeholder="e.g. Cash Handling" value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)} />
          </Field>
        </div>
      </Toolbar>

      {query.isLoading && <LoadingText text="Loading roster…" />}
      {query.isError && <ErrorBanner message={extractErrorMessage(query.error)} />}

      {query.data && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="text-[15px] font-semibold text-ink">Week of {query.data.week_start_date}</h2>
            <StatusBadge status={query.data.status} />
            <div className="ml-auto">
              <ShiftLegend entries={Object.entries(SHIFT_COLORS) as [string, string][]} />
            </div>
          </div>

          {gridDays.length === 0 ? (
            <div className="rounded-card border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
              <CalendarX2 className="mx-auto mb-2 size-6 text-ink-muted" />
              <p className="text-[13px] text-ink-muted">No assignments to show for this week.</p>
            </div>
          ) : (
            <RosterGrid
              days={gridDays}
              rows={gridRows}
              renderCell={(agent, day) => {
                const a = byAgentDate.get(`${agent}|${day}`)
                if (!a) return <OffChip />
                return (
                  <ShiftChip
                    label={compactShiftRange(a.shift_start, a.shift_end)}
                    colorClass={SHIFT_COLORS[a.shift_name]}
                    title={`${a.shift_name} (${a.shift_start}–${a.shift_end}) — ${a.skill_name}`}
                  />
                )
              }}
            />
          )}
        </>
      )}
    </div>
  )
}

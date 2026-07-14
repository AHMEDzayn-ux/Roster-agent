import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCurrentPublicRoster, getPublicRosterForWeek } from '../../api/endpoints'
import { extractErrorMessage } from '../../api/client'
import { Card, EmptyState, ErrorBanner, Field, Input, LoadingText, PageTitle, StatusBadge } from '../../components/ui'
import type { PublicAssignment } from '../../types'

export default function PublicRoster() {
  const [weekOverride, setWeekOverride] = useState('')
  const [skillFilter, setSkillFilter] = useState('')

  const query = useQuery({
    queryKey: ['public-roster', weekOverride],
    queryFn: () => (weekOverride ? getPublicRosterForWeek(weekOverride) : getCurrentPublicRoster()),
    retry: false,
  })

  const grouped = useMemo(() => {
    const map = new Map<string, PublicAssignment[]>()
    if (!query.data) return map
    for (const a of query.data.assignments) {
      if (skillFilter && !a.skill_name.toLowerCase().includes(skillFilter.toLowerCase())) continue
      const list = map.get(a.date) ?? []
      list.push(a)
      map.set(a.date, list)
    }
    return new Map([...map.entries()].sort((a, b) => a[0].localeCompare(b[0])))
  }, [query.data, skillFilter])

  return (
    <div>
      <PageTitle subtitle="Full weekly schedule — visible to everyone, no login required.">Published Roster</PageTitle>

      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-48">
            <Field label="View a specific week (Monday)">
              <Input type="date" value={weekOverride} onChange={(e) => setWeekOverride(e.target.value)} />
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
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-lg font-medium text-slate-800">Week of {query.data.week_start_date}</h2>
            <StatusBadge status={query.data.status} />
          </div>

          {grouped.size === 0 ? (
            <EmptyState text="No assignments to show for this week." />
          ) : (
            <div className="space-y-5">
              {[...grouped.entries()].map(([date, assignments]) => (
                <Card key={date}>
                  <h3 className="mb-3 font-medium text-slate-800">{date}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                          <th className="py-1.5 pr-4">Agent</th>
                          <th className="py-1.5 pr-4">Shift</th>
                          <th className="py-1.5 pr-4">Time</th>
                          <th className="py-1.5">Skill</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignments
                          .sort((a, b) => a.agent_name.localeCompare(b.agent_name))
                          .map((a, i) => (
                            <tr key={i} className="border-b border-slate-100 last:border-0">
                              <td className="py-1.5 pr-4">{a.agent_name}</td>
                              <td className="py-1.5 pr-4">{a.shift_name}</td>
                              <td className="py-1.5 pr-4 text-slate-500">
                                {a.shift_start}–{a.shift_end}
                              </td>
                              <td className="py-1.5">{a.skill_name}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

import type { ReactNode } from 'react'
import { DEFAULT_SHIFT_COLOR, weekdayLabel } from '../lib/rosterGrid'
import { cn } from './ui'

export interface RosterRow {
  key: string
  name: string
  meta?: ReactNode
}

/**
 * The canonical roster calendar: sticky employee column, sticky date header,
 * horizontal scroll, Airtable/Linear-style dense rows. Consumers supply the
 * rows, day columns and a cell renderer so the same grid backs the manager
 * workspace, the dashboard preview and the public roster.
 */
export function RosterGrid({
  days,
  rows,
  renderCell,
  maxHeight = 'calc(100vh - 260px)',
  onSelectCell,
  selectedCell,
}: {
  days: string[]
  rows: RosterRow[]
  renderCell: (rowKey: string, day: string) => ReactNode
  maxHeight?: string
  onSelectCell?: (rowKey: string, day: string) => void
  selectedCell?: { rowKey: string; day: string } | null
}) {
  const today = localISO(new Date())
  return (
    <div
      className="scroll-thin overflow-auto rounded-card border border-line bg-surface shadow-xs"
      style={{ maxHeight }}
    >
      <table className="border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-30 min-w-[160px] border-b border-r border-line bg-surface-muted px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              Employee
            </th>
            {days.map((d) => {
              const isToday = d === today
              return (
                <th
                  key={d}
                  className={cn(
                    'sticky top-0 z-20 min-w-[92px] border-b border-line px-2.5 py-2 text-center',
                    isToday ? 'bg-accent-subtle' : 'bg-surface-muted',
                  )}
                >
                  <div className={cn('text-[11px] font-semibold uppercase tracking-wide', isToday ? 'text-accent-subtle-fg' : 'text-ink-secondary')}>
                    {weekdayLabel(d)}
                  </div>
                  <div className="mt-0.5 text-[11px] font-normal tabular-nums text-ink-muted">{shortDate(d)}</div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.key} className="group">
              <th
                className={cn(
                  'sticky left-0 z-10 min-w-[160px] border-r border-line px-3 py-1.5 text-left font-medium text-ink group-hover:bg-surface-muted',
                  i === rows.length - 1 ? '' : 'border-b border-line',
                  'bg-surface',
                )}
              >
                <div className="truncate text-[13px]">{row.name}</div>
                {row.meta && <div className="truncate text-[11px] font-normal text-ink-muted">{row.meta}</div>}
              </th>
              {days.map((day) => {
                const selected = selectedCell?.rowKey === row.key && selectedCell?.day === day
                return (
                  <td
                    key={day}
                    onClick={onSelectCell ? () => onSelectCell(row.key, day) : undefined}
                    className={cn(
                      'border-b border-line px-1.5 py-1.5 text-center align-middle transition-colors',
                      onSelectCell && 'cursor-pointer',
                      selected ? 'bg-accent-subtle ring-1 ring-inset ring-accent-ring' : 'group-hover:bg-surface-muted/60',
                      i === rows.length - 1 && 'border-b-0',
                    )}
                  >
                    {renderCell(row.key, day)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ShiftChip({ label, colorClass, title }: { label: string; colorClass?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        'inline-block rounded-chip px-1.5 py-0.5 text-[11px] font-medium tabular-nums',
        colorClass || DEFAULT_SHIFT_COLOR,
      )}
    >
      {label}
    </span>
  )
}

export function OffChip() {
  return (
    <span className="inline-block rounded-chip border border-dashed border-line-strong px-1.5 py-0.5 text-[11px] font-medium text-ink-subtle">
      OFF
    </span>
  )
}

export function ShiftLegend({ entries }: { entries: [string, string][] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {entries.map(([name, cls]) => (
        <span key={name} className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
          <span className={cn('size-2.5 rounded-[3px]', cls)} />
          {name}
        </span>
      ))}
    </div>
  )
}

export function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function shortDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

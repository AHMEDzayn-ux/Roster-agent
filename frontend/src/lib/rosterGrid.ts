// Shared helpers for rendering a roster as an agent-rows x day-columns grid,
// used by both the manager Roster Workspace and the public Published Roster so
// the two views stay identical.

import { WEEKDAY_NAMES } from '../components/ui'

// Compact 12-hour hour, no minutes/am-pm — e.g. Afternoon 12:00-21:00 -> "12-9".
export function toCompact12h(time: string): string {
  const hour = Number(time.slice(0, 2)) % 12
  return String(hour === 0 ? 12 : hour)
}

export function compactShiftRange(start: string, end: string): string {
  return `${toCompact12h(start)}-${toCompact12h(end)}`
}

// Muted, low-saturation chips with a hairline border so shifts stay
// distinguishable without turning the grid into a rainbow. Each entry pairs a
// tinted surface with readable text at WCAG-AA contrast.
export const SHIFT_COLORS: Record<string, string> = {
  Morning: 'bg-sky-50 text-sky-700 border border-sky-200/70 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/25',
  'Early Morning': 'bg-amber-50 text-amber-700 border border-amber-200/70 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25',
  'Mid Morning': 'bg-teal-50 text-teal-700 border border-teal-200/70 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/25',
  Afternoon: 'bg-violet-50 text-violet-700 border border-violet-200/70 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/25',
  Evening: 'bg-rose-50 text-rose-700 border border-rose-200/70 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/25',
  Overnight: 'bg-slate-700 text-white border border-slate-700 dark:bg-slate-600 dark:border-slate-500',
}
export const DEFAULT_SHIFT_COLOR = 'bg-surface-muted text-ink-secondary border border-line'

export function weekdayLabel(dateStr: string): string {
  const jsDay = new Date(`${dateStr}T00:00:00`).getDay()
  return WEEKDAY_NAMES[(jsDay + 6) % 7]
}

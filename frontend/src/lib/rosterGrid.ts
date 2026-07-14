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

export const SHIFT_COLORS: Record<string, string> = {
  Morning: 'bg-sky-100 text-sky-800',
  'Early Morning': 'bg-amber-100 text-amber-800',
  'Mid Morning': 'bg-teal-100 text-teal-800',
  Afternoon: 'bg-violet-100 text-violet-800',
  Evening: 'bg-rose-100 text-rose-800',
  Overnight: 'bg-indigo-900 text-white',
}
export const DEFAULT_SHIFT_COLOR = 'bg-slate-100 text-slate-700'

export function weekdayLabel(dateStr: string): string {
  const jsDay = new Date(`${dateStr}T00:00:00`).getDay()
  return WEEKDAY_NAMES[(jsDay + 6) % 7]
}

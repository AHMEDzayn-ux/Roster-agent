import { useEffect, useRef, useState } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</div>
  )
}

export function PageTitle({ children, subtitle }: { children: ReactNode; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-semibold text-slate-900">{children}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
  )
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  const styles = {
    primary: 'bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-400',
    secondary: 'border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:text-slate-400',
    danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  }
  return (
    <button
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...props}
    />
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none ${props.className ?? ''}`}
    />
  )
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none ${props.className ?? ''}`}
    />
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  )
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</div>
  )
}

export function SuccessBanner({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
      {message}
    </div>
  )
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  denied: 'bg-red-100 text-red-800',
  appealed: 'bg-purple-100 text-purple-800',
  open: 'bg-slate-100 text-slate-700',
  published: 'bg-blue-100 text-blue-800',
  locked: 'bg-slate-800 text-white',
  draft: 'bg-slate-100 text-slate-700',
  info: 'bg-slate-100 text-slate-700',
  warning: 'bg-amber-100 text-amber-800',
  critical: 'bg-red-100 text-red-800',
}

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? 'bg-slate-100 text-slate-700'
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>{status}</span>
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">{children}</table>
    </div>
  )
}

export function Thead({ children }: { children: ReactNode }) {
  return <thead className="bg-slate-50">{children}</thead>
}

export function Th({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <th className={`sticky top-0 z-10 bg-slate-50 px-2.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 ${className}`}>
      {children}
    </th>
  )
}

export function Tbody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>
}

export function Tr({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <tr className={`hover:bg-slate-50 ${className}`}>{children}</tr>
}

export function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-2.5 py-1 align-middle text-slate-700 ${className}`}>{children}</td>
}

export function ScrollTable({ children, maxHeight = 'calc(100vh - 320px)' }: { children: ReactNode; maxHeight?: string }) {
  return (
    <div className="overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm" style={{ maxHeight }}>
      <table className="min-w-full divide-y divide-slate-200 text-sm">{children}</table>
    </div>
  )
}

/** Toolbar with Edit / Save / Cancel toggle for inline-editable tables. */
export function EditBar({
  editing,
  dirtyCount,
  saving,
  onEdit,
  onSave,
  onCancel,
}: {
  editing: boolean
  dirtyCount: number
  saving: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="mb-2 flex items-center justify-end gap-2">
      {editing ? (
        <>
          <span className="text-xs text-slate-500">{dirtyCount > 0 ? `${dirtyCount} unsaved change${dirtyCount === 1 ? '' : 's'}` : 'Click any cell to edit'}</span>
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving || dirtyCount === 0}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      ) : (
        <Button variant="secondary" onClick={onEdit}>
          Edit table
        </Button>
      )}
    </div>
  )
}

const cellInputClass =
  'w-full rounded border border-slate-300 bg-white px-1.5 py-0.5 text-sm focus:border-slate-500 focus:outline-none'

export function CellText({
  editing,
  value,
  onChange,
  placeholder,
}: {
  editing: boolean
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  if (!editing) return <>{value || <span className="text-slate-400">—</span>}</>
  return <input className={cellInputClass} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
}

export function CellNumber({
  editing,
  value,
  onChange,
  step,
}: {
  editing: boolean
  value: number | null
  onChange: (v: number | null) => void
  step?: string
}) {
  if (!editing) return <>{value ?? <span className="text-slate-400">—</span>}</>
  return (
    <input
      type="number"
      step={step}
      className={`${cellInputClass} w-20`}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    />
  )
}

export function CellTime({ editing, value, onChange }: { editing: boolean; value: string; onChange: (v: string) => void }) {
  if (!editing) return <>{value}</>
  return <input type="time" className={`${cellInputClass} w-28`} value={value} onChange={(e) => onChange(e.target.value)} />
}

export function CellSelect<T extends string | number>({
  editing,
  value,
  onChange,
  options,
  display,
}: {
  editing: boolean
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  display?: string
}) {
  if (!editing) return <>{display ?? options.find((o) => o.value === value)?.label ?? String(value)}</>
  return (
    <select
      className={cellInputClass}
      value={String(value)}
      onChange={(e) => {
        const raw = e.target.value
        const match = options.find((o) => String(o.value) === raw)
        if (match) onChange(match.value)
      }}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function CellCheckbox({ editing, checked, onChange, label }: { editing: boolean; checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  if (!editing) return checked ? <span className="text-green-600">✓</span> : <span className="text-slate-300">—</span>
  return (
    <label className="inline-flex items-center gap-1">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

/** Compact multi-select: read-only shows a count/summary; editing shows a popover of ticks. */
export function CellMultiSelect({
  editing,
  selected,
  onChange,
  options,
}: {
  editing: boolean
  selected: number[]
  onChange: (ids: number[]) => void
  options: { id: number; label: string }[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const labels = selected.map((id) => options.find((o) => o.id === id)?.label ?? `#${id}`)

  if (!editing) {
    return labels.length ? (
      <span title={labels.join(', ')}>{labels.length <= 2 ? labels.join(', ') : `${labels.length} skills`}</span>
    ) : (
      <span className="text-slate-400">—</span>
    )
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-left text-sm hover:bg-slate-50"
        onClick={() => setOpen((o) => !o)}
      >
        {selected.length ? `${selected.length} selected` : 'Select…'} ▾
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-64 overflow-auto rounded-md border border-slate-300 bg-white p-1.5 shadow-lg">
          {options.map((o) => (
            <label key={o.id} className="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-sm hover:bg-slate-50">
              <input
                type="checkbox"
                checked={selected.includes(o.id)}
                onChange={(e) => onChange(e.target.checked ? [...selected, o.id] : selected.filter((id) => id !== o.id))}
              />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

export function LoadingText({ text = 'Loading…' }: { text?: string }) {
  return <p className="text-sm text-slate-500">{text}</p>
}

export function EmptyState({ text }: { text: string }) {
  return <p className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">{text}</p>
}

export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export const REQUEST_TYPE_LABELS: Record<string, string> = {
  off_day: 'Off day',
  leave_full: 'Leave (full day)',
  leave_half: 'Leave (half day)',
  leave_multi: 'Leave (multi-day)',
  shift_change: 'Shift change',
  overtime: 'Overtime',
  other: 'Other',
}

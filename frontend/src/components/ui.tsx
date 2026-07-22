import { useEffect, useRef, useState } from 'react'
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  Inbox,
  Info,
  Loader2,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react'

/* ---------------------------------------------------------------------------
   Utilities
   --------------------------------------------------------------------------- */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/* ---------------------------------------------------------------------------
   Typography
   --------------------------------------------------------------------------- */
export function PageTitle({
  children,
  subtitle,
  actions,
}: {
  children: ReactNode
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[19px] font-semibold leading-tight tracking-[-0.01em] text-ink">{children}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export function SectionTitle({
  children,
  hint,
  actions,
  className = '',
}: {
  children: ReactNode
  hint?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <div className="flex items-baseline gap-2">
        <h2 className="text-[13px] font-semibold text-ink">{children}</h2>
        {hint && <span className="text-xs text-ink-muted">{hint}</span>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

/* ---------------------------------------------------------------------------
   Surfaces
   --------------------------------------------------------------------------- */
export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-card border border-line bg-surface shadow-xs',
        padded && 'p-5',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

/* ---------------------------------------------------------------------------
   Buttons
   --------------------------------------------------------------------------- */
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-fg shadow-xs hover:bg-accent-hover active:bg-accent-active disabled:bg-accent/40 disabled:shadow-none',
  secondary:
    'bg-surface border border-line-strong text-ink-secondary shadow-xs hover:bg-surface-hover hover:text-ink disabled:text-ink-subtle disabled:bg-surface',
  ghost:
    'text-ink-secondary hover:bg-surface-hover hover:text-ink disabled:text-ink-subtle',
  danger:
    'bg-[#dc2626] text-white shadow-xs hover:bg-[#b91c1c] active:bg-[#991b1b] disabled:bg-[#dc2626]/40 disabled:shadow-none',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-7 gap-1.5 px-2.5 text-[13px]',
  md: 'h-8 gap-1.5 px-3 text-[13px]',
  lg: 'h-9 gap-2 px-4 text-sm',
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  className = '',
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: LucideIcon
  iconRight?: LucideIcon
  loading?: boolean
}) {
  return (
    <button
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap rounded-btn font-medium transition-colors duration-150 disabled:cursor-not-allowed',
        BUTTON_SIZES[size],
        BUTTON_VARIANTS[variant],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        Icon && <Icon className="size-3.5 shrink-0" strokeWidth={2} />
      )}
      {children}
      {IconRight && !loading && <IconRight className="size-3.5 shrink-0" strokeWidth={2} />}
    </button>
  )
}

export function IconButton({
  icon: Icon,
  label,
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; size?: 'sm' | 'md' }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded-btn text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink disabled:text-ink-subtle',
        size === 'sm' ? 'size-7' : 'size-8',
        className,
      )}
      {...props}
    >
      <Icon className="size-[18px]" strokeWidth={2} />
    </button>
  )
}

/* ---------------------------------------------------------------------------
   Form controls
   --------------------------------------------------------------------------- */
const CONTROL_BASE =
  'w-full rounded-input border border-line-strong bg-surface px-3 text-[13px] text-ink placeholder:text-ink-subtle transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-ring/60 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-subtle'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(CONTROL_BASE, 'h-8', props.className)} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(CONTROL_BASE, 'min-h-[72px] resize-y py-2', props.className)} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={cn(CONTROL_BASE, 'h-8 cursor-pointer appearance-none pr-8', props.className)}
      />
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" />
    </div>
  )
}

export function Field({
  label,
  children,
  required,
  hint,
  error,
  htmlFor,
}: {
  label: string
  children: ReactNode
  required?: boolean
  hint?: string
  error?: string | null
  htmlFor?: string
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1.5 flex items-center gap-1 text-xs font-medium text-ink-secondary">
        {label}
        {required && <span className="text-[#dc2626]">*</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1 flex items-center gap-1 text-xs text-critical">
          <AlertTriangle className="size-3" /> {error}
        </span>
      ) : (
        hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>
      )}
    </label>
  )
}

export function Checkbox({
  label,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode }) {
  return (
    <label className={cn('inline-flex items-center gap-2 text-[13px] text-ink-secondary', className)}>
      <input
        type="checkbox"
        className="size-4 rounded-[4px] border-line-strong text-accent accent-[var(--color-accent)] focus:ring-2 focus:ring-accent-ring/60"
        {...props}
      />
      {label}
    </label>
  )
}

/* ---------------------------------------------------------------------------
   Feedback: alerts, badges, skeletons, empty states
   --------------------------------------------------------------------------- */
type AlertTone = 'success' | 'info' | 'warning' | 'critical'

const ALERT_TONES: Record<AlertTone, { wrap: string; icon: LucideIcon; iconColor: string }> = {
  success: { wrap: 'bg-success-subtle border-success-border text-success', icon: CheckCircle2, iconColor: 'text-success' },
  info: { wrap: 'bg-info-subtle border-info-border text-info', icon: Info, iconColor: 'text-info' },
  warning: { wrap: 'bg-warning-subtle border-warning-border text-warning', icon: AlertTriangle, iconColor: 'text-warning' },
  critical: { wrap: 'bg-critical-subtle border-critical-border text-critical', icon: XCircle, iconColor: 'text-critical' },
}

export function Alert({ tone, message, className = '' }: { tone: AlertTone; message: ReactNode; className?: string }) {
  const t = ALERT_TONES[tone]
  const Icon = t.icon
  return (
    <div className={cn('flex items-start gap-2 rounded-input border px-3 py-2 text-[13px]', t.wrap, className)}>
      <Icon className={cn('mt-0.5 size-4 shrink-0', t.iconColor)} />
      <span className="leading-relaxed">{message}</span>
    </div>
  )
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null
  return <Alert tone="critical" message={message} className="mb-4" />
}

export function SuccessBanner({ message }: { message: string | null }) {
  if (!message) return null
  return <Alert tone="success" message={message} className="mb-4" />
}

/* Compact status/label badge — dot + text, semantic colour only. */
const STATUS_TONE: Record<string, AlertTone | 'neutral' | 'accent'> = {
  pending: 'warning',
  approved: 'success',
  denied: 'critical',
  appealed: 'accent',
  open: 'neutral',
  published: 'info',
  locked: 'neutral',
  draft: 'neutral',
  info: 'neutral',
  warning: 'warning',
  critical: 'critical',
  active: 'success',
  inactive: 'neutral',
  solver: 'info',
  manual_override: 'accent',
}

const BADGE_TONE_CLASS: Record<AlertTone | 'neutral' | 'accent', { badge: string; dot: string }> = {
  neutral: { badge: 'bg-surface-muted text-ink-secondary border-line', dot: 'bg-ink-subtle' },
  accent: { badge: 'bg-accent-subtle text-accent-subtle-fg border-accent-ring/40', dot: 'bg-accent' },
  success: { badge: 'bg-success-subtle text-success border-success-border', dot: 'bg-success' },
  info: { badge: 'bg-info-subtle text-info border-info-border', dot: 'bg-info' },
  warning: { badge: 'bg-warning-subtle text-warning border-warning-border', dot: 'bg-warning' },
  critical: { badge: 'bg-critical-subtle text-critical border-critical-border', dot: 'bg-critical' },
}

export function Badge({
  children,
  tone = 'neutral',
  dot = false,
  className = '',
}: {
  children: ReactNode
  tone?: AlertTone | 'neutral' | 'accent'
  dot?: boolean
  className?: string
}) {
  const t = BADGE_TONE_CLASS[tone]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        t.badge,
        className,
      )}
    >
      {dot && <span className={cn('size-1.5 rounded-full', t.dot)} />}
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? 'neutral'
  return (
    <Badge tone={tone} dot className="capitalize">
      {status.replaceAll('_', ' ')}
    </Badge>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={cn('skeleton', className)} />
}

export function LoadingText({ text = 'Loading…' }: { text?: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-ink-muted">
      <Loader2 className="size-3.5 animate-spin" />
      {text}
    </div>
  )
}

export function EmptyState({
  text,
  title,
  icon: Icon = Inbox,
  action,
}: {
  text: string
  title?: string
  icon?: LucideIcon
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
        <Icon className="size-5" />
      </div>
      {title && <p className="text-[13px] font-semibold text-ink">{title}</p>}
      <p className="mt-0.5 max-w-sm text-[13px] text-ink-muted">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* ---------------------------------------------------------------------------
   Metrics
   --------------------------------------------------------------------------- */
export function StatTile({
  label,
  value,
  icon: Icon,
  hint,
  tone = 'neutral',
  loading = false,
}: {
  label: string
  value: ReactNode
  icon?: LucideIcon
  hint?: ReactNode
  tone?: 'neutral' | 'success' | 'warning' | 'critical' | 'info' | 'accent'
  loading?: boolean
}) {
  const iconTone: Record<string, string> = {
    neutral: 'text-ink-muted bg-surface-muted',
    success: 'text-success bg-success-subtle',
    warning: 'text-warning bg-warning-subtle',
    critical: 'text-critical bg-critical-subtle',
    info: 'text-info bg-info-subtle',
    accent: 'text-accent bg-accent-subtle',
  }
  return (
    <div className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        {Icon && (
          <span className={cn('flex size-6 items-center justify-center rounded-md', iconTone[tone])}>
            <Icon className="size-3.5" />
          </span>
        )}
      </div>
      {loading ? (
        <Skeleton className="h-7 w-16" />
      ) : (
        <span className="text-2xl font-semibold leading-none tracking-[-0.02em] text-ink tabular-nums">{value}</span>
      )}
      {hint && <span className="text-xs text-ink-muted">{hint}</span>}
    </div>
  )
}

/* ---------------------------------------------------------------------------
   Tables
   --------------------------------------------------------------------------- */
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="scroll-thin overflow-x-auto rounded-card border border-line bg-surface shadow-xs">
      <table className="min-w-full text-[13px]">{children}</table>
    </div>
  )
}

export function ScrollTable({
  children,
  maxHeight = 'calc(100vh - 320px)',
}: {
  children: ReactNode
  maxHeight?: string
}) {
  return (
    <div
      className="scroll-thin overflow-auto rounded-card border border-line bg-surface shadow-xs"
      style={{ maxHeight }}
    >
      <table className="min-w-full text-[13px]">{children}</table>
    </div>
  )
}

export function Thead({ children }: { children: ReactNode }) {
  return <thead>{children}</thead>
}

export function Th({
  children,
  className = '',
  sortable = false,
  sorted = false,
  direction = 'asc',
  onSort,
}: {
  children?: ReactNode
  className?: string
  sortable?: boolean
  sorted?: boolean
  direction?: 'asc' | 'desc'
  onSort?: () => void
}) {
  const SortIcon = !sorted ? ChevronsUpDown : direction === 'asc' ? ChevronUp : ChevronDown
  return (
    <th
      className={cn(
        'sticky top-0 z-10 border-b border-line bg-surface-muted px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-muted',
        className,
      )}
    >
      {sortable ? (
        <button
          type="button"
          onClick={onSort}
          className={cn(
            'inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-ink',
            sorted && 'text-ink',
          )}
        >
          {children}
          <SortIcon className="size-3" />
        </button>
      ) : (
        children
      )}
    </th>
  )
}

export function Tbody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-line">{children}</tbody>
}

export function Tr({
  children,
  className = '',
  selected = false,
  onClick,
}: {
  children: ReactNode
  className?: string
  selected?: boolean
  onClick?: () => void
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'transition-colors',
        selected ? 'bg-accent-subtle' : 'hover:bg-surface-muted',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {children}
    </tr>
  )
}

export function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={cn('px-3 py-2 align-middle text-ink-secondary', className)}>{children}</td>
}

/* ---------------------------------------------------------------------------
   Toolbar — filter/search row above tables
   --------------------------------------------------------------------------- */
export function Toolbar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'mb-3 flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface p-2.5 shadow-xs',
        className,
      )}
    >
      {children}
    </div>
  )
}

/* ---------------------------------------------------------------------------
   Segmented tabs / pill nav
   --------------------------------------------------------------------------- */
export function SegmentedTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; count?: number }[]
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-input border border-line bg-surface-muted p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-[13px] font-medium transition-colors',
            value === o.value ? 'bg-surface text-ink shadow-xs' : 'text-ink-muted hover:text-ink',
          )}
        >
          {o.label}
          {o.count != null && (
            <span className={cn('text-[11px]', value === o.value ? 'text-ink-muted' : 'text-ink-subtle')}>
              {o.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------------------
   Avatar
   --------------------------------------------------------------------------- */
export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent-subtle font-semibold text-accent-subtle-fg"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials || '?'}
    </span>
  )
}

/* ---------------------------------------------------------------------------
   Modal
   --------------------------------------------------------------------------- */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[10vh] backdrop-blur-[1px]">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className={cn('relative w-full rounded-modal border border-line bg-surface shadow-pop', widths[size])}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p>}
          </div>
          <IconButton icon={X} label="Close" onClick={onClose} size="sm" className="-mr-1" />
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------------
   Inline-editable table toolbar + cells
   --------------------------------------------------------------------------- */
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
          <span className="text-xs text-ink-muted">
            {dirtyCount > 0
              ? `${dirtyCount} unsaved change${dirtyCount === 1 ? '' : 's'}`
              : 'Click any cell to edit'}
          </span>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" icon={Check} onClick={onSave} disabled={saving || dirtyCount === 0} loading={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      ) : (
        <Button variant="secondary" size="sm" onClick={onEdit}>
          Edit table
        </Button>
      )}
    </div>
  )
}

const cellInputClass =
  'w-full rounded-[6px] border border-line-strong bg-surface px-1.5 py-1 text-[13px] text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-ring/50'

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
  if (!editing) return <>{value || <span className="text-ink-subtle">—</span>}</>
  return (
    <input
      className={cellInputClass}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
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
  if (!editing) return <span className="tabular-nums">{value ?? <span className="text-ink-subtle">—</span>}</span>
  return (
    <input
      type="number"
      step={step}
      className={cn(cellInputClass, 'w-20 tabular-nums')}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    />
  )
}

export function CellTime({
  editing,
  value,
  onChange,
}: {
  editing: boolean
  value: string
  onChange: (v: string) => void
}) {
  if (!editing) return <span className="tabular-nums">{value}</span>
  return (
    <input
      type="time"
      className={cn(cellInputClass, 'w-28 tabular-nums')}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
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
      className={cn(cellInputClass, 'cursor-pointer')}
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

export function CellCheckbox({
  editing,
  checked,
  onChange,
  label,
}: {
  editing: boolean
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}) {
  if (!editing)
    return checked ? (
      <Check className="size-4 text-success" strokeWidth={2.5} />
    ) : (
      <span className="text-ink-subtle">—</span>
    )
  return (
    <label className="inline-flex items-center gap-1.5">
      <input
        type="checkbox"
        className="size-4 rounded-[4px] border-line-strong accent-[var(--color-accent)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
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
      <span className="inline-flex flex-wrap gap-1" title={labels.join(', ')}>
        {labels.length <= 2 ? (
          labels.map((l, i) => (
            <span key={i} className="rounded-chip bg-surface-muted px-1.5 py-0.5 text-[11px] text-ink-secondary">
              {l}
            </span>
          ))
        ) : (
          <span className="rounded-chip bg-surface-muted px-1.5 py-0.5 text-[11px] text-ink-secondary">
            {labels.length} selected
          </span>
        )}
      </span>
    ) : (
      <span className="text-ink-subtle">—</span>
    )
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-[6px] border border-line-strong bg-surface px-2 py-1 text-left text-[13px] text-ink-secondary hover:bg-surface-hover"
        onClick={() => setOpen((o) => !o)}
      >
        {selected.length ? `${selected.length} selected` : 'Select…'}
        <ChevronDown className="size-3.5" />
      </button>
      {open && (
        <div className="scroll-thin absolute z-30 mt-1 max-h-56 w-64 overflow-auto rounded-input border border-line bg-surface p-1 shadow-pop">
          {options.map((o) => (
            <label
              key={o.id}
              className="flex cursor-pointer items-center gap-2 rounded-[6px] px-2 py-1.5 text-[13px] text-ink-secondary hover:bg-surface-muted"
            >
              <input
                type="checkbox"
                className="size-4 rounded-[4px] border-line-strong accent-[var(--color-accent)]"
                checked={selected.includes(o.id)}
                onChange={(e) =>
                  onChange(e.target.checked ? [...selected, o.id] : selected.filter((id) => id !== o.id))
                }
              />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------------------
   Shared constants
   --------------------------------------------------------------------------- */
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

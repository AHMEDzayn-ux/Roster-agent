import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
import { extractErrorMessage } from '../../api/client'
import {
  deleteRequest,
  getCurrentWeeklyCycle,
  listMyRequests,
  listShiftTemplates,
  submitAppeal,
  submitRequest,
  updateRequest,
} from '../../api/endpoints'
import {
  Alert,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  LoadingText,
  Modal,
  PageTitle,
  REQUEST_TYPE_LABELS,
  Select,
  StatusBadge,
  SuccessBanner,
} from '../../components/ui'
import type { RequestType, WeeklyRequest } from '../../types'

const REQUEST_TYPES: RequestType[] = ['off_day', 'leave_full', 'leave_half', 'leave_multi', 'shift_change', 'overtime', 'other']

export default function MyRequests() {
  const queryClient = useQueryClient()
  const cycleQuery = useQuery({ queryKey: ['current-cycle'], queryFn: getCurrentWeeklyCycle, retry: false })
  const requestsQuery = useQuery({ queryKey: ['my-requests'], queryFn: () => listMyRequests() })
  const shiftsQuery = useQuery({ queryKey: ['shift-templates'], queryFn: listShiftTemplates })

  const [type, setType] = useState<RequestType>('off_day')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [halfDayPortion, setHalfDayPortion] = useState('first_half')
  const [requestedShiftId, setRequestedShiftId] = useState('')
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

  const [appealingId, setAppealingId] = useState<number | null>(null)
  const [appealReason, setAppealReason] = useState('')
  const [appealError, setAppealError] = useState<string | null>(null)

  const [editing, setEditing] = useState<WeeklyRequest | null>(null)
  const [deleting, setDeleting] = useState<WeeklyRequest | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteRequest(id),
    onSuccess: () => {
      setDeleting(null)
      setDeleteError(null)
      queryClient.invalidateQueries({ queryKey: ['my-requests'] })
    },
    onError: (err) => setDeleteError(extractErrorMessage(err)),
  })

  const [typeFilter, setTypeFilter] = useState<'all' | 'leave' | RequestType>('all')
  const [statusFilter, setStatusFilter] = useState('')

  const LEAVE_TYPES: RequestType[] = ['leave_full', 'leave_half', 'leave_multi']
  const filteredRequests = (requestsQuery.data ?? []).filter((r) => {
    if (typeFilter === 'leave' && !LEAVE_TYPES.includes(r.request_type)) return false
    if (typeFilter !== 'all' && typeFilter !== 'leave' && r.request_type !== typeFilter) return false
    if (statusFilter && r.status !== statusFilter) return false
    return true
  })

  const submitMutation = useMutation({
    mutationFn: () =>
      submitRequest({
        week_cycle_id: cycleQuery.data!.id,
        request_type: type,
        requested_start_date: startDate,
        requested_end_date: type === 'leave_multi' ? endDate : undefined,
        half_day_portion: type === 'leave_half' ? halfDayPortion : undefined,
        requested_shift_id: type === 'shift_change' ? Number(requestedShiftId) : undefined,
        reason: reason || undefined,
      }),
    onSuccess: () => {
      setFormSuccess('Request submitted.')
      setFormError(null)
      setStartDate('')
      setEndDate('')
      setReason('')
      queryClient.invalidateQueries({ queryKey: ['my-requests'] })
    },
    onError: (err) => {
      setFormError(extractErrorMessage(err))
      setFormSuccess(null)
    },
  })

  const appealMutation = useMutation({
    mutationFn: (requestId: number) => submitAppeal(requestId, appealReason),
    onSuccess: () => {
      setAppealingId(null)
      setAppealReason('')
      setAppealError(null)
      queryClient.invalidateQueries({ queryKey: ['my-requests'] })
    },
    onError: (err) => setAppealError(extractErrorMessage(err)),
  })

  return (
    <div>
      <PageTitle subtitle="Submit a new request or check the status of ones you've already sent in.">My Requests</PageTitle>

      <Card className="mb-6">
        <CardHeader title="Submit a request" description="Requests are reviewed and factored into the weekly roster." />
        {!cycleQuery.data && !cycleQuery.isLoading && (
          <p className="text-[13px] text-ink-muted">No weekly cycle is currently open for requests.</p>
        )}
        {cycleQuery.data && (
          <>
            <ErrorBanner message={formError} />
            <SuccessBanner message={formSuccess} />
            <form
              onSubmit={(e) => {
                e.preventDefault()
                setFormSuccess(null)
                submitMutation.mutate()
              }}
              className="grid gap-3 sm:grid-cols-2"
            >
              <Field label="Request type">
                <Select value={type} onChange={(e) => setType(e.target.value as RequestType)}>
                  {REQUEST_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {REQUEST_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={type === 'leave_multi' ? 'Start date' : 'Date'}>
                <Input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
              {type === 'leave_multi' && (
                <Field label="End date">
                  <Input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </Field>
              )}
              {type === 'leave_half' && (
                <Field label="Which half">
                  <Select value={halfDayPortion} onChange={(e) => setHalfDayPortion(e.target.value)}>
                    <option value="first_half">First half</option>
                    <option value="second_half">Second half</option>
                  </Select>
                </Field>
              )}
              {type === 'shift_change' && (
                <Field label="Requested shift">
                  <Select required value={requestedShiftId} onChange={(e) => setRequestedShiftId(e.target.value)}>
                    <option value="">Select a shift…</option>
                    {shiftsQuery.data?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.start_time}–{s.end_time})
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label="Reason (optional)">
                <Input value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={submitMutation.isPending}>
                  {submitMutation.isPending ? 'Submitting…' : 'Submit request'}
                </Button>
              </div>
            </form>
          </>
        )}
      </Card>

      <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-[13px] font-semibold text-ink">My requests</h2>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Type">
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)} className="w-44">
              <option value="all">All types</option>
              <option value="leave">Leave history (all leave)</option>
              {REQUEST_TYPES.map((t) => (
                <option key={t} value={t}>
                  {REQUEST_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-36">
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="denied">Denied</option>
              <option value="appealed">Appealed</option>
            </Select>
          </Field>
        </div>
      </div>
      {requestsQuery.isLoading && <LoadingText />}
      {requestsQuery.data && requestsQuery.data.length === 0 && <EmptyState text="No requests yet." />}
      {requestsQuery.data && requestsQuery.data.length > 0 && filteredRequests.length === 0 && (
        <EmptyState text="No requests match these filters." />
      )}
      {filteredRequests.length > 0 && (
        <div className="space-y-3">
          {filteredRequests.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[13px] font-semibold text-ink">{REQUEST_TYPE_LABELS[r.request_type]}</p>
                  <p className="text-xs tabular-nums text-ink-muted">
                    {r.requested_start_date}
                    {r.requested_end_date ? ` → ${r.requested_end_date}` : ''}
                  </p>
                  {r.reason && <p className="mt-1 text-[13px] text-ink-secondary">“{r.reason}”</p>}
                  {r.denial_reason && <p className="mt-1 text-[13px] text-critical">Denied: {r.denial_reason}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <StatusBadge status={r.status} />
                  {r.status === 'pending' && (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditing(r)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setDeleting(r)}>
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {r.status === 'denied' && (
                <div className="mt-3 border-t border-line pt-3">
                  {appealingId === r.id ? (
                    <div className="space-y-2">
                      <ErrorBanner message={appealError} />
                      <Input
                        placeholder="Why should this be reconsidered?"
                        value={appealReason}
                        onChange={(e) => setAppealReason(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button
                          disabled={appealMutation.isPending || !appealReason}
                          onClick={() => appealMutation.mutate(r.id)}
                        >
                          Submit appeal
                        </Button>
                        <Button variant="secondary" onClick={() => setAppealingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="secondary" onClick={() => setAppealingId(r.id)}>
                      Appeal this decision
                    </Button>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <EditRequestModal
          request={editing}
          shifts={shiftsQuery.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            queryClient.invalidateQueries({ queryKey: ['my-requests'] })
          }}
        />
      )}

      <Modal
        open={deleting != null}
        onClose={() => {
          setDeleting(null)
          setDeleteError(null)
        }}
        title="Withdraw request"
        description={deleting ? `${REQUEST_TYPE_LABELS[deleting.request_type]} · ${deleting.requested_start_date}` : undefined}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setDeleting(null)
                setDeleteError(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={deleteMutation.isPending}
              loading={deleteMutation.isPending}
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
            >
              Withdraw request
            </Button>
          </>
        }
      >
        {deleteError && <Alert tone="critical" message={deleteError} className="mb-3" />}
        <p className="text-[13px] text-ink-secondary">
          This permanently removes the request. You can only withdraw a request while it is still pending and the cycle's
          request window is open.
        </p>
      </Modal>
    </div>
  )
}

function EditRequestModal({
  request,
  shifts,
  onClose,
  onSaved,
}: {
  request: WeeklyRequest
  shifts: { id: number; name: string; start_time: string; end_time: string }[]
  onClose: () => void
  onSaved: () => void
}) {
  const [type, setType] = useState<RequestType>(request.request_type)
  const [startDate, setStartDate] = useState(request.requested_start_date)
  const [endDate, setEndDate] = useState(request.requested_end_date ?? '')
  const [halfDayPortion, setHalfDayPortion] = useState(request.half_day_portion ?? 'first_half')
  const [requestedShiftId, setRequestedShiftId] = useState(request.requested_shift_id ? String(request.requested_shift_id) : '')
  const [reason, setReason] = useState(request.reason ?? '')
  const [error, setError] = useState<string | null>(null)

  const saveMutation = useMutation({
    mutationFn: () =>
      updateRequest(request.id, {
        request_type: type,
        requested_start_date: startDate,
        requested_end_date: type === 'leave_multi' ? endDate : null,
        half_day_portion: type === 'leave_half' ? halfDayPortion : null,
        requested_shift_id: type === 'shift_change' ? Number(requestedShiftId) : null,
        reason: reason || null,
      }),
    onSuccess: onSaved,
    onError: (err) => setError(extractErrorMessage(err)),
  })

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit request"
      description="Change the details of this pending request."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!startDate || saveMutation.isPending} loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            Save changes
          </Button>
        </>
      }
    >
      {error && <Alert tone="critical" message={error} className="mb-3" />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Request type">
          <Select value={type} onChange={(e) => setType(e.target.value as RequestType)}>
            {REQUEST_TYPES.map((t) => (
              <option key={t} value={t}>
                {REQUEST_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={type === 'leave_multi' ? 'Start date' : 'Date'} required>
          <Input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        {type === 'leave_multi' && (
          <Field label="End date" required>
            <Input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        )}
        {type === 'leave_half' && (
          <Field label="Which half">
            <Select value={halfDayPortion} onChange={(e) => setHalfDayPortion(e.target.value as 'first_half' | 'second_half')}>
              <option value="first_half">First half</option>
              <option value="second_half">Second half</option>
            </Select>
          </Field>
        )}
        {type === 'shift_change' && (
          <Field label="Requested shift" required>
            <Select required value={requestedShiftId} onChange={(e) => setRequestedShiftId(e.target.value)}>
              <option value="">Select a shift…</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.start_time}–{s.end_time})
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="sm:col-span-2">
          <Field label="Reason (optional)">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  )
}

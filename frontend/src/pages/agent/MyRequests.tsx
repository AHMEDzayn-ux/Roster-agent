import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { extractErrorMessage } from '../../api/client'
import { getCurrentWeeklyCycle, listMyRequests, listShiftTemplates, submitAppeal, submitRequest } from '../../api/endpoints'
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  LoadingText,
  PageTitle,
  REQUEST_TYPE_LABELS,
  Select,
  StatusBadge,
  SuccessBanner,
} from '../../components/ui'
import type { RequestType } from '../../types'

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
        <h2 className="mb-3 font-medium text-slate-800">Submit a request</h2>
        {!cycleQuery.data && !cycleQuery.isLoading && (
          <p className="text-sm text-slate-500">No weekly cycle is currently open for requests.</p>
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

      <h2 className="mb-2 text-lg font-medium text-slate-800">My requests</h2>
      {requestsQuery.isLoading && <LoadingText />}
      {requestsQuery.data && requestsQuery.data.length === 0 && <EmptyState text="No requests yet." />}
      {requestsQuery.data && requestsQuery.data.length > 0 && (
        <div className="space-y-3">
          {requestsQuery.data.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-slate-800">{REQUEST_TYPE_LABELS[r.request_type]}</p>
                  <p className="text-sm text-slate-500">
                    {r.requested_start_date}
                    {r.requested_end_date ? ` → ${r.requested_end_date}` : ''}
                  </p>
                  {r.reason && <p className="mt-1 text-sm text-slate-600">"{r.reason}"</p>}
                  {r.denial_reason && <p className="mt-1 text-sm text-red-600">Denied: {r.denial_reason}</p>}
                </div>
                <StatusBadge status={r.status} />
              </div>

              {r.status === 'denied' && (
                <div className="mt-3 border-t border-slate-100 pt-3">
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
    </div>
  )
}

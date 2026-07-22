import { apiClient } from './client'
import type {
  Agent,
  Appeal,
  AppealStatus,
  AuditLogEntry,
  CoverageRequirement,
  LeaveBalance,
  PublicRoster,
  Roster,
  RosterAssignment,
  RosterGenerateResponse,
  RosterImportResponse,
  ShiftTemplate,
  Skill,
  SolverWeights,
  TokenResponse,
  UserOut,
  UserRole,
  WeeklyCycle,
  WeeklyRequest,
} from '../types'

// --- auth ---
export const login = (email: string, password: string) =>
  apiClient.post<TokenResponse>('/auth/login', { email, password }).then((r) => r.data)

export const createUser = (payload: { email: string; password: string; role: UserRole; agent_id?: number | null }) =>
  apiClient.post<UserOut>('/auth/users', payload).then((r) => r.data)

export interface Me {
  id: number
  email: string
  role: UserRole
  agent_id: number | null
  agent_name: string | null
}
export const getMe = () => apiClient.get<Me>('/auth/me').then((r) => r.data)

// --- public roster ---
export const getCurrentPublicRoster = () => apiClient.get<PublicRoster>('/roster/current').then((r) => r.data)
export const getPublicRosterForWeek = (weekStartDate: string) =>
  apiClient.get<PublicRoster>(`/roster/${weekStartDate}`).then((r) => r.data)

// --- skills ---
export const listSkills = () => apiClient.get<Skill[]>('/skills').then((r) => r.data)
export const createSkill = (payload: { name: string; description?: string }) =>
  apiClient.post<Skill>('/skills', payload).then((r) => r.data)
export const updateSkill = (id: number, payload: Partial<{ name: string; description: string }>) =>
  apiClient.patch<Skill>(`/skills/${id}`, payload).then((r) => r.data)
export const deleteSkill = (id: number) => apiClient.delete(`/skills/${id}`)

// --- shift templates ---
export const listShiftTemplates = () => apiClient.get<ShiftTemplate[]>('/shift-templates').then((r) => r.data)
export const createShiftTemplate = (payload: {
  name: string
  start_time: string
  end_time: string
  break_duration_minutes?: number | null
  max_agents?: number | null
}) => apiClient.post<ShiftTemplate>('/shift-templates', payload).then((r) => r.data)
export const updateShiftTemplate = (id: number, payload: Partial<ShiftTemplate>) =>
  apiClient.patch<ShiftTemplate>(`/shift-templates/${id}`, payload).then((r) => r.data)
export const deleteShiftTemplate = (id: number) => apiClient.delete(`/shift-templates/${id}`)

// --- coverage requirements ---
export const listCoverageRequirements = () =>
  apiClient.get<CoverageRequirement[]>('/coverage-requirements').then((r) => r.data)
export const createCoverageRequirement = (payload: Omit<CoverageRequirement, 'id'>) =>
  apiClient.post<CoverageRequirement>('/coverage-requirements', payload).then((r) => r.data)
export const updateCoverageRequirement = (id: number, payload: Partial<CoverageRequirement>) =>
  apiClient.patch<CoverageRequirement>(`/coverage-requirements/${id}`, payload).then((r) => r.data)
export const deleteCoverageRequirement = (id: number) => apiClient.delete(`/coverage-requirements/${id}`)

// --- agents ---
export const listAgents = () => apiClient.get<Agent[]>('/agents').then((r) => r.data)
export const createAgent = (payload: Partial<Agent> & { name: string }) =>
  apiClient.post<Agent>('/agents', payload).then((r) => r.data)
export const updateAgent = (id: number, payload: Partial<Agent>) =>
  apiClient.patch<Agent>(`/agents/${id}`, payload).then((r) => r.data)
export const deleteAgent = (id: number) => apiClient.delete(`/agents/${id}`)

// --- weekly cycles ---
export const listWeeklyCycles = () => apiClient.get<WeeklyCycle[]>('/weekly-cycles').then((r) => r.data)
export const getCurrentWeeklyCycle = () => apiClient.get<WeeklyCycle>('/weekly-cycles/current').then((r) => r.data)
export const createWeeklyCycle = (weekStartDate: string) =>
  apiClient.post<WeeklyCycle>('/weekly-cycles', { week_start_date: weekStartDate }).then((r) => r.data)

// --- leave balances ---
export const listLeaveBalances = (year: number) =>
  apiClient.get<LeaveBalance[]>('/leave-balance', { params: { year } }).then((r) => r.data)
export const getMyLeaveBalance = (year?: number) =>
  apiClient.get<LeaveBalance>('/leave-balance/mine', { params: year ? { year } : {} }).then((r) => r.data)
export const getAgentLeaveBalance = (agentId: number, year?: number) =>
  apiClient
    .get<LeaveBalance>(`/leave-balance/${agentId}`, { params: year ? { year } : {} })
    .then((r) => r.data)
export const createLeaveBalance = (payload: { agent_id: number; year: number; total_leave_days_allotted: number }) =>
  apiClient.post<LeaveBalance>('/leave-balance', payload).then((r) => r.data)
export const updateLeaveBalance = (agentId: number, totalAllotted: number, year?: number) =>
  apiClient
    .patch<LeaveBalance>(`/leave-balance/${agentId}`, { total_leave_days_allotted: totalAllotted }, { params: year ? { year } : {} })
    .then((r) => r.data)

// --- weekly requests ---
export const listMyRequests = (weekCycleId?: number) =>
  apiClient
    .get<WeeklyRequest[]>('/requests/mine', { params: weekCycleId ? { week_cycle_id: weekCycleId } : {} })
    .then((r) => r.data)
export const listRequestsForWeek = (weekCycleId?: number) =>
  apiClient.get<WeeklyRequest[]>('/requests', { params: weekCycleId ? { week: weekCycleId } : {} }).then((r) => r.data)
export const submitRequest = (payload: {
  week_cycle_id: number
  agent_id?: number
  request_type: string
  requested_start_date: string
  requested_end_date?: string | null
  half_day_portion?: string | null
  requested_shift_id?: number | null
  reason?: string | null
}) => apiClient.post<WeeklyRequest>('/requests', payload).then((r) => r.data)
export const denyRequest = (id: number, denialReason: string) =>
  apiClient.patch<WeeklyRequest>(`/requests/${id}`, { status: 'denied', denial_reason: denialReason }).then((r) => r.data)
export const updateRequest = (
  id: number,
  payload: {
    request_type: string
    requested_start_date: string
    requested_end_date?: string | null
    half_day_portion?: string | null
    requested_shift_id?: number | null
    reason?: string | null
  },
) => apiClient.put<WeeklyRequest>(`/requests/${id}`, payload).then((r) => r.data)
export const deleteRequest = (id: number) => apiClient.delete(`/requests/${id}`)

// --- roster ---
export const generateRoster = (weekCycleId: number) =>
  apiClient.post<RosterGenerateResponse>(`/roster/generate?week_cycle_id=${weekCycleId}`).then((r) => r.data)
export const getRosterDetail = (id: number) => apiClient.get<Roster>(`/roster/${id}/detail`).then((r) => r.data)
export const getRosterAssignments = (id: number) =>
  apiClient.get<RosterAssignment[]>(`/roster/${id}/assignments`).then((r) => r.data)
export const getRosterConflicts = (id: number) =>
  apiClient.get(`/roster/${id}/conflicts`).then((r) => r.data)
export const getRosterSatisfaction = (id: number) =>
  apiClient.get(`/roster/${id}/satisfaction`).then((r) => r.data)
export const publishRoster = (id: number) => apiClient.post<Roster>(`/roster/${id}/publish`).then((r) => r.data)
export const lockRoster = (id: number) => apiClient.post<Roster>(`/roster/${id}/lock`).then((r) => r.data)
export const importRoster = (id: number, file: File, reason?: string) => {
  const form = new FormData()
  form.append('file', file)
  if (reason) form.append('reason', reason)
  return apiClient.post<RosterImportResponse>(`/roster/${id}/import`, form).then((r) => r.data)
}
export const overrideAssignment = (
  id: number,
  payload: { agent_id: number; date: string; shift_id?: number | null; skill_id?: number | null; reason: string },
) => apiClient.post<RosterImportResponse>(`/roster/${id}/override`, payload).then((r) => r.data)

// --- solver config ---
export const getSolverWeights = () => apiClient.get<SolverWeights>('/solver-config').then((r) => r.data)
export const updateSolverWeights = (payload: Partial<SolverWeights>) =>
  apiClient.patch<SolverWeights>('/solver-config', payload).then((r) => r.data)

// --- appeals ---
export const submitAppeal = (weeklyRequestId: number, appealReason: string) =>
  apiClient.post<Appeal>('/appeals', { weekly_request_id: weeklyRequestId, appeal_reason: appealReason }).then((r) => r.data)
export const listMyAppeals = () => apiClient.get<Appeal[]>('/appeals/mine').then((r) => r.data)
export const listAppeals = (statusFilter?: AppealStatus) =>
  apiClient.get<Appeal[]>('/appeals', { params: statusFilter ? { status_filter: statusFilter } : {} }).then((r) => r.data)
export const reviewAppeal = (id: number, status: AppealStatus, managerResponse: string) =>
  apiClient.patch<Appeal>(`/appeals/${id}`, { status, manager_response: managerResponse }).then((r) => r.data)

// --- audit ---
export const listAuditLog = (params?: { action_type?: string; target_type?: string }) =>
  apiClient.get<AuditLogEntry[]>('/audit', { params }).then((r) => r.data)
export const listMyAuditLog = () => apiClient.get<AuditLogEntry[]>('/audit/mine').then((r) => r.data)

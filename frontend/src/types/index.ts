export type UserRole = 'agent' | 'manager'

export type RequestType =
  | 'off_day'
  | 'leave_full'
  | 'leave_half'
  | 'leave_multi'
  | 'shift_change'
  | 'overtime'
  | 'other'

export type RequestStatus = 'pending' | 'approved' | 'denied' | 'appealed'
export type HalfDayPortion = 'first_half' | 'second_half'
export type WeeklyCycleStatus = 'open' | 'published' | 'locked'
export type RosterStatus = 'draft' | 'published' | 'locked'
export type ConflictSeverity = 'info' | 'warning' | 'critical'
export type AppealStatus = 'pending' | 'approved' | 'denied'
export type AssignmentSource = 'solver' | 'manual_override'
export type OffDayType = 'fixed' | 'flexible'

export interface TokenResponse {
  access_token: string
  token_type: string
}

export interface UserOut {
  id: number
  email: string
  role: UserRole
  agent_id: number | null
  active: boolean
}

export interface Skill {
  id: number
  name: string
  description: string | null
}

export interface ShiftTemplate {
  id: number
  name: string
  start_time: string
  end_time: string
  break_duration_minutes: number | null
  max_agents: number | null
}

export interface CoverageRequirement {
  id: number
  day_of_week: number
  time_slot_start: string
  time_slot_end: string
  skill_id: number
  min_agents_required: number
  is_peak: boolean
  weight: number
}

export interface Agent {
  id: number
  name: string
  contact_info: string | null
  default_shift_id: number | null
  active: boolean
  default_off_day_type: OffDayType
  default_off_day: number | null
  default_off_days_per_week: number
  skill_ids: number[]
  possible_shift_ids: number[]
}

export interface WeeklyCycle {
  id: number
  week_start_date: string
  request_deadline: string
  publish_date: string
  appeal_deadline: string
  lock_timestamp: string
  status: WeeklyCycleStatus
}

export interface LeaveBalance {
  id: number
  agent_id: number
  year: number
  total_leave_days_allotted: number
  leave_days_taken: number
  half_days_taken: number
  remaining_balance: number
}

export interface WeeklyRequest {
  id: number
  week_cycle_id: number
  agent_id: number
  request_type: RequestType
  requested_start_date: string
  requested_end_date: string | null
  half_day_portion: HalfDayPortion | null
  requested_shift_id: number | null
  reason: string | null
  status: RequestStatus
  denial_reason: string | null
  submitted_via: 'form' | 'ai_parsed'
  created_at: string
}

export interface Roster {
  id: number
  week_cycle_id: number
  generated_at: string
  generated_by: 'solver' | 'manual'
  status: RosterStatus
}

export interface RosterAssignment {
  id: number
  roster_id: number
  agent_id: number
  date: string
  shift_id: number
  skill_covered_id: number
  source: AssignmentSource
}

export interface ConflictReport {
  id: number
  roster_id: number
  description: string
  affected_agent_id: number | null
  unmet_request_id: number | null
  severity: ConflictSeverity
}

export interface SatisfactionMetric {
  id: number
  roster_id: number
  agent_id: number | null
  metric_type: string
  value: number
}

export interface RosterGenerateResponse {
  roster: Roster
  assignments: RosterAssignment[]
  conflicts: ConflictReport[]
  satisfaction_metrics: SatisfactionMetric[]
}

export interface RosterImportResponse {
  roster: Roster
  assignments: RosterAssignment[]
  overridden_requests: string[]
}

export interface PublicAssignment {
  agent_name: string
  date: string
  shift_name: string
  shift_start: string
  shift_end: string
  skill_name: string
}

export interface PublicRoster {
  week_start_date: string
  status: RosterStatus
  assignments: PublicAssignment[]
}

export interface Appeal {
  id: number
  weekly_request_id: number
  agent_id: number
  appeal_reason: string
  status: AppealStatus
  manager_response: string | null
  resolved_by: number | null
  resolved_at: string | null
}

export interface AuditLogEntry {
  id: number
  actor_id: number | null
  action_type: string
  target_type: string
  target_id: number
  old_value: string | null
  new_value: string | null
  reason: string | null
  timestamp: string
}

export interface SolverWeights {
  off_day_request_weight: number
  leave_weight: number
  shift_change_weight: number
  overtime_weight: number
  fairness_weight: number
}

export interface ApiErrorDetail {
  message?: string
  violations?: string[]
}

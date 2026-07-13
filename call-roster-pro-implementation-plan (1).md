# CallRoster Pro — Call Center Roster Management System
## Complete Implementation Plan & Technical Specification

> This document is the full context for the product being built. It should be provided to Claude Code (or any coding agent) as the source of truth for architecture, data model, business rules, and implementation order. Everything below reflects confirmed decisions from planning discussions — nothing here is speculative.

---

## 1. Product Overview

**What it is:** A production-ready, automated roster/scheduling system for call centers. It replaces manual Excel-based rostering with a constraint-solving engine that generates conflict-free weekly schedules — matching agents to shifts based on required skills, availability, leave requests, and fairness rules.

**Who it's for:** Initially built for a single call center domain, architected so the core scheduling engine is reusable. The near-term goal is a fully working, demo-able, portfolio-grade product for a call center. A more generic multi-domain framework is a possible future direction, but is **out of scope for now** — build call-center-specific first.

**Core value proposition:**
- Eliminates manual, error-prone, potentially biased roster creation.
- Guarantees minimum skill coverage at all times (no under-staffing).
- Respects agent leave/shift requests as much as mathematically possible, and is transparent about what couldn't be honored and why.
- Full audit trail for every manual override — prevents favoritism/bias in roster editing.
- Public transparency: anyone can view the published roster without logging in.

---

## 2. Core Functional Requirements (from planning Q&A)

### 2.1 Agent & Skills Database
- Permanent `agents` table — one row per agent, stores baseline/default data.
- Separate, **configurable** `skills` table — e.g., "Prepaid Sales", "Prepaid Support", "Cash", "English", etc. Skills are NOT hardcoded; a call center admin can add/edit/remove skills.
- `agent_skills` join table — many-to-many between agents and skills.
- Each agent has a **fixed/default shift** stored in the database, representing their "normal" pattern. It does **not** change automatically week to week.
- **Off-day vs. Leave — two distinct concepts, not to be conflated:**
  - **Off-day:** each agent gets a default number of off-days per week (typically one). Some agents have a **fixed** off-day (e.g., always Sunday); others may have **no fixed day** (flexible, decided as part of that week's rostering). This is the routine weekly rest day and does **not** draw down from any leave balance. If an agent submits an off-day request for a specific week, it **overrides the fixed default off-day for that week only** — the permanent record is untouched.
  - **Leave:** each agent has a **fixed annual leave quota** (a set number of leave days per year, with half-days possible) that is a completely separate concept from the weekly off-day. Leave is tracked as a running **balance** that gets decremented as it's taken, and a leave request cannot be submitted (or should be flagged) if it would exceed the agent's remaining balance for the year.

### 2.2 Weekly Request Cycle (the operational rhythm)
This is a hard business rule — build the system around this timeline:

| Day | Event |
|---|---|
| **Thursday** | Deadline for agents to submit that week's requests (leave, shift change, special requests). Request window closes end of Thursday. |
| **Friday** | Roster is generated (solver runs) and **published**. Agents can view it (no login required). |
| **Friday (same day)** | Window for agents to **appeal/dispute** denied requests or roster issues. |
| **Saturday** | Manager reviews appeals, may regenerate/adjust the roster. At **midnight Saturday, the roster auto-locks** — no further edits possible after this, no manual "finalize" step required. This is intentional: an automatic hard cutoff, not a manual one, so there's no ambiguity or loophole. |
| **Following Monday–Sunday** | The locked roster is the active operating schedule. |

### 2.3 Weekly Input Layer (Dynamic Requests)
- Each week, agents (or managers on their behalf) submit **weekly requests** of these distinct types:
  - **Off-day request** — requesting a different weekly rest day than their default for this week only (overrides the fixed/flexible default in the agent record, doesn't touch any leave balance).
  - **Leave request** — full-day, half-day (with the affected half specified), or multi-day, drawn from the agent's **annual leave balance**. Not the same as an off-day.
  - **Shift-change request**.
  - **Overtime request**.
  - **Other/special request**.
- Leave and overtime requests are not automatically granted — they go through review/approval (by the solver's constraint logic and/or a manager) and must be resolved before the roster locks. Denied requests are eligible for the appeal process (see 2.8).
- **Priority rule:** weekly input **overrides** the agent's fixed/default database values *for that week only*. The permanent database record is never modified by a weekly request. Example: agent's fixed off-day is Sunday, but they submit an off-day request for Wednesday this week (critical/special case) → solver treats Wednesday as their off day for this week only; Sunday reverts to normal next week unless a new request is made.
- If no weekly request is submitted for an agent, the solver falls back to their fixed/default database values.

### 2.4 Input Method
- **Primary/default:** simple structured form — select agent, select request type, select date(s)/shift, submit. Must be fast and easy (this was a top priority — "so easy" was said repeatedly).
- **Optional AI-assisted input:** a natural-language field where a user types something like "Ravi needs Wednesday off" or "move Priya to the evening shift this week," and an LLM call parses this into structured fields (agent, request type, date, shift) and writes it to the same weekly-requests table. This is an **optional enhancement layer on top of the same structured data model**, not a replacement — the form must always work standalone. Treat as Phase 2 (see roadmap).

### 2.5 Shift Model — Overlapping Shifts, Not Rigid Blocks
Real-world call center shifts overlap throughout the day. The list below is an **illustrative example only** — shift templates must be fully **configurable** by the manager (add, edit, remove, or retime shifts at will), with no fixed shift set hardcoded into the codebase:
- e.g. 06:00–15:00
- e.g. 07:00–16:00
- e.g. 09:00–18:00
- e.g. 12:00–21:00
- e.g. 15:00–00:00
- e.g. 21:00–06:00

**Breaks are not scheduled by the solver.** Each shift includes an operational break (e.g., ~1hr), but placing/timing it is a floor-management decision made by the Team Lead/TA during the shift, not something the system needs to plan around. The `shift_templates` table shouldn't encode break-placement logic — at most a break *duration* for reporting purposes, never a placement rule.

Because shifts overlap, **coverage requirements should be modeled as minimum staffing thresholds per time-slot per skill, across the full 24-hour day**, not as fixed headcounts per named shift. E.g., "between 09:00–10:00 we need ≥3 Prepaid-Sales agents and ≥2 Cash agents." The solver must ensure that at every time slot, across whichever shifts happen to overlap it, the minimum skill coverage is met.

- Thresholds should support **peak-hour weighting** — i.e., different (typically higher) minimums during known peak periods vs. off-peak.
- Thresholds are configurable per call center, per day, per time slot, per skill — not hardcoded.
- Shift templates themselves (how many exist, their start/end times) are configurable per call center — not hardcoded.

### 2.6 Scheduling Engine / Solver
- This is a **constraint satisfaction / constraint optimization problem**, not something to solve with naive/random assignment.
- **Recommended approach: Google OR-Tools CP-SAT solver** (constraint programming). Chosen over classic ILP (e.g., CPLEX/SCIP) because:
  - Free and open source.
  - Purpose-built for shift-scheduling/rostering problems.
  - Scales well to hundreds of agents (this call center's actual scale).
  - Natively supports **soft constraints** with weighted penalties, which this system needs extensively.
- **Hard constraints** (must never be violated):
  - Minimum skill coverage per time slot (understaffing is the highest-cost failure — treat as effectively infinite penalty / hard constraint, not just heavily weighted).
  - No agent double-booked into overlapping/concurrent shifts.
- **Soft constraints, weighted by priority** (satisfy as much as possible, track what's dropped):
  - **Off-day requests** — honored whenever possible, but not an absolute hard constraint. There will be times when coverage requirements make it impossible to grant a requested off-day (or even the fixed default), in which case the solver denies it, logs it in the conflict report, and the agent can appeal. Off-days do **not** draw from any leave balance.
  - **Leave requests (full-day, half-day, or multi-day)** — checked against the agent's remaining **annual leave balance** before being considered by the solver (a request exceeding the balance should be rejected at input validation, not passed to the solver). Among requests within balance, honored whenever possible but still subject to coverage — if granting it would break minimum coverage, the solver denies it, logs it, and the agent can appeal (their leave balance is not decremented for a denied request).
    - Half-day requests must specify which portion (e.g., first half / second half, or an explicit time boundary) so the solver knows which part of the agent's shift is affected — they may still be assigned to work the other half.
  - **Fixed/default off-days** from the agent's permanent record — same treatment as off-day requests: high priority, but overridable by the solver if that week's coverage demands it.
  - **Overtime requests** — an agent (or manager, on the agent's behalf) can request overtime for a given day/shift. Like leave, this must be **pre-approved before the roster locks**, never auto-applied. It flows through the same weekly-request → review/approval → roster pipeline as leave and shift-change requests.
  - Agent shift preferences / requested shift changes.
  - Fairness of shift distribution across agents over time.
  - Priority weighting between all of the above is **configurable**, not hardcoded — e.g., a call center might weight pre-planned multi-day leave higher than a same-week overtime request. Managers should be able to adjust these weights.
- Solver output must include:
  1. The final roster (agent → shift/day assignments for the week).
  2. A **conflict/toleration report**: which requests couldn't be honored and why.
  3. **Satisfaction metrics**: e.g., % of requests honored, per-agent and aggregate — for explainability and to help detect/prevent bias.

### 2.7 Manual Override & Human-in-the-Loop Editing
- After the solver generates the roster, managers must be able to **manually edit** it (human judgment is sometimes required).
- Editing workflow: system generates a **downloadable Excel file** of the roster → manager edits locally if needed → **re-uploads** the edited file → system **re-validates** the upload against all hard constraints.
- If the re-uploaded version violates a hard constraint (e.g., creates understaffing, double-books an agent, ignores a locked leave day), the system must flag the violation.
- **Bias/fairness safeguard:** Any manual edit that violates a soft constraint or overrides a request must require a **supervisor sign-off with a stated reason** before it can be applied. This creates accountability and prevents silent favoritism.
- **Audit trail:** every edit, override, appeal, and decision must be logged — who made the change, what changed, and why (the stated reason). This log should be viewable by agents for transparency (they can see *that* a change was made and the reason, building trust and preventing perceived bias).

### 2.8 Appeals / Disputes
- After the roster is published (Friday), agents can **appeal or dispute** a denied request or an assignment they believe is unfair.
- Appeals must be submitted the same day the roster is published (Friday).
- Manager reviews appeals and may regenerate the roster before the Saturday midnight auto-lock.
- All appeals, and the manager's decision + reasoning, go into the audit trail.

### 2.9 Roles & Access Control
- **Public / no login required:** viewing the published roster for the full week — all agents, all shifts, all skills. Full transparency by design.
- **Login required (role-based):**
  - **Agent role:** submit their own weekly requests, view the full roster, submit appeals for their own denied requests, view audit-log entries relevant to transparency (e.g., what changed and why).
  - **Manager / Roster-Admin role:** view and manage all agent requests, trigger roster generation, manually edit/re-upload rosters, approve/reject appeals, sign off on constraint-violating overrides with a reason, manage the skills table and coverage thresholds.
- Agents must **not** be able to see other agents' pending requests (privacy) — but **can** see the final published roster (which implicitly shows everyone's assigned shifts) and change/audit entries relevant to transparency.

### 2.10 Future / Phase 3 — ML-Based Staffing Prediction (explicitly deferred, do not build yet)
- Long-term idea: use historical performance data (customer wait times / queue metrics, since long wait times trigger SLA penalties from clients) to train a model predicting optimal agent counts per skill per time slot per day-of-week.
- This would eventually **feed into / replace the manually-set coverage thresholds** described in 2.5.
- Explicitly marked as a **future phase** — not part of MVP or Phase 2. Architect the coverage-threshold config so it could later be set programmatically by a model, but do not build the ML component now.

### 2.11 Offline Capability (explicitly deferred)
- Long-term idea: local database + offline-capable PWA so the app is usable without connectivity.
- Explicitly deferred — **build cloud-only for now** (this is for a portfolio/demo deployment). Keep in mind for future architecture but do not implement.

---

## 3. Tech Stack (confirmed)

| Layer | Choice | Notes |
|---|---|---|
| Backend | **FastAPI** (Python) | Also hosts the OR-Tools solver logic |
| Scheduling engine | **Google OR-Tools (CP-SAT solver)** | Constraint programming, not ILP |
| Frontend | **React**, built as a **PWA** | Installable, feels like a native app rather than "visiting a website" — this was an explicit UX goal |
| Database | **PostgreSQL** | Relational, fits the schema well (agents, skills, requests, rosters, audit logs) |
| Auth | JWT-based, role-based access control (agent vs manager) | Public read-only roster endpoint needs **no** auth |
| Deployment | **DigitalOcean** (backend + DB) | Render was considered but rejected — concern about future ML workloads not fitting Render's model well; DigitalOcean preferred for consistency with other projects and headroom for future compute needs |
| Frontend hosting | Any static/PWA-friendly host (e.g., Vercel) talking to the cloud backend | Cloud-first for now; local/offline is future scope |
| Excel import/export | Backend-generated `.xlsx` via a Python library (e.g., openpyxl) for download; re-upload parsed and validated server-side | |
| Optional AI request parsing (Phase 2) | LLM API call (e.g., Claude) to extract structured fields from natural-language input | Falls back to structured form; not a dependency for MVP |

---

## 4. Data Model (high-level schema)

```
agents
  id, name, contact_info, default_shift_id (FK), active, created_at
  -- off-day config (weekly rest, NOT the same as annual leave):
  default_off_day_type (fixed/flexible), default_off_day (nullable — specific weekday, only if type=fixed),
  default_off_days_per_week (default 1, configurable)

skills
  id, name, description, created_at
  -- configurable per call center, not hardcoded

agent_skills
  agent_id (FK), skill_id (FK)

leave_balances
  id, agent_id (FK), year, total_leave_days_allotted, leave_days_taken, half_days_taken, remaining_balance
  -- annual leave quota tracking; separate from the weekly off-day system entirely

shift_templates
  id, name, start_time, end_time, break_duration_minutes (optional, reporting only — no placement logic)
  -- fully manager-configurable, not a fixed set; illustrative examples only:
  -- "06:00-15:00", "07:00-16:00", "09:00-18:00", "12:00-21:00", "15:00-00:00", "21:00-06:00"

coverage_requirements
  id, day_of_week, time_slot_start, time_slot_end, skill_id (FK), min_agents_required, is_peak, weight

weekly_cycles
  id, week_start_date (Monday), request_deadline (Thursday), publish_date (Friday),
  appeal_deadline (Friday), lock_timestamp (Saturday 00:00, auto-set), status

weekly_requests
  id, week_cycle_id (FK), agent_id (FK),
  request_type (off_day/leave_full/leave_half/leave_multi/shift_change/overtime/other),
  requested_date(s), half_day_portion (nullable — first_half/second_half, only for leave_half),
  requested_shift_id (nullable FK), reason, status (pending/approved/denied/appealed),
  denial_reason (nullable — e.g. "coverage requirement", "insufficient leave balance"),
  submitted_via (form/ai_parsed), created_at

rosters
  id, week_cycle_id (FK), generated_at, generated_by (solver/manual), status (draft/published/locked)

roster_assignments
  id, roster_id (FK), agent_id (FK), date, shift_id (FK), skill_covered_id (FK), source (solver/manual_override)

conflict_reports
  id, roster_id (FK), description, affected_agent_id (nullable FK), unmet_request_id (nullable FK), severity

satisfaction_metrics
  id, roster_id (FK), agent_id (nullable FK, null = aggregate), metric_type, value

audit_log
  id, actor_id (FK, nullable if system), action_type, target_type, target_id,
  old_value, new_value, reason, timestamp

appeals
  id, weekly_request_id (FK), agent_id (FK), appeal_reason, status (pending/approved/denied),
  manager_response, resolved_by (FK), resolved_at
```

---

## 5. API Endpoints (high-level)

### Public (no auth)
- `GET /api/roster/current` — view current published/locked roster (full week, all agents/shifts)
- `GET /api/roster/{week_start_date}` — view a specific past roster

### Agent (auth required, agent role)
- `POST /api/requests` — submit a weekly request (structured form)
- `POST /api/requests/ai-parse` — submit natural-language text, get parsed structured request (Phase 2)
- `GET /api/requests/mine` — view own submitted requests + status
- `GET /api/leave-balance/mine` — view own remaining annual leave balance
- `POST /api/appeals` — submit an appeal for a denied request
- `GET /api/audit/mine` — view audit entries relevant to own assignments

### Manager (auth required, manager role)
- `GET /api/requests?week=...` — view all requests for a week cycle
- `PATCH /api/requests/{id}` — approve/deny a request
- `POST /api/roster/generate` — trigger solver run for a week cycle
- `GET /api/roster/{id}/export` — download roster as `.xlsx`
- `POST /api/roster/{id}/import` — re-upload edited `.xlsx`, triggers re-validation
- `POST /api/roster/{id}/override` — apply a manual override with required reason (logged)
- `GET /api/roster/{id}/conflicts` — view conflict/toleration report
- `GET /api/roster/{id}/satisfaction` — view satisfaction metrics
- `PATCH /api/appeals/{id}` — approve/deny an appeal, with required response reason
- `GET /api/audit` — full audit log (filterable)
- `POST /api/skills`, `PATCH /api/skills/{id}` — manage configurable skills table
- `POST /api/coverage-requirements`, `PATCH /api/coverage-requirements/{id}` — manage staffing thresholds
- `GET /api/leave-balance/{agent_id}`, `PATCH /api/leave-balance/{agent_id}` — view/adjust an agent's annual leave allotment

### System
- `POST /api/roster/{id}/lock` — normally automatic (Saturday 00:00), but keep an internal/admin-triggerable version for testing

---

## 6. Frontend Structure (React PWA)

- **Public roster view** (no login) — clean, readable weekly grid, filterable by skill/day.
- **Agent dashboard** (login):
  - Submit request (form + optional AI text box)
  - My requests & statuses
  - Appeal a denied request
  - View audit trail entries relevant to me
- **Manager dashboard** (login):
  - Requests inbox (review/approve/deny)
  - Generate roster (trigger solver, show progress/results)
  - Roster editor view + Excel export/import
  - Conflict report & satisfaction metrics view
  - Appeals inbox
  - Skills & coverage-requirements configuration
  - Audit log viewer
- PWA installable (manifest + service worker), styled to feel like a desktop application rather than a browser page.

---

## 7. Implementation Roadmap

### Phase 1 — MVP (build first)
- Database schema (all core tables above, minus AI-parsing-specific fields if desired).
- Agent/skills/coverage-requirements CRUD (manager-only, admin config).
- Structured weekly-request form (agent-facing).
- OR-Tools CP-SAT solver: hard constraints (coverage, no double-booking, leave respected) + basic soft-constraint preference satisfaction.
- Roster generation, publish, public no-auth viewing.
- Excel export of generated roster.
- Excel re-upload with hard-constraint re-validation.
- Manual override with mandatory reason + audit logging.
- Basic conflict report + satisfaction metrics.
- Weekly cycle timeline logic (Thursday deadline → Friday publish → Friday appeal window → Saturday auto-lock).
- Appeals submission + manager review workflow.
- Auth + role-based access control (agent vs manager).
- Deployment to DigitalOcean (backend + Postgres), frontend as PWA.

### Phase 2 — Enhancements
- AI-assisted natural-language request parsing (LLM call → structured fields → same requests table).
- Refined fairness weighting configuration (let managers tune soft-constraint weights).
- Richer audit/transparency views for agents.
- Peak-hour coverage threshold tooling (UI for setting time-slot minimums easily).

### Phase 3 — Future (do not build yet, but keep architecture compatible)
- ML model trained on historical queue/wait-time data to recommend coverage-requirement values automatically.
- Offline-capable local database mode for the PWA.
- Possible generalization into a multi-domain configurable framework beyond call centers.

---

## 8. Key Non-Negotiable Business Rules (summary for quick reference)

1. Understaffing (unmet minimum skill coverage) is the highest-cost failure — treat as a hard constraint, never silently relaxed.
2. **Off-day and leave are distinct concepts, never conflated:** off-day is a weekly rest day (fixed or flexible per agent, overridable per-week via request, no balance involved); leave is drawn from a fixed **annual balance** (full or half-days) and validated against that balance before being scheduled.
3. Both off-day and leave requests are **high-priority soft constraints, not hard constraints** — they can be denied when coverage requires it, and denials are logged and appealable.
4. Overtime requests must be pre-approved through the same weekly pipeline as leave — never auto-applied.
5. Shift templates (start/end times, how many exist) are fully configurable per call center — never hardcoded. Break placement within a shift is managed operationally by the Team Lead/TA, not by the solver.
6. Fixed/default agent shift & off-day data in the database is never overwritten by a weekly request — weekly requests only override behavior *for that specific week*.
7. Weekly request window closes Thursday; roster publishes Friday; appeals due Friday; roster **auto-locks** Saturday at midnight (no manual finalize step, no way to sneak in late changes).
8. Every manual edit/override must have a logged reason and be visible in the audit trail; edits that break soft/hard constraints require supervisor sign-off.
9. Roster viewing is public/no-login; all editing and request actions require authenticated, role-appropriate access.
10. Agents can appeal denied requests within the same-day window after roster publication.

---

*End of specification. This document reflects all decisions made during planning and should be treated as the source of truth for implementation.*

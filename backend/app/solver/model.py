"""Pure CP-SAT roster solver: no DB access, takes plain dataclasses in and
returns plain dataclasses out so it can be unit tested without a database.

Modeling notes (see plan for full rationale):
- Coverage and no-double-booking are the only hard constraints (spec §2.6).
- Off-day requests, an agent's fixed default off-day, leave requests
  (full/half/multi), shift-change requests and overtime requests are all
  soft constraints, weighted by a manager-configurable `SolverWeights`.
- Fairness is modeled as minimizing the *maximum* number of denied
  soft-requests absorbed by any single agent (minimax), not the raw total.
- Half-day leave is treated as a full day off for scheduling purposes in
  this slice (only 0.5 day is deducted from balance, handled by the caller).
- 'other' requests are not modeled; the caller should leave them untouched.
"""
from dataclasses import dataclass, field
from datetime import date, time, timedelta

from ortools.sat.python import cp_model

MIDNIGHT = time(0, 0)
END_OF_DAY = time(23, 59, 59)

LEAVE_TYPES = {"leave_full", "leave_half", "leave_multi"}


@dataclass
class SolverAgent:
    id: int
    skill_ids: list[int]
    default_shift_id: int | None
    default_off_day_type: str  # "fixed" | "flexible"
    default_off_day: int | None  # 0=Monday..6=Sunday, only meaningful if fixed


@dataclass
class SolverShift:
    id: int
    start_time: time
    end_time: time


@dataclass
class SolverCoverageRequirement:
    day_of_week: int  # 0=Monday..6=Sunday
    time_slot_start: time
    time_slot_end: time
    skill_id: int
    min_agents_required: int


@dataclass
class SolverRequest:
    id: int
    agent_id: int
    request_type: str
    start_date: date
    end_date: date | None
    requested_shift_id: int | None


@dataclass
class SolverWeights:
    off_day_request: int
    default_off_day: int
    leave: int
    shift_change: int
    overtime: int
    fairness: int


@dataclass
class SolverInput:
    week_start_date: date  # must be a Monday
    agents: list[SolverAgent]
    shifts: list[SolverShift]
    coverage_requirements: list[SolverCoverageRequirement]
    requests: list[SolverRequest]
    weights: SolverWeights


@dataclass
class SolverAssignment:
    agent_id: int
    date: date
    shift_id: int
    skill_id: int


@dataclass
class SolverRequestDecision:
    request_id: int
    honored: bool


@dataclass
class SolverResult:
    status: str  # "optimal" | "feasible" | "infeasible"
    assignments: list[SolverAssignment] = field(default_factory=list)
    decisions: list[SolverRequestDecision] = field(default_factory=list)


def _shift_intervals(start: time, end: time) -> list[tuple[time, time]]:
    if end == MIDNIGHT:
        return [(start, END_OF_DAY)]
    if end > start:
        return [(start, end)]
    return [(start, END_OF_DAY), (MIDNIGHT, end)]


def _overlaps(a_start: time, a_end: time, b_start: time, b_end: time) -> bool:
    return a_start < b_end and b_start < a_end


def _shift_covers_slot(shift: SolverShift, slot_start: time, slot_end: time) -> bool:
    return any(
        _overlaps(s, e, slot_start, slot_end) for s, e in _shift_intervals(shift.start_time, shift.end_time)
    )


def _leave_dates(request: SolverRequest) -> list[date]:
    if request.request_type in ("leave_full", "leave_half"):
        return [request.start_date]
    if request.request_type == "leave_multi":
        end = request.end_date or request.start_date
        days = (end - request.start_date).days + 1
        return [request.start_date + timedelta(days=i) for i in range(days)]
    return []


def solve(problem: SolverInput) -> SolverResult:
    model = cp_model.CpModel()
    week_dates = [problem.week_start_date + timedelta(days=i) for i in range(7)]
    shifts_by_id = {s.id: s for s in problem.shifts}

    requests_by_agent_date: dict[tuple[int, date], list[SolverRequest]] = {}
    for req in problem.requests:
        if req.request_type == "other":
            continue
        for d in _leave_dates(req) if req.request_type in LEAVE_TYPES else [req.start_date]:
            requests_by_agent_date.setdefault((req.agent_id, d), []).append(req)

    off_day_request_dates: dict[int, date] = {
        req.agent_id: req.start_date for req in problem.requests if req.request_type == "off_day"
    }

    # mode_vars[(agent_id, date)][mode] -> BoolVar, mode in {"off", "default", "requested"}
    mode_vars: dict[tuple[int, date], dict[str, cp_model.IntVar]] = {}
    # assign_vars[(agent_id, date, mode)][skill_id] -> BoolVar
    assign_vars: dict[tuple[int, date, str], dict[int, cp_model.IntVar]] = {}

    for agent in problem.agents:
        shift_change_dates = {
            req.start_date: req.requested_shift_id
            for req in problem.requests
            if req.request_type == "shift_change" and req.agent_id == agent.id
        }
        for d in week_dates:
            modes = {"off": model.NewBoolVar(f"off_{agent.id}_{d}")}
            if agent.default_shift_id is not None:
                modes["default"] = model.NewBoolVar(f"default_{agent.id}_{d}")
            if d in shift_change_dates and shift_change_dates[d] is not None:
                modes["requested"] = model.NewBoolVar(f"requested_{agent.id}_{d}")
            model.AddExactlyOne(modes.values())
            mode_vars[(agent.id, d)] = modes

            for mode_name, mode_var in modes.items():
                if mode_name == "off":
                    continue
                skill_assigns = {}
                for skill_id in agent.skill_ids:
                    v = model.NewBoolVar(f"assign_{agent.id}_{d}_{mode_name}_{skill_id}")
                    skill_assigns[skill_id] = v
                model.Add(sum(skill_assigns.values()) == mode_var)
                assign_vars[(agent.id, d, mode_name)] = skill_assigns

    # Hard constraint: coverage minimums, per requirement
    for req in problem.coverage_requirements:
        matching_dates = [d for d in week_dates if d.weekday() == req.day_of_week]
        for d in matching_dates:
            terms = []
            for agent in problem.agents:
                if req.skill_id not in agent.skill_ids:
                    continue
                for mode_name in ("default", "requested"):
                    key = (agent.id, d, mode_name)
                    if key not in assign_vars:
                        continue
                    shift_id = agent.default_shift_id if mode_name == "default" else _requested_shift_for(
                        problem.requests, agent.id, d
                    )
                    shift = shifts_by_id.get(shift_id)
                    if shift is None or not _shift_covers_slot(shift, req.time_slot_start, req.time_slot_end):
                        continue
                    terms.append(assign_vars[key][req.skill_id])
            model.Add(sum(terms) >= req.min_agents_required)

    # Soft constraints (objective)
    objective_terms = []
    denied_indicators: dict[int, list[cp_model.IntVar]] = {agent.id: [] for agent in problem.agents}
    # A request is only "honored" if every one of its honor-condition vars is true
    # (matters for leave_multi, which spans several dates / off_vars).
    honored_map: dict[int, list[cp_model.IntVar]] = {}

    for (agent_id, d), reqs in requests_by_agent_date.items():
        off_var = mode_vars[(agent_id, d)]["off"]
        for req in reqs:
            if req.request_type in LEAVE_TYPES:
                honored_map.setdefault(req.id, []).append(off_var)
                denied = model.NewBoolVar(f"denied_leave_{req.id}_{d}")
                model.Add(denied == 1 - off_var)
                objective_terms.append(problem.weights.leave * denied)
                denied_indicators[agent_id].append(denied)
            elif req.request_type == "off_day":
                honored_map.setdefault(req.id, []).append(off_var)
                denied = model.NewBoolVar(f"denied_offday_{req.id}")
                model.Add(denied == 1 - off_var)
                objective_terms.append(problem.weights.off_day_request * denied)
                denied_indicators[agent_id].append(denied)
            elif req.request_type == "overtime":
                worked = model.NewBoolVar(f"worked_overtime_{req.id}")
                model.Add(worked == 1 - off_var)
                honored_map.setdefault(req.id, []).append(worked)
                denied = model.NewBoolVar(f"denied_overtime_{req.id}")
                model.Add(denied == off_var)
                objective_terms.append(problem.weights.overtime * denied)
                denied_indicators[agent_id].append(denied)
            elif req.request_type == "shift_change":
                requested_var = mode_vars[(agent_id, d)].get("requested")
                if requested_var is None:
                    continue
                honored_map.setdefault(req.id, []).append(requested_var)
                denied = model.NewBoolVar(f"denied_shiftchange_{req.id}")
                model.Add(denied == 1 - requested_var)
                objective_terms.append(problem.weights.shift_change * denied)
                denied_indicators[agent_id].append(denied)

    # Default off-day preference, only for agents without an off_day request this week
    for agent in problem.agents:
        if agent.id in off_day_request_dates:
            continue
        if agent.default_off_day_type != "fixed" or agent.default_off_day is None:
            continue
        matching = [d for d in week_dates if d.weekday() == agent.default_off_day]
        if not matching:
            continue
        d = matching[0]
        off_var = mode_vars[(agent.id, d)]["off"]
        denied = model.NewBoolVar(f"denied_default_offday_{agent.id}")
        model.Add(denied == 1 - off_var)
        objective_terms.append(problem.weights.default_off_day * denied)

    # Fairness: minimize the max number of denied soft-requests any one agent absorbs
    if problem.weights.fairness > 0 and any(denied_indicators.values()):
        max_denied = model.NewIntVar(0, len(problem.requests) + 1, "max_denied")
        for agent_id, denials in denied_indicators.items():
            if denials:
                model.Add(max_denied >= sum(denials))
        objective_terms.append(problem.weights.fairness * max_denied)

    if objective_terms:
        model.Minimize(sum(objective_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 30
    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return SolverResult(status="infeasible")

    assignments = []
    for agent in problem.agents:
        for d in week_dates:
            for mode_name in ("default", "requested"):
                key = (agent.id, d, mode_name)
                if key not in assign_vars:
                    continue
                for skill_id, var in assign_vars[key].items():
                    if solver.Value(var):
                        shift_id = (
                            agent.default_shift_id
                            if mode_name == "default"
                            else _requested_shift_for(problem.requests, agent.id, d)
                        )
                        assignments.append(
                            SolverAssignment(agent_id=agent.id, date=d, shift_id=shift_id, skill_id=skill_id)
                        )

    decisions = [
        SolverRequestDecision(request_id=req_id, honored=all(solver.Value(v) for v in vars_))
        for req_id, vars_ in honored_map.items()
    ]

    result_status = "optimal" if status == cp_model.OPTIMAL else "feasible"
    return SolverResult(status=result_status, assignments=assignments, decisions=decisions)


def _requested_shift_for(requests: list[SolverRequest], agent_id: int, d: date) -> int | None:
    for req in requests:
        if req.agent_id == agent_id and req.request_type == "shift_change" and req.start_date == d:
            return req.requested_shift_id
    return None

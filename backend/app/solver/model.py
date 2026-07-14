"""Pure CP-SAT roster solver: no DB access, takes plain dataclasses in and
returns plain dataclasses out so it can be unit tested without a database.

Modeling notes (see plan for full rationale):
- HARD constraints:
  - No double-booking (exactly one mode — off / default shift / requested
    shift — per agent per day).
  - Weekly rest: every agent works 6 days and takes exactly
    default_off_days_per_week (normally 1) rest day, chosen from the days
    they have NOT requested leave for. Leave is a separate, balance-drawn
    allowance that adds *extra* days off on top of the guaranteed rest day;
    it never consumes it.
  - A *fixed* default off-day pins that rest day to that specific weekday —
    unless an off-day request overrides it for the week (see soft below).
- SOFT constraints (weighted penalties from a manager-configurable
  `SolverWeights`, highest weight wins):
  - Leave, off-day, shift-change and overtime requests being honored.
  - An off-day request relocates the single weekly rest day to a custom day
    (either a fixed- or flexible-default agent may ask); overriding a fixed
    default for that week only.
  - Coverage minimums are a soft *target*, not a hard floor — a shortfall
    variable absorbs any missing agents so coverage can never make the model
    infeasible or override the hard weekly-rest / fixed-off-day rules. But it
    is weighted *above* every optional request, so the solver still meets
    coverage whenever it can and only denies a leave/off-day request when
    honoring it would actually leave a slot short.
  - Fairness: minimize the *maximum* number of denied soft-requests absorbed
    by any single agent (minimax), not the raw total.
  - First-come-first-serve: a strict *tie-breaker* below everything else. When
    two solutions are otherwise equal on all the weighted terms above
    (including fairness), the solver prefers the one that honors the
    earlier-submitted request rather than choosing arbitrarily. Implemented via
    lexicographic magnitude separation — the whole FCFS contribution is bounded
    strictly below the smallest possible change in the main objective, so it can
    never override a real distinction, only settle ties deterministically.
- Half-day leave is treated as a full day off for scheduling purposes in
  this slice (only 0.5 day is deducted from balance, handled by the caller).
- 'other' requests are not modeled; the caller should leave them untouched.
"""
from dataclasses import dataclass, field
from datetime import date, time, timedelta

from ortools.sat.python import cp_model

from app.domain.leave import LEAVE_TYPES, leave_dates
from app.domain.shift_coverage import shift_covers_slot


@dataclass
class SolverAgent:
    id: int
    skill_ids: list[int]
    default_shift_id: int | None
    default_off_day_type: str  # "fixed" | "flexible"
    default_off_day: int | None  # 0=Monday..6=Sunday, only meaningful if fixed
    default_off_days_per_week: int = 1
    possible_shift_ids: list[int] = field(default_factory=list)  # alternate shifts the agent may flex onto


@dataclass
class SolverShift:
    id: int
    start_time: time
    end_time: time
    max_agents: int | None = None  # hard cap on agents on this shift per day (None = uncapped)


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
    submitted_rank: int = 0  # 0 = earliest submitted; used only as an FCFS tie-breaker


@dataclass
class SolverWeights:
    off_day_request: int
    default_off_day: int
    leave: int
    shift_change: int
    overtime: int
    fairness: int
    coverage: int = 0  # per-missing-agent penalty for an unmet coverage minimum
    # (soft target, but set above the request weights so coverage is met
    # whenever feasible; 0 disables the coverage term entirely)


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


def solve(problem: SolverInput) -> SolverResult:
    model = cp_model.CpModel()
    week_dates = [problem.week_start_date + timedelta(days=i) for i in range(7)]
    shifts_by_id = {s.id: s for s in problem.shifts}

    requests_by_agent_date: dict[tuple[int, date], list[SolverRequest]] = {}
    for req in problem.requests:
        if req.request_type == "other":
            continue
        for d in leave_dates(req.request_type, req.start_date, req.end_date) if req.request_type in LEAVE_TYPES else [req.start_date]:
            requests_by_agent_date.setdefault((req.agent_id, d), []).append(req)

    off_day_request_dates: dict[int, date] = {
        req.agent_id: req.start_date for req in problem.requests if req.request_type == "off_day"
    }

    # mode_vars[(agent_id, date)][mode] -> BoolVar. Modes: "off", "default"
    # (their default shift), "requested" (a shift-change they asked for), and
    # "poss{shift_id}" for each of the agent's possible/alternate shifts — the
    # solver may flex an agent onto a possible shift on any given day (e.g. to
    # respect a per-shift headcount cap). Exactly one mode is chosen per day.
    mode_vars: dict[tuple[int, date], dict[str, cp_model.IntVar]] = {}
    # mode_shift_id[(agent_id, date)][mode] -> the shift a work-mode resolves to
    mode_shift_id: dict[tuple[int, date], dict[str, int]] = {}
    # assign_vars[(agent_id, date, mode)][skill_id] -> BoolVar
    assign_vars: dict[tuple[int, date, str], dict[int, cp_model.IntVar]] = {}

    for agent in problem.agents:
        shift_change_dates = {
            req.start_date: req.requested_shift_id
            for req in problem.requests
            if req.request_type == "shift_change" and req.agent_id == agent.id
        }
        possible_ids = [sid for sid in agent.possible_shift_ids if sid != agent.default_shift_id and sid in shifts_by_id]
        for d in week_dates:
            modes = {"off": model.NewBoolVar(f"off_{agent.id}_{d}")}
            shift_of_mode: dict[str, int] = {}
            if agent.default_shift_id is not None:
                modes["default"] = model.NewBoolVar(f"default_{agent.id}_{d}")
                shift_of_mode["default"] = agent.default_shift_id
            if d in shift_change_dates and shift_change_dates[d] is not None:
                modes["requested"] = model.NewBoolVar(f"requested_{agent.id}_{d}")
                shift_of_mode["requested"] = shift_change_dates[d]
            for sid in possible_ids:
                name = f"poss{sid}"
                modes[name] = model.NewBoolVar(f"{name}_{agent.id}_{d}")
                shift_of_mode[name] = sid
            model.AddExactlyOne(modes.values())
            mode_vars[(agent.id, d)] = modes
            mode_shift_id[(agent.id, d)] = shift_of_mode

            for mode_name, mode_var in modes.items():
                if mode_name == "off":
                    continue
                skill_assigns = {}
                for skill_id in agent.skill_ids:
                    v = model.NewBoolVar(f"assign_{agent.id}_{d}_{mode_name}_{skill_id}")
                    skill_assigns[skill_id] = v
                model.Add(sum(skill_assigns.values()) == mode_var)
                assign_vars[(agent.id, d, mode_name)] = skill_assigns

    objective_terms = []

    # Soft target: coverage minimums. A shortfall variable absorbs any missing
    # agents so the model is never made infeasible by coverage — instead each
    # missing agent is penalized. Weighted above the request terms (see
    # weights), so the solver meets coverage whenever it can and only lets a
    # leave/off-day request through at the cost of a slot when the hard rules
    # give it no other option.
    for cov_index, req in enumerate(problem.coverage_requirements):
        if req.min_agents_required <= 0:
            continue
        matching_dates = [d for d in week_dates if d.weekday() == req.day_of_week]
        for d in matching_dates:
            terms = []
            for agent in problem.agents:
                if req.skill_id not in agent.skill_ids:
                    continue
                for mode_name, shift_id in mode_shift_id.get((agent.id, d), {}).items():
                    key = (agent.id, d, mode_name)
                    if key not in assign_vars:
                        continue
                    shift = shifts_by_id.get(shift_id)
                    if shift is None or not shift_covers_slot(
                        shift.start_time, shift.end_time, req.time_slot_start, req.time_slot_end
                    ):
                        continue
                    terms.append(assign_vars[key][req.skill_id])
            if problem.weights.coverage > 0:
                shortfall = model.NewIntVar(0, req.min_agents_required, f"cov_short_{cov_index}_{d}")
                model.Add(sum(terms) + shortfall >= req.min_agents_required)
                objective_terms.append(problem.weights.coverage * shortfall)

    # Hard constraint: weekly rest days. Every agent takes exactly
    # default_off_days_per_week (normally 1) day off, chosen from the days
    # they have NOT requested leave for — leave is separate, balance-drawn
    # time off that stacks *on top of* the guaranteed rest day, so leave-
    # request days are excluded from this pool (min() keeps a week fully
    # consumed by leave from becoming infeasible). An off-day request does
    # NOT add a day off; it only asks for the single rest day to fall on a
    # particular day (soft, below), so off-day-request days stay in the pool
    # as candidate rest days.
    # Agents with no default shift can never work (only "off" mode exists),
    # so the quota is meaningless for them and is skipped.
    for agent in problem.agents:
        if agent.default_shift_id is None:
            continue
        rest_pool = [
            d
            for d in week_dates
            if not any(
                req.request_type in LEAVE_TYPES for req in requests_by_agent_date.get((agent.id, d), [])
            )
        ]
        if not rest_pool:
            continue
        rest_days_owed = min(agent.default_off_days_per_week, len(rest_pool))
        model.Add(sum(mode_vars[(agent.id, d)]["off"] for d in rest_pool) == rest_days_owed)

        # A *fixed* default off-day pins that rest day to the specific weekday
        # (hard) — unless an off-day request overrides the placement this week.
        if (
            rest_days_owed >= 1
            and agent.id not in off_day_request_dates
            and agent.default_off_day_type == "fixed"
            and agent.default_off_day is not None
        ):
            fixed_days = [d for d in rest_pool if d.weekday() == agent.default_off_day]
            if fixed_days:
                model.Add(mode_vars[(agent.id, fixed_days[0])]["off"] == 1)

    # Hard constraint: per-shift daily headcount cap (e.g. Overnight = 2). For
    # each capped shift and each date, no more than max_agents may work that
    # shift. An agent works shift S on date d when the chosen mode whose shift
    # resolves to S is 1 (default mode -> their default shift; requested mode ->
    # the shift-change they asked for).
    for shift in problem.shifts:
        if shift.max_agents is None:
            continue
        for d in week_dates:
            terms = [
                mode_vars[(agent.id, d)][mode_name]
                for agent in problem.agents
                for mode_name, sid in mode_shift_id.get((agent.id, d), {}).items()
                if sid == shift.id
            ]
            if terms:
                model.Add(sum(terms) <= shift.max_agents)

    # Soft constraints (objective)
    denied_indicators: dict[int, list[cp_model.IntVar]] = {agent.id: [] for agent in problem.agents}
    # A request is only "honored" if every one of its honor-condition vars is true
    # (matters for leave_multi, which spans several dates / off_vars).
    honored_map: dict[int, list[cp_model.IntVar]] = {}

    # FCFS tie-breaker terms, kept separate from the main objective. A request's
    # "protection" is (num_requests - submitted_rank), so earlier submissions
    # cost more to deny. fcfs_cap accumulates the exact sum of these coefficients
    # (the max the whole FCFS term can reach), which lets us scale the main
    # objective strictly above it — see the lexicographic Minimize below.
    num_requests = len(problem.requests)
    fcfs_terms: list = []
    fcfs_cap = 0

    def _add_fcfs(request: SolverRequest, denied_var: cp_model.IntVar) -> None:
        nonlocal fcfs_cap
        protection = num_requests - request.submitted_rank  # earliest -> largest
        if protection < 1:
            protection = 1
        fcfs_terms.append(protection * denied_var)
        fcfs_cap += protection

    for (agent_id, d), reqs in requests_by_agent_date.items():
        off_var = mode_vars[(agent_id, d)]["off"]
        for req in reqs:
            if req.request_type in LEAVE_TYPES:
                honored_map.setdefault(req.id, []).append(off_var)
                denied = model.NewBoolVar(f"denied_leave_{req.id}_{d}")
                model.Add(denied == 1 - off_var)
                objective_terms.append(problem.weights.leave * denied)
                denied_indicators[agent_id].append(denied)
                _add_fcfs(req, denied)
            elif req.request_type == "off_day":
                honored_map.setdefault(req.id, []).append(off_var)
                denied = model.NewBoolVar(f"denied_offday_{req.id}")
                model.Add(denied == 1 - off_var)
                objective_terms.append(problem.weights.off_day_request * denied)
                denied_indicators[agent_id].append(denied)
                _add_fcfs(req, denied)
            elif req.request_type == "overtime":
                worked = model.NewBoolVar(f"worked_overtime_{req.id}")
                model.Add(worked == 1 - off_var)
                honored_map.setdefault(req.id, []).append(worked)
                denied = model.NewBoolVar(f"denied_overtime_{req.id}")
                model.Add(denied == off_var)
                objective_terms.append(problem.weights.overtime * denied)
                denied_indicators[agent_id].append(denied)
                _add_fcfs(req, denied)
            elif req.request_type == "shift_change":
                requested_var = mode_vars[(agent_id, d)].get("requested")
                if requested_var is None:
                    continue
                honored_map.setdefault(req.id, []).append(requested_var)
                denied = model.NewBoolVar(f"denied_shiftchange_{req.id}")
                model.Add(denied == 1 - requested_var)
                objective_terms.append(problem.weights.shift_change * denied)
                denied_indicators[agent_id].append(denied)
                _add_fcfs(req, denied)

    # Fairness: minimize the max number of denied soft-requests any one agent absorbs
    if problem.weights.fairness > 0 and any(denied_indicators.values()):
        max_denied = model.NewIntVar(0, len(problem.requests) + 1, "max_denied")
        for agent_id, denials in denied_indicators.items():
            if denials:
                model.Add(max_denied >= sum(denials))
        objective_terms.append(problem.weights.fairness * max_denied)

    # Lexicographic objective: minimize the main weighted objective first, and use
    # FCFS purely to settle exact ties. Scaling the main objective by (fcfs_cap + 1)
    # guarantees any genuine improvement in it (>= 1 before scaling) outweighs the
    # entire FCFS term (at most fcfs_cap), so FCFS can never override a real decision.
    if objective_terms and fcfs_terms:
        model.Minimize(sum(objective_terms) * (fcfs_cap + 1) + sum(fcfs_terms))
    elif objective_terms:
        model.Minimize(sum(objective_terms))
    elif fcfs_terms:
        model.Minimize(sum(fcfs_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 30
    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return SolverResult(status="infeasible")

    assignments = []
    for agent in problem.agents:
        for d in week_dates:
            for mode_name, shift_id in mode_shift_id.get((agent.id, d), {}).items():
                key = (agent.id, d, mode_name)
                if key not in assign_vars:
                    continue
                for skill_id, var in assign_vars[key].items():
                    if solver.Value(var):
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

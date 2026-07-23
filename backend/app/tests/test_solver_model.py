from datetime import date, time

from app.solver.model import (
    SolverAgent,
    SolverCoverageRequirement,
    SolverInput,
    SolverRequest,
    SolverShift,
    SolverWeights,
    solve,
)

MONDAY = date(2026, 7, 20)  # a real Monday
TUESDAY = date(2026, 7, 21)
WEDNESDAY = date(2026, 7, 22)
SUNDAY = date(2026, 7, 26)
SKILL = 1
SHIFT = SolverShift(id=1, start_time=time(9, 0), end_time=time(17, 0))

# coverage outranks every request weight (soft, but met whenever feasible)
DEFAULT_WEIGHTS = SolverWeights(
    off_day_request=60, leave=100, shift_change=20, overtime=15, fairness=10, coverage=500
)


def _agent(agent_id: int, skills=(SKILL,), default_shift_id=SHIFT.id, off_type="flexible", off_day=None) -> SolverAgent:
    return SolverAgent(
        id=agent_id,
        skill_ids=list(skills),
        default_shift_id=default_shift_id,
        default_off_day_type=off_type,
        default_off_day=off_day,
    )


def _days_worked(result, agent_id):
    return sorted(a.date for a in result.assignments if a.agent_id == agent_id)


def _all_day_coverage(day_of_week, min_required=1):
    return SolverCoverageRequirement(
        day_of_week=day_of_week, time_slot_start=time(9, 0), time_slot_end=time(17, 0),
        skill_id=SKILL, min_agents_required=min_required,
    )


def _solve(agents, requests=(), coverage=(), shifts=(SHIFT,)):
    return solve(
        SolverInput(
            week_start_date=MONDAY,
            agents=list(agents),
            shifts=list(shifts),
            coverage_requirements=list(coverage),
            requests=list(requests),
            weights=DEFAULT_WEIGHTS,
        )
    )


# --- new hard rules: 6-day work week, one rest day, fixed off-day ---

def test_agent_works_six_days_with_one_rest_day():
    """Hard rule: every agent works exactly 6 days / takes exactly one rest day,
    even with no coverage pressure at all."""
    result = _solve([_agent(1)])
    assert result.status in ("optimal", "feasible")
    assert len(_days_worked(result, 1)) == 6


def test_fixed_off_day_is_hard_even_against_coverage():
    """A fixed default off-day pins the rest day to that weekday — coverage is
    soft and cannot pull the agent in to work it."""
    agent = _agent(1, off_type="fixed", off_day=6)  # Sunday
    result = _solve([agent], coverage=[_all_day_coverage(6)])  # 'wants' the agent Sunday
    worked = _days_worked(result, 1)
    assert SUNDAY not in worked
    assert len(worked) == 6


def test_off_day_request_overrides_fixed_default():
    """An off-day request relocates the single rest day (soft) and overrides a
    fixed default for the week — the agent rests the requested day and works
    the weekday that is normally their fixed off-day."""
    agent = _agent(1, off_type="fixed", off_day=6)  # normally Sunday off
    request = SolverRequest(
        id=1, agent_id=1, request_type="off_day", start_date=WEDNESDAY, end_date=None, requested_shift_id=None
    )
    result = _solve([agent], requests=[request])
    assert result.decisions[0].honored is True
    worked = _days_worked(result, 1)
    assert WEDNESDAY not in worked
    assert SUNDAY in worked


# --- coverage still outranks optional requests (soft, but met when feasible) ---

def test_off_day_denied_when_sole_coverage():
    """Only agent with the skill; coverage needs 1 -> their off-day request is
    denied (they work that day, rest another)."""
    agent = _agent(1)
    request = SolverRequest(
        id=1, agent_id=1, request_type="off_day", start_date=MONDAY, end_date=None, requested_shift_id=None
    )
    result = _solve([agent], requests=[request], coverage=[_all_day_coverage(0)])
    assert result.status in ("optimal", "feasible")
    assert result.decisions[0].honored is False
    assert MONDAY in _days_worked(result, 1)


def test_off_day_honored_when_slack_exists():
    """Two agents share the skill; coverage only needs 1 -> the requester's day off is honored."""
    request = SolverRequest(
        id=1, agent_id=1, request_type="off_day", start_date=MONDAY, end_date=None, requested_shift_id=None
    )
    result = _solve([_agent(1), _agent(2)], requests=[request], coverage=[_all_day_coverage(0)])
    assert result.decisions[0].honored is True
    assert MONDAY not in _days_worked(result, 1)
    assert MONDAY in _days_worked(result, 2)


def test_leave_is_soft_and_can_be_denied_by_coverage():
    """Leave is high-priority but coverage outranks it: sole coverage still forces
    the leave to be denied."""
    agent = _agent(1)
    request = SolverRequest(
        id=1, agent_id=1, request_type="leave_full", start_date=MONDAY, end_date=None, requested_shift_id=None
    )
    result = _solve([agent], requests=[request], coverage=[_all_day_coverage(0)])
    assert result.decisions[0].honored is False
    assert MONDAY in _days_worked(result, 1)


def test_leave_multi_only_honored_if_every_day_granted():
    """A 2-day leave_multi is only 'honored' if BOTH days end up off; Tuesday needs
    both agents so it cannot be."""
    coverage = [_all_day_coverage(0, 1), _all_day_coverage(1, 2)]
    request = SolverRequest(
        id=1, agent_id=1, request_type="leave_multi", start_date=MONDAY, end_date=TUESDAY, requested_shift_id=None
    )
    result = _solve([_agent(1), _agent(2)], requests=[request], coverage=coverage)
    assert result.decisions[0].honored is False
    assert TUESDAY in _days_worked(result, 1)


def test_shift_change_honored_when_feasible():
    evening = SolverShift(id=2, start_time=time(15, 0), end_time=time(23, 0))
    coverage = [
        SolverCoverageRequirement(
            day_of_week=0, time_slot_start=time(15, 0), time_slot_end=time(16, 0), skill_id=SKILL, min_agents_required=1
        )
    ]
    request = SolverRequest(
        id=1, agent_id=1, request_type="shift_change", start_date=MONDAY, end_date=None, requested_shift_id=evening.id
    )
    result = _solve([_agent(1)], requests=[request], coverage=coverage, shifts=[SHIFT, evening])
    assert result.decisions[0].honored is True
    monday_assignment = next(a for a in result.assignments if a.date == MONDAY and a.agent_id == 1)
    assert monday_assignment.shift_id == evening.id


def test_overtime_honored_when_it_only_helps():
    """Scheduling an extra worker never breaks coverage, so overtime is honored whenever feasible."""
    request = SolverRequest(
        id=1, agent_id=1, request_type="overtime", start_date=MONDAY, end_date=None, requested_shift_id=None
    )
    result = _solve([_agent(1)], requests=[request])
    assert result.decisions[0].honored is True
    assert MONDAY in _days_worked(result, 1)


def test_fairness_spreads_denials_across_agents():
    """Two agents both want Monday AND Tuesday off; the one-rest-day rule plus
    coverage force one denial each. Fairness keeps it 1-and-1, never 2-and-0."""
    coverage = [_all_day_coverage(0, 1), _all_day_coverage(1, 1)]
    requests = [
        SolverRequest(id=1, agent_id=1, request_type="off_day", start_date=MONDAY, end_date=None, requested_shift_id=None),
        SolverRequest(id=2, agent_id=1, request_type="off_day", start_date=TUESDAY, end_date=None, requested_shift_id=None),
        SolverRequest(id=3, agent_id=2, request_type="off_day", start_date=MONDAY, end_date=None, requested_shift_id=None),
        SolverRequest(id=4, agent_id=2, request_type="off_day", start_date=TUESDAY, end_date=None, requested_shift_id=None),
    ]
    result = _solve([_agent(1), _agent(2)], requests=requests, coverage=coverage)
    denials_by_agent = {1: 0, 2: 0}
    honored_by_id = {d.request_id: d.honored for d in result.decisions}
    for req in requests:
        if not honored_by_id[req.id]:
            denials_by_agent[req.agent_id] += 1
    assert sum(denials_by_agent.values()) == 2
    assert max(denials_by_agent.values()) == 1


def test_fcfs_breaks_fairness_tie_toward_earlier_submission():
    """Both agents want Monday off, but coverage needs 1 on Monday, so exactly one
    request must be denied. Each agent has a single request, so fairness is a tie
    (one denial either way). FCFS then settles it: the EARLIER submission is
    honored. Fairness is still tier 1; FCFS only decides because fairness can't."""
    coverage = [_all_day_coverage(0, 1)]
    earlier = SolverRequest(
        id=1, agent_id=1, request_type="off_day", start_date=MONDAY, end_date=None,
        requested_shift_id=None, submitted_rank=0,
    )
    later = SolverRequest(
        id=2, agent_id=2, request_type="off_day", start_date=MONDAY, end_date=None,
        requested_shift_id=None, submitted_rank=1,
    )
    result = _solve([_agent(1), _agent(2)], requests=[earlier, later], coverage=coverage)
    honored = {d.request_id: d.honored for d in result.decisions}
    assert honored[1] is True   # earlier submission wins the tie
    assert honored[2] is False
    assert MONDAY not in _days_worked(result, 1)
    assert MONDAY in _days_worked(result, 2)


def test_fcfs_tiebreak_flips_when_submission_order_reversed():
    """Same symmetric scenario, but now agent 2 submitted first. The outcome flips
    to honor agent 2 — proving it is the submission order deciding, not the agent
    id or arbitrary solver iteration order."""
    coverage = [_all_day_coverage(0, 1)]
    agent1_late = SolverRequest(
        id=1, agent_id=1, request_type="off_day", start_date=MONDAY, end_date=None,
        requested_shift_id=None, submitted_rank=1,
    )
    agent2_early = SolverRequest(
        id=2, agent_id=2, request_type="off_day", start_date=MONDAY, end_date=None,
        requested_shift_id=None, submitted_rank=0,
    )
    result = _solve([_agent(1), _agent(2)], requests=[agent1_late, agent2_early], coverage=coverage)
    honored = {d.request_id: d.honored for d in result.decisions}
    assert honored[2] is True   # the earlier submission (agent 2 this time) wins
    assert honored[1] is False


def test_fcfs_never_overrides_fairness():
    """FCFS must stay strictly below fairness. Agent 1 submits two requests very
    early; agent 2 submits one late. Coverage forces one denial on Monday and one
    on Tuesday. Pure FCFS would protect both of agent 1's early requests and dump
    both denials on... nobody (only 2 denials, 2 agents) — so construct the real
    risk: force exactly one denial each day and check fairness still splits them
    1-and-1 rather than FCFS stacking both on the late submitter."""
    coverage = [_all_day_coverage(0, 1), _all_day_coverage(1, 1)]
    requests = [
        SolverRequest(id=1, agent_id=1, request_type="off_day", start_date=MONDAY, end_date=None, requested_shift_id=None, submitted_rank=0),
        SolverRequest(id=2, agent_id=1, request_type="off_day", start_date=TUESDAY, end_date=None, requested_shift_id=None, submitted_rank=1),
        SolverRequest(id=3, agent_id=2, request_type="off_day", start_date=MONDAY, end_date=None, requested_shift_id=None, submitted_rank=2),
        SolverRequest(id=4, agent_id=2, request_type="off_day", start_date=TUESDAY, end_date=None, requested_shift_id=None, submitted_rank=3),
    ]
    result = _solve([_agent(1), _agent(2)], requests=requests, coverage=coverage)
    honored_by_id = {d.request_id: d.honored for d in result.decisions}
    denials_by_agent = {1: 0, 2: 0}
    for req in requests:
        if not honored_by_id[req.id]:
            denials_by_agent[req.agent_id] += 1
    # Fairness (tier 1) still spreads denials 1-and-1; FCFS did NOT let the early
    # submitter (agent 1) escape all denials at the late submitter's expense.
    assert sum(denials_by_agent.values()) == 2
    assert max(denials_by_agent.values()) == 1


def test_unmeetable_coverage_is_soft_not_infeasible():
    """No agent holds the required skill: coverage simply goes unmet (soft) — the
    roster is still produced rather than reported infeasible."""
    agent = _agent(1, skills=(999,))
    result = _solve([agent], coverage=[_all_day_coverage(0)])
    assert result.status in ("optimal", "feasible")
    assert len(_days_worked(result, 1)) == 6  # still scheduled on their own skill


def test_agent_with_only_possible_shift_still_works_full_week():
    """An agent with no default shift but a usable possible shift must still take
    exactly its configured rest days and work the rest — coverage being only a
    floor must never bench a surplus agent that is able to work."""
    agent = SolverAgent(
        id=1,
        skill_ids=[SKILL],
        default_shift_id=None,
        default_off_day_type="flexible",
        default_off_day=None,
        default_off_days_per_week=1,
        possible_shift_ids=[SHIFT.id],
    )
    result = _solve([agent])
    assert len(_days_worked(result, 1)) == 6


def test_agent_with_no_assignable_shift_is_all_off():
    """An agent with neither a default nor any possible shift has no work mode
    and is simply left off — not forced (which would be infeasible)."""
    agent = SolverAgent(
        id=1,
        skill_ids=[SKILL],
        default_shift_id=None,
        default_off_day_type="flexible",
        default_off_day=None,
        default_off_days_per_week=1,
        possible_shift_ids=[],
    )
    result = _solve([agent])
    assert _days_worked(result, 1) == []

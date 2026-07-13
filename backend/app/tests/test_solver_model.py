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
SKILL = 1
SHIFT = SolverShift(id=1, start_time=time(9, 0), end_time=time(17, 0))

DEFAULT_WEIGHTS = SolverWeights(
    off_day_request=60, default_off_day=40, leave=100, shift_change=20, overtime=15, fairness=10
)


def _agent(agent_id: int, skills=(SKILL,), default_shift_id=SHIFT.id) -> SolverAgent:
    return SolverAgent(
        id=agent_id,
        skill_ids=list(skills),
        default_shift_id=default_shift_id,
        default_off_day_type="flexible",
        default_off_day=None,
    )


def test_off_day_denied_when_sole_coverage():
    """Only agent with the skill; coverage requires 1 -> their off-day request must be denied."""
    agent = _agent(1)
    coverage = [
        SolverCoverageRequirement(
            day_of_week=0, time_slot_start=time(9, 0), time_slot_end=time(17, 0), skill_id=SKILL, min_agents_required=1
        )
    ]
    request = SolverRequest(
        id=1, agent_id=1, request_type="off_day", start_date=MONDAY, end_date=None, requested_shift_id=None
    )
    result = solve(
        SolverInput(
            week_start_date=MONDAY,
            agents=[agent],
            shifts=[SHIFT],
            coverage_requirements=coverage,
            requests=[request],
            weights=DEFAULT_WEIGHTS,
        )
    )
    assert result.status in ("optimal", "feasible")
    assert result.decisions[0].honored is False
    assert any(a.agent_id == 1 and a.date == MONDAY for a in result.assignments)


def test_off_day_honored_when_slack_exists():
    """Two agents share the skill; coverage only needs 1 -> the requester's day off is honored."""
    agents = [_agent(1), _agent(2)]
    coverage = [
        SolverCoverageRequirement(
            day_of_week=0, time_slot_start=time(9, 0), time_slot_end=time(17, 0), skill_id=SKILL, min_agents_required=1
        )
    ]
    request = SolverRequest(
        id=1, agent_id=1, request_type="off_day", start_date=MONDAY, end_date=None, requested_shift_id=None
    )
    result = solve(
        SolverInput(
            week_start_date=MONDAY,
            agents=agents,
            shifts=[SHIFT],
            coverage_requirements=coverage,
            requests=[request],
            weights=DEFAULT_WEIGHTS,
        )
    )
    assert result.decisions[0].honored is True
    assert not any(a.agent_id == 1 and a.date == MONDAY for a in result.assignments)
    assert any(a.agent_id == 2 and a.date == MONDAY for a in result.assignments)


def test_leave_is_soft_and_can_be_denied_by_coverage():
    """Leave is high-priority but never hard: sole coverage still forces it to be denied."""
    agent = _agent(1)
    coverage = [
        SolverCoverageRequirement(
            day_of_week=0, time_slot_start=time(9, 0), time_slot_end=time(17, 0), skill_id=SKILL, min_agents_required=1
        )
    ]
    request = SolverRequest(
        id=1, agent_id=1, request_type="leave_full", start_date=MONDAY, end_date=None, requested_shift_id=None
    )
    result = solve(
        SolverInput(
            week_start_date=MONDAY,
            agents=[agent],
            shifts=[SHIFT],
            coverage_requirements=coverage,
            requests=[request],
            weights=DEFAULT_WEIGHTS,
        )
    )
    assert result.decisions[0].honored is False
    assert any(a.agent_id == 1 and a.date == MONDAY for a in result.assignments)


def test_leave_multi_only_honored_if_every_day_granted():
    """A 2-day leave_multi request is only 'honored' if BOTH days end up off."""
    agents = [_agent(1), _agent(2)]
    tuesday = date(2026, 7, 21)
    # Monday has slack (2 agents, needs 1); Tuesday has none (needs 2, i.e. both must work)
    coverage = [
        SolverCoverageRequirement(
            day_of_week=0, time_slot_start=time(9, 0), time_slot_end=time(17, 0), skill_id=SKILL, min_agents_required=1
        ),
        SolverCoverageRequirement(
            day_of_week=1, time_slot_start=time(9, 0), time_slot_end=time(17, 0), skill_id=SKILL, min_agents_required=2
        ),
    ]
    request = SolverRequest(
        id=1, agent_id=1, request_type="leave_multi", start_date=MONDAY, end_date=tuesday, requested_shift_id=None
    )
    result = solve(
        SolverInput(
            week_start_date=MONDAY,
            agents=agents,
            shifts=[SHIFT],
            coverage_requirements=coverage,
            requests=[request],
            weights=DEFAULT_WEIGHTS,
        )
    )
    assert result.decisions[0].honored is False
    assert any(a.agent_id == 1 and a.date == tuesday for a in result.assignments)


def test_shift_change_honored_when_feasible():
    evening = SolverShift(id=2, start_time=time(15, 0), end_time=time(23, 0))
    agent = _agent(1)
    coverage = [
        SolverCoverageRequirement(
            day_of_week=0, time_slot_start=time(15, 0), time_slot_end=time(16, 0), skill_id=SKILL, min_agents_required=1
        )
    ]
    request = SolverRequest(
        id=1, agent_id=1, request_type="shift_change", start_date=MONDAY, end_date=None, requested_shift_id=evening.id
    )
    result = solve(
        SolverInput(
            week_start_date=MONDAY,
            agents=[agent],
            shifts=[SHIFT, evening],
            coverage_requirements=coverage,
            requests=[request],
            weights=DEFAULT_WEIGHTS,
        )
    )
    assert result.decisions[0].honored is True
    assignment = next(a for a in result.assignments if a.date == MONDAY)
    assert assignment.shift_id == evening.id


def test_overtime_honored_when_it_only_helps():
    """Scheduling an extra worker never breaks coverage, so overtime is honored whenever feasible."""
    agent = _agent(1)
    request = SolverRequest(
        id=1, agent_id=1, request_type="overtime", start_date=MONDAY, end_date=None, requested_shift_id=None
    )
    result = solve(
        SolverInput(
            week_start_date=MONDAY,
            agents=[agent],
            shifts=[SHIFT],
            coverage_requirements=[],
            requests=[request],
            weights=DEFAULT_WEIGHTS,
        )
    )
    assert result.decisions[0].honored is True
    assert any(a.agent_id == 1 and a.date == MONDAY for a in result.assignments)


def test_fairness_spreads_denials_across_agents():
    """Two agents both want Monday AND Tuesday off; coverage forces exactly one of them to
    work each day. With fairness weighted, no single agent should absorb both denials."""
    agents = [_agent(1), _agent(2)]
    tuesday = date(2026, 7, 21)
    coverage = [
        SolverCoverageRequirement(
            day_of_week=0, time_slot_start=time(9, 0), time_slot_end=time(17, 0), skill_id=SKILL, min_agents_required=1
        ),
        SolverCoverageRequirement(
            day_of_week=1, time_slot_start=time(9, 0), time_slot_end=time(17, 0), skill_id=SKILL, min_agents_required=1
        ),
    ]
    requests = [
        SolverRequest(id=1, agent_id=1, request_type="off_day", start_date=MONDAY, end_date=None, requested_shift_id=None),
        SolverRequest(id=2, agent_id=1, request_type="off_day", start_date=tuesday, end_date=None, requested_shift_id=None),
        SolverRequest(id=3, agent_id=2, request_type="off_day", start_date=MONDAY, end_date=None, requested_shift_id=None),
        SolverRequest(id=4, agent_id=2, request_type="off_day", start_date=tuesday, end_date=None, requested_shift_id=None),
    ]
    result = solve(
        SolverInput(
            week_start_date=MONDAY,
            agents=agents,
            shifts=[SHIFT],
            coverage_requirements=coverage,
            requests=requests,
            weights=DEFAULT_WEIGHTS,
        )
    )
    denials_by_agent = {1: 0, 2: 0}
    honored_by_id = {d.request_id: d.honored for d in result.decisions}
    for req in requests:
        if not honored_by_id[req.id]:
            denials_by_agent[req.agent_id] += 1

    assert sum(denials_by_agent.values()) == 2
    assert max(denials_by_agent.values()) == 1


def test_infeasible_coverage_reported_cleanly():
    """No agents have the required skill at all -> coverage can never be met."""
    agent = _agent(1, skills=(999,))
    coverage = [
        SolverCoverageRequirement(
            day_of_week=0, time_slot_start=time(9, 0), time_slot_end=time(17, 0), skill_id=SKILL, min_agents_required=1
        )
    ]
    result = solve(
        SolverInput(
            week_start_date=MONDAY,
            agents=[agent],
            shifts=[SHIFT],
            coverage_requirements=coverage,
            requests=[],
            weights=DEFAULT_WEIGHTS,
        )
    )
    assert result.status == "infeasible"

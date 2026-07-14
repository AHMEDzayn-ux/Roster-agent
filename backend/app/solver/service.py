from sqlalchemy.orm import Session, joinedload

from app.crud.solver_config import get_or_create_solver_weights
from app.crud.weekly_request import LEAVE_REQUEST_TYPES
from app.models.agent import Agent
from app.models.coverage import CoverageRequirement
from app.models.enums import (
    AssignmentSource,
    ConflictSeverity,
    GeneratedBy,
    RequestStatus,
    RequestType,
    WeeklyCycleStatus,
)
from app.models.roster import ConflictReport, Roster, RosterAssignment, SatisfactionMetric
from app.models.shift import ShiftTemplate
from app.models.weekly_cycle import WeeklyCycle
from app.models.weekly_request import WeeklyRequest
from app.services.leave_balance_sync import LeaveBalanceSyncError, sync_leave_balance
from app.solver.model import (
    SolverAgent,
    SolverCoverageRequirement,
    SolverInput,
    SolverRequest,
    SolverShift,
    SolverWeights,
    solve,
)

SOLVER_ELIGIBLE_STATUSES = (RequestStatus.pending, RequestStatus.approved)

_SEVERITY_BY_TYPE = {
    RequestType.leave_full: ConflictSeverity.critical,
    RequestType.leave_half: ConflictSeverity.critical,
    RequestType.leave_multi: ConflictSeverity.critical,
    RequestType.off_day: ConflictSeverity.warning,
    RequestType.shift_change: ConflictSeverity.info,
    RequestType.overtime: ConflictSeverity.info,
}

_DESCRIPTION_BY_TYPE = {
    RequestType.leave_full: "Leave request could not be honored due to coverage requirements.",
    RequestType.leave_half: "Half-day leave request could not be honored due to coverage requirements.",
    RequestType.leave_multi: "Multi-day leave request could not be fully honored due to coverage requirements.",
    RequestType.off_day: "Off-day request could not be honored due to coverage requirements.",
    RequestType.shift_change: "Shift-change request could not be honored due to coverage requirements.",
    RequestType.overtime: "Overtime request could not be scheduled.",
}


class RosterGenerationError(Exception):
    def __init__(self, detail: str, status_code: int = 400):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


def _scale_weight(value) -> int:
    """CP-SAT objective coefficients must be integers; weights are stored with
    up to 2 decimal places, so scale by 100 to preserve relative proportions."""
    return int(round(float(value) * 100))


def generate_roster(db: Session, week_cycle_id: int) -> Roster:
    cycle = db.query(WeeklyCycle).filter(WeeklyCycle.id == week_cycle_id).first()
    if cycle is None:
        raise RosterGenerationError("Weekly cycle not found", status_code=404)
    if cycle.status == WeeklyCycleStatus.locked:
        raise RosterGenerationError("This weekly cycle is locked; the roster can no longer be regenerated")

    agents = (
        db.query(Agent)
        .options(joinedload(Agent.skill_links))
        .filter(Agent.active.is_(True))
        .all()
    )
    shifts = db.query(ShiftTemplate).all()
    coverage_requirements = db.query(CoverageRequirement).all()
    requests = (
        db.query(WeeklyRequest)
        .filter(
            WeeklyRequest.week_cycle_id == week_cycle_id,
            WeeklyRequest.status.in_(SOLVER_ELIGIBLE_STATUSES),
            WeeklyRequest.request_type != RequestType.other,
        )
        .all()
    )
    weights_row = get_or_create_solver_weights(db)

    solver_input = SolverInput(
        week_start_date=cycle.week_start_date,
        agents=[
            SolverAgent(
                id=a.id,
                skill_ids=[link.skill_id for link in a.skill_links],
                default_shift_id=a.default_shift_id,
                default_off_day_type=a.default_off_day_type.value,
                default_off_day=a.default_off_day,
            )
            for a in agents
        ],
        shifts=[SolverShift(id=s.id, start_time=s.start_time, end_time=s.end_time) for s in shifts],
        coverage_requirements=[
            SolverCoverageRequirement(
                day_of_week=c.day_of_week,
                time_slot_start=c.time_slot_start,
                time_slot_end=c.time_slot_end,
                skill_id=c.skill_id,
                min_agents_required=c.min_agents_required,
            )
            for c in coverage_requirements
        ],
        requests=[
            SolverRequest(
                id=r.id,
                agent_id=r.agent_id,
                request_type=r.request_type.value,
                start_date=r.requested_start_date,
                end_date=r.requested_end_date,
                requested_shift_id=r.requested_shift_id,
            )
            for r in requests
        ],
        weights=SolverWeights(
            off_day_request=_scale_weight(weights_row.off_day_request_weight),
            default_off_day=_scale_weight(weights_row.default_off_day_weight),
            leave=_scale_weight(weights_row.leave_weight),
            shift_change=_scale_weight(weights_row.shift_change_weight),
            overtime=_scale_weight(weights_row.overtime_weight),
            fairness=_scale_weight(weights_row.fairness_weight),
        ),
    )

    result = solve(solver_input)
    if result.status == "infeasible":
        raise RosterGenerationError(
            "No feasible roster exists for this week's coverage requirements with current staffing "
            "and hard constraints (e.g. not enough agents hold a required skill).",
            status_code=422,
        )

    roster = Roster(week_cycle_id=week_cycle_id, generated_by=GeneratedBy.solver)
    db.add(roster)
    db.flush()

    for a in result.assignments:
        db.add(
            RosterAssignment(
                roster_id=roster.id,
                agent_id=a.agent_id,
                date=a.date,
                shift_id=a.shift_id,
                skill_covered_id=a.skill_id,
                source=AssignmentSource.solver,
            )
        )

    requests_by_id = {r.id: r for r in requests}
    honored_count_by_agent: dict[int, int] = {}
    total_count_by_agent: dict[int, int] = {}

    for decision in result.decisions:
        request = requests_by_id[decision.request_id]
        old_status = request.status

        total_count_by_agent[request.agent_id] = total_count_by_agent.get(request.agent_id, 0) + 1
        if decision.honored:
            honored_count_by_agent[request.agent_id] = honored_count_by_agent.get(request.agent_id, 0) + 1

        if request.request_type in LEAVE_REQUEST_TYPES:
            try:
                sync_leave_balance(db, request, old_status, decision.honored)
            except LeaveBalanceSyncError as exc:
                raise RosterGenerationError(exc.detail)

        request.status = RequestStatus.approved if decision.honored else RequestStatus.denied
        request.denial_reason = None if decision.honored else "coverage requirement"

        if not decision.honored:
            db.add(
                ConflictReport(
                    roster_id=roster.id,
                    description=_DESCRIPTION_BY_TYPE.get(request.request_type, "Request could not be honored."),
                    affected_agent_id=request.agent_id,
                    unmet_request_id=request.id,
                    severity=_SEVERITY_BY_TYPE.get(request.request_type, ConflictSeverity.warning),
                )
            )

    for agent_id, total in total_count_by_agent.items():
        honored = honored_count_by_agent.get(agent_id, 0)
        db.add(
            SatisfactionMetric(
                roster_id=roster.id,
                agent_id=agent_id,
                metric_type="request_satisfaction_pct",
                value=round(honored / total * 100, 2),
            )
        )

    if total_count_by_agent:
        total_all = sum(total_count_by_agent.values())
        honored_all = sum(honored_count_by_agent.values())
        db.add(
            SatisfactionMetric(
                roster_id=roster.id,
                agent_id=None,
                metric_type="request_satisfaction_pct",
                value=round(honored_all / total_all * 100, 2),
            )
        )

    db.commit()
    db.refresh(roster)
    return roster

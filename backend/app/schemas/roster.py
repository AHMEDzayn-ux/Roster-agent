from datetime import date, datetime

from pydantic import BaseModel

from app.models.enums import AssignmentSource, ConflictSeverity, GeneratedBy, RosterStatus


class RosterOut(BaseModel):
    id: int
    week_cycle_id: int
    generated_at: datetime
    generated_by: GeneratedBy
    status: RosterStatus

    model_config = {"from_attributes": True}


class RosterAssignmentOut(BaseModel):
    id: int
    roster_id: int
    agent_id: int
    date: date
    shift_id: int
    skill_covered_id: int
    source: AssignmentSource

    model_config = {"from_attributes": True}


class ConflictReportOut(BaseModel):
    id: int
    roster_id: int
    description: str
    affected_agent_id: int | None
    unmet_request_id: int | None
    severity: ConflictSeverity

    model_config = {"from_attributes": True}


class SatisfactionMetricOut(BaseModel):
    id: int
    roster_id: int
    agent_id: int | None
    metric_type: str
    value: float

    model_config = {"from_attributes": True}


class RosterGenerateResponse(BaseModel):
    roster: RosterOut
    assignments: list[RosterAssignmentOut]
    conflicts: list[ConflictReportOut]
    satisfaction_metrics: list[SatisfactionMetricOut]


class RosterImportResponse(BaseModel):
    roster: RosterOut
    assignments: list[RosterAssignmentOut]
    overridden_requests: list[str]

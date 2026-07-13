from datetime import date, datetime

from pydantic import BaseModel, model_validator

from app.models.enums import HalfDayPortion, RequestStatus, RequestType, SubmittedVia


class WeeklyRequestCreate(BaseModel):
    week_cycle_id: int
    agent_id: int | None = None  # required when a manager submits on an agent's behalf
    request_type: RequestType
    requested_start_date: date
    requested_end_date: date | None = None
    half_day_portion: HalfDayPortion | None = None
    requested_shift_id: int | None = None
    reason: str | None = None

    @model_validator(mode="after")
    def _validate_type_specific_fields(self) -> "WeeklyRequestCreate":
        if self.request_type == RequestType.leave_half and self.half_day_portion is None:
            raise ValueError("half_day_portion is required for leave_half requests")
        if self.request_type == RequestType.leave_multi:
            if self.requested_end_date is None:
                raise ValueError("requested_end_date is required for leave_multi requests")
            if self.requested_end_date < self.requested_start_date:
                raise ValueError("requested_end_date cannot be before requested_start_date")
        if self.request_type == RequestType.shift_change and self.requested_shift_id is None:
            raise ValueError("requested_shift_id is required for shift_change requests")
        return self


class WeeklyRequestReview(BaseModel):
    """Pre-solver manager triage. Can only reject invalid/duplicate requests —
    real approval is decided by the solver at roster generation time (spec §2.6)."""

    status: RequestStatus
    denial_reason: str | None = None

    @model_validator(mode="after")
    def _deny_only(self) -> "WeeklyRequestReview":
        if self.status != RequestStatus.denied:
            raise ValueError(
                "Pre-solver review can only deny a request; approval happens via roster generation"
            )
        if not self.denial_reason:
            raise ValueError("denial_reason is required when denying a request")
        return self


class WeeklyRequestOut(BaseModel):
    id: int
    week_cycle_id: int
    agent_id: int
    request_type: RequestType
    requested_start_date: date
    requested_end_date: date | None
    half_day_portion: HalfDayPortion | None
    requested_shift_id: int | None
    reason: str | None
    status: RequestStatus
    denial_reason: str | None
    submitted_via: SubmittedVia
    created_at: datetime

    model_config = {"from_attributes": True}

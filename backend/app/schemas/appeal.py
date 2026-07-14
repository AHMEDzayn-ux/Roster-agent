from datetime import datetime

from pydantic import BaseModel, model_validator

from app.models.enums import AppealStatus


class AppealCreate(BaseModel):
    weekly_request_id: int
    appeal_reason: str


class AppealReview(BaseModel):
    status: AppealStatus
    manager_response: str

    @model_validator(mode="after")
    def _validate(self) -> "AppealReview":
        if self.status not in (AppealStatus.approved, AppealStatus.denied):
            raise ValueError("status must be 'approved' or 'denied'")
        if not self.manager_response:
            raise ValueError("manager_response is required")
        return self


class AppealOut(BaseModel):
    id: int
    weekly_request_id: int
    agent_id: int
    appeal_reason: str
    status: AppealStatus
    manager_response: str | None
    resolved_by: int | None
    resolved_at: datetime | None

    model_config = {"from_attributes": True}

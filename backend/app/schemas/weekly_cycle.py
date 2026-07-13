from datetime import date, datetime

from pydantic import BaseModel

from app.models.enums import WeeklyCycleStatus


class WeeklyCycleCreate(BaseModel):
    week_start_date: date


class WeeklyCycleOut(BaseModel):
    id: int
    week_start_date: date
    request_deadline: datetime
    publish_date: datetime
    appeal_deadline: datetime
    lock_timestamp: datetime
    status: WeeklyCycleStatus

    model_config = {"from_attributes": True}

from datetime import time

from pydantic import BaseModel


class ShiftTemplateCreate(BaseModel):
    name: str
    start_time: time
    end_time: time
    break_duration_minutes: int | None = None


class ShiftTemplateUpdate(BaseModel):
    name: str | None = None
    start_time: time | None = None
    end_time: time | None = None
    break_duration_minutes: int | None = None


class ShiftTemplateOut(BaseModel):
    id: int
    name: str
    start_time: time
    end_time: time
    break_duration_minutes: int | None

    model_config = {"from_attributes": True}

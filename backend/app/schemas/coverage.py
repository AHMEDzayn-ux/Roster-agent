from datetime import time

from pydantic import BaseModel, Field


class CoverageRequirementCreate(BaseModel):
    day_of_week: int = Field(ge=0, le=6, description="0=Monday ... 6=Sunday")
    time_slot_start: time
    time_slot_end: time
    skill_id: int
    min_agents_required: int = Field(ge=0)
    is_peak: bool = False
    weight: float = 1.0


class CoverageRequirementUpdate(BaseModel):
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    time_slot_start: time | None = None
    time_slot_end: time | None = None
    skill_id: int | None = None
    min_agents_required: int | None = Field(default=None, ge=0)
    is_peak: bool | None = None
    weight: float | None = None


class CoverageRequirementOut(BaseModel):
    id: int
    day_of_week: int
    time_slot_start: time
    time_slot_end: time
    skill_id: int
    min_agents_required: int
    is_peak: bool
    weight: float

    model_config = {"from_attributes": True}

from pydantic import BaseModel, Field

from app.models.enums import OffDayType


class AgentCreate(BaseModel):
    name: str
    contact_info: str | None = None
    default_shift_id: int | None = None
    active: bool = True
    default_off_day_type: OffDayType = OffDayType.flexible
    default_off_day: int | None = Field(default=None, ge=0, le=6, description="0=Monday ... 6=Sunday")
    default_off_days_per_week: int = 1
    skill_ids: list[int] = []


class AgentUpdate(BaseModel):
    name: str | None = None
    contact_info: str | None = None
    default_shift_id: int | None = None
    active: bool | None = None
    default_off_day_type: OffDayType | None = None
    default_off_day: int | None = Field(default=None, ge=0, le=6)
    default_off_days_per_week: int | None = None
    skill_ids: list[int] | None = None


class AgentOut(BaseModel):
    id: int
    name: str
    contact_info: str | None
    default_shift_id: int | None
    active: bool
    default_off_day_type: OffDayType
    default_off_day: int | None
    default_off_days_per_week: int
    skill_ids: list[int] = []

    model_config = {"from_attributes": True}

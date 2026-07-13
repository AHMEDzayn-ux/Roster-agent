from pydantic import BaseModel, Field


class SolverWeightsUpdate(BaseModel):
    off_day_request_weight: float | None = Field(default=None, ge=0)
    default_off_day_weight: float | None = Field(default=None, ge=0)
    leave_weight: float | None = Field(default=None, ge=0)
    shift_change_weight: float | None = Field(default=None, ge=0)
    overtime_weight: float | None = Field(default=None, ge=0)
    fairness_weight: float | None = Field(default=None, ge=0)


class SolverWeightsOut(BaseModel):
    off_day_request_weight: float
    default_off_day_weight: float
    leave_weight: float
    shift_change_weight: float
    overtime_weight: float
    fairness_weight: float

    model_config = {"from_attributes": True}

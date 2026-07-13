from pydantic import BaseModel, Field


class LeaveBalanceCreate(BaseModel):
    agent_id: int
    year: int
    total_leave_days_allotted: float = Field(ge=0)


class LeaveBalanceUpdate(BaseModel):
    total_leave_days_allotted: float = Field(ge=0)


class LeaveBalanceOut(BaseModel):
    id: int
    agent_id: int
    year: int
    total_leave_days_allotted: float
    leave_days_taken: float
    half_days_taken: float
    remaining_balance: float

    model_config = {"from_attributes": True}

from datetime import datetime

from pydantic import BaseModel


class AuditLogOut(BaseModel):
    id: int
    actor_id: int | None
    action_type: str
    target_type: str
    target_id: int
    old_value: str | None
    new_value: str | None
    reason: str | None
    timestamp: datetime

    model_config = {"from_attributes": True}

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_manager
from app.crud import audit as crud
from app.db.session import get_db
from app.models.user import User
from app.schemas.audit import AuditLogOut

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("", response_model=list[AuditLogOut], dependencies=[Depends(require_manager)])
def list_audit_log(
    action_type: str | None = None, target_type: str | None = None, db: Session = Depends(get_db)
) -> list[AuditLogOut]:
    return crud.list_audit_log(db, action_type=action_type, target_type=target_type)


@router.get("/mine", response_model=list[AuditLogOut])
def list_my_audit_log(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[AuditLogOut]:
    if current_user.agent_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This account is not linked to an agent")
    return crud.list_audit_log_for_agent(db, current_user.agent_id)

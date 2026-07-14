from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_manager
from app.crud import weekly_request as crud
from app.crud.audit import record_audit
from app.crud.weekly_request import WeeklyRequestError
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.weekly_request import WeeklyRequestCreate, WeeklyRequestOut, WeeklyRequestReview

router = APIRouter(prefix="/api/requests", tags=["weekly-requests"])


@router.post("", response_model=WeeklyRequestOut, status_code=status.HTTP_201_CREATED)
def submit_request(
    payload: WeeklyRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WeeklyRequestOut:
    if current_user.role == UserRole.manager:
        if payload.agent_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="agent_id is required when a manager submits on behalf of an agent"
            )
        agent_id = payload.agent_id
    else:
        if current_user.agent_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This account is not linked to an agent")
        agent_id = current_user.agent_id

    try:
        return crud.create_request(db, agent_id, payload)
    except WeeklyRequestError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)


@router.get("/mine", response_model=list[WeeklyRequestOut])
def list_my_requests(
    week_cycle_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[WeeklyRequestOut]:
    if current_user.agent_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This account is not linked to an agent")
    return crud.list_requests(db, week_cycle_id=week_cycle_id, agent_id=current_user.agent_id)


@router.get("", response_model=list[WeeklyRequestOut], dependencies=[Depends(require_manager)])
def list_requests(week: int | None = None, db: Session = Depends(get_db)) -> list[WeeklyRequestOut]:
    return crud.list_requests(db, week_cycle_id=week)


@router.patch("/{request_id}", response_model=WeeklyRequestOut)
def review_request(
    request_id: int,
    payload: WeeklyRequestReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
) -> WeeklyRequestOut:
    request = crud.get_request(db, request_id)
    if request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    old_status = request.status.value
    try:
        reviewed = crud.review_request(db, request, payload)
    except WeeklyRequestError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)
    record_audit(
        db,
        actor_id=current_user.id,
        action_type="request_denied",
        target_type="weekly_request",
        target_id=reviewed.id,
        old_value=old_status,
        new_value=reviewed.status.value,
        reason=reviewed.denial_reason,
    )
    db.commit()
    return reviewed

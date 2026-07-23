from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_manager
from app.crud import weekly_request as crud
from app.crud.audit import record_audit
from app.crud.weekly_request import WeeklyRequestError
from app.db.session import get_db
from app.models.enums import RequestStatus, UserRole, WeeklyCycleStatus
from app.models.user import User
from app.models.weekly_cycle import WeeklyCycle
from app.models.weekly_request import WeeklyRequest
from app.schemas.weekly_request import (
    WeeklyRequestCreate,
    WeeklyRequestOut,
    WeeklyRequestReview,
    WeeklyRequestUpdate,
)

router = APIRouter(prefix="/api/requests", tags=["weekly-requests"])


def _get_owned_request(request_id: int, db: Session, current_user: User) -> WeeklyRequest:
    """Fetch a request the caller is allowed to modify: its owning agent, or a manager."""
    request = crud.get_request(db, request_id)
    if request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    is_manager = current_user.role == UserRole.manager
    is_owner = current_user.agent_id is not None and current_user.agent_id == request.agent_id
    if not (is_manager or is_owner):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only change your own requests")
    return request


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
    requests = crud.list_requests(db, week_cycle_id=week_cycle_id, agent_id=current_user.agent_id)

    # Hide approved/denied outcomes until the cycle's roster is published — a draft
    # generation must not reveal (or keep flipping) an agent's result. Cycles are
    # fetched once and the outcome is masked back to "pending" where not revealed.
    cycle_ids = {r.week_cycle_id for r in requests}
    revealed = {
        c.id
        for c in db.query(WeeklyCycle).filter(WeeklyCycle.id.in_(cycle_ids)).all()
        if c.status in crud.REVEALED_CYCLE_STATUSES
    } if cycle_ids else set()

    out: list[WeeklyRequestOut] = []
    for r in requests:
        model = WeeklyRequestOut.model_validate(r)
        if r.week_cycle_id not in revealed and r.status != RequestStatus.pending:
            model = model.model_copy(update={"status": RequestStatus.pending, "denial_reason": None})
        out.append(model)
    return out


@router.get("", response_model=list[WeeklyRequestOut], dependencies=[Depends(require_manager)])
def list_requests(week: int | None = None, db: Session = Depends(get_db)) -> list[WeeklyRequestOut]:
    return crud.list_requests(db, week_cycle_id=week)


@router.put("/{request_id}", response_model=WeeklyRequestOut)
def edit_request(
    request_id: int,
    payload: WeeklyRequestUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WeeklyRequestOut:
    """Owner (or manager) edits a still-pending request while the window is open."""
    request = _get_owned_request(request_id, db, current_user)
    try:
        updated = crud.update_request(db, request, payload)
    except WeeklyRequestError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)
    record_audit(
        db,
        actor_id=current_user.id,
        action_type="request_edited",
        target_type="weekly_request",
        target_id=updated.id,
        new_value=updated.request_type.value,
        reason="Edited by agent" if current_user.role != UserRole.manager else "Edited by manager",
    )
    db.commit()
    return updated


@router.delete("/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Owner (or manager) withdraws a still-pending request while the window is open."""
    request = _get_owned_request(request_id, db, current_user)
    old_status = request.status.value
    record_audit(
        db,
        actor_id=current_user.id,
        action_type="request_withdrawn",
        target_type="weekly_request",
        target_id=request.id,
        old_value=old_status,
        new_value="deleted",
        reason="Withdrawn by agent" if current_user.role != UserRole.manager else "Deleted by manager",
    )
    try:
        crud.delete_request(db, request)
    except WeeklyRequestError as exc:
        db.rollback()
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)


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

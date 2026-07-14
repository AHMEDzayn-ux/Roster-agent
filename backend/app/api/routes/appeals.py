from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_agent, require_manager
from app.crud import appeal as crud
from app.crud.appeal import AppealError
from app.db.session import get_db
from app.models.enums import AppealStatus
from app.models.user import User
from app.schemas.appeal import AppealCreate, AppealOut, AppealReview

router = APIRouter(prefix="/api/appeals", tags=["appeals"])


@router.post("", response_model=AppealOut, status_code=status.HTTP_201_CREATED)
def submit_appeal(
    payload: AppealCreate, db: Session = Depends(get_db), current_user: User = Depends(require_agent)
) -> AppealOut:
    if current_user.agent_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This account is not linked to an agent")
    try:
        return crud.create_appeal(db, current_user.agent_id, payload)
    except AppealError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)


@router.get("/mine", response_model=list[AppealOut])
def list_my_appeals(db: Session = Depends(get_db), current_user: User = Depends(require_agent)) -> list[AppealOut]:
    if current_user.agent_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This account is not linked to an agent")
    return crud.list_appeals_for_agent(db, current_user.agent_id)


@router.get("", response_model=list[AppealOut], dependencies=[Depends(require_manager)])
def list_appeals(status_filter: AppealStatus | None = None, db: Session = Depends(get_db)) -> list[AppealOut]:
    return crud.list_appeals(db, status_filter=status_filter)


@router.patch("/{appeal_id}", response_model=AppealOut, dependencies=[Depends(require_manager)])
def review_appeal(
    appeal_id: int, payload: AppealReview, db: Session = Depends(get_db), current_user: User = Depends(require_manager)
) -> AppealOut:
    appeal = crud.get_appeal(db, appeal_id)
    if appeal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appeal not found")
    try:
        return crud.review_appeal(db, appeal, payload, current_user.id)
    except AppealError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)

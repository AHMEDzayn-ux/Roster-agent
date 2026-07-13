from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_manager
from app.crud import weekly_cycle as crud
from app.db.session import get_db
from app.schemas.weekly_cycle import WeeklyCycleCreate, WeeklyCycleOut

router = APIRouter(prefix="/api/weekly-cycles", tags=["weekly-cycles"])


@router.get("", response_model=list[WeeklyCycleOut], dependencies=[Depends(get_current_user)])
def list_weekly_cycles(db: Session = Depends(get_db)) -> list[WeeklyCycleOut]:
    return crud.list_weekly_cycles(db)


@router.get("/current", response_model=WeeklyCycleOut, dependencies=[Depends(get_current_user)])
def get_current_weekly_cycle(db: Session = Depends(get_db)) -> WeeklyCycleOut:
    cycle = crud.get_current_weekly_cycle(db)
    if cycle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active weekly cycle")
    return cycle


@router.post("", response_model=WeeklyCycleOut, status_code=status.HTTP_201_CREATED)
def create_weekly_cycle(
    payload: WeeklyCycleCreate, db: Session = Depends(get_db), _manager=Depends(require_manager)
) -> WeeklyCycleOut:
    if payload.week_start_date.weekday() != 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="week_start_date must be a Monday")
    if crud.get_weekly_cycle_by_week_start(db, payload.week_start_date) is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="A weekly cycle for this week already exists"
        )
    return crud.create_weekly_cycle(db, payload)

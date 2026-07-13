from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_agent, require_manager
from app.crud import leave_balance as crud
from app.db.session import get_db
from app.models.user import User
from app.schemas.leave_balance import LeaveBalanceCreate, LeaveBalanceOut, LeaveBalanceUpdate

router = APIRouter(prefix="/api/leave-balance", tags=["leave-balance"])


@router.get("/mine", response_model=LeaveBalanceOut)
def get_my_leave_balance(
    year: int = date.today().year, db: Session = Depends(get_db), current_user: User = Depends(require_agent)
) -> LeaveBalanceOut:
    if current_user.agent_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This account is not linked to an agent")
    balance = crud.get_leave_balance(db, current_user.agent_id, year)
    if balance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No leave balance for that year")
    return balance


@router.get("/{agent_id}", response_model=LeaveBalanceOut, dependencies=[Depends(require_manager)])
def get_agent_leave_balance(agent_id: int, year: int = date.today().year, db: Session = Depends(get_db)) -> LeaveBalanceOut:
    balance = crud.get_leave_balance(db, agent_id, year)
    if balance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No leave balance for that year")
    return balance


@router.post("", response_model=LeaveBalanceOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_manager)])
def create_leave_balance(payload: LeaveBalanceCreate, db: Session = Depends(get_db)) -> LeaveBalanceOut:
    if crud.get_leave_balance(db, payload.agent_id, payload.year) is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Leave balance already exists for this agent/year"
        )
    return crud.create_leave_balance(db, payload)


@router.patch("/{agent_id}", response_model=LeaveBalanceOut, dependencies=[Depends(require_manager)])
def update_agent_leave_balance(
    agent_id: int, payload: LeaveBalanceUpdate, year: int = date.today().year, db: Session = Depends(get_db)
) -> LeaveBalanceOut:
    balance = crud.get_leave_balance(db, agent_id, year)
    if balance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No leave balance for that year")
    return crud.update_leave_balance(db, balance, payload)

from sqlalchemy.orm import Session

from app.models.leave_balance import LeaveBalance
from app.schemas.leave_balance import LeaveBalanceCreate, LeaveBalanceUpdate


def get_leave_balance(db: Session, agent_id: int, year: int) -> LeaveBalance | None:
    return (
        db.query(LeaveBalance)
        .filter(LeaveBalance.agent_id == agent_id, LeaveBalance.year == year)
        .first()
    )


def create_leave_balance(db: Session, balance_in: LeaveBalanceCreate) -> LeaveBalance:
    balance = LeaveBalance(
        agent_id=balance_in.agent_id,
        year=balance_in.year,
        total_leave_days_allotted=balance_in.total_leave_days_allotted,
        leave_days_taken=0,
        half_days_taken=0,
        remaining_balance=balance_in.total_leave_days_allotted,
    )
    db.add(balance)
    db.commit()
    db.refresh(balance)
    return balance


def update_leave_balance(db: Session, balance: LeaveBalance, balance_in: LeaveBalanceUpdate) -> LeaveBalance:
    taken = float(balance.leave_days_taken) + float(balance.half_days_taken)
    balance.total_leave_days_allotted = balance_in.total_leave_days_allotted
    balance.remaining_balance = balance_in.total_leave_days_allotted - taken
    db.commit()
    db.refresh(balance)
    return balance

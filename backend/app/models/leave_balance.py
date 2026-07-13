from sqlalchemy import ForeignKey, Integer, Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class LeaveBalance(Base):
    __tablename__ = "leave_balances"
    __table_args__ = (UniqueConstraint("agent_id", "year", name="uq_leave_balance_agent_year"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    total_leave_days_allotted: Mapped[float] = mapped_column(Numeric(5, 1), nullable=False)
    leave_days_taken: Mapped[float] = mapped_column(Numeric(5, 1), default=0, nullable=False)
    half_days_taken: Mapped[float] = mapped_column(Numeric(5, 1), default=0, nullable=False)
    remaining_balance: Mapped[float] = mapped_column(Numeric(5, 1), nullable=False)

    agent: Mapped["Agent"] = relationship()

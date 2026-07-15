from sqlalchemy import Numeric
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SolverWeights(Base):
    """Singleton (id=1) row of manager-configurable soft-constraint weights
    used by the CP-SAT solver's objective function. Coverage and no-double-
    booking are always hard constraints and are never weighted here."""

    __tablename__ = "solver_weights"

    id: Mapped[int] = mapped_column(primary_key=True)
    off_day_request_weight: Mapped[float] = mapped_column(Numeric(6, 2), default=60, nullable=False)
    leave_weight: Mapped[float] = mapped_column(Numeric(6, 2), default=100, nullable=False)
    shift_change_weight: Mapped[float] = mapped_column(Numeric(6, 2), default=20, nullable=False)
    overtime_weight: Mapped[float] = mapped_column(Numeric(6, 2), default=15, nullable=False)
    fairness_weight: Mapped[float] = mapped_column(Numeric(6, 2), default=10, nullable=False)

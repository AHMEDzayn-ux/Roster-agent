from datetime import time

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CoverageRequirement(Base):
    __tablename__ = "coverage_requirements"

    id: Mapped[int] = mapped_column(primary_key=True)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Monday ... 6=Sunday
    time_slot_start: Mapped[time] = mapped_column(Time, nullable=False)
    time_slot_end: Mapped[time] = mapped_column(Time, nullable=False)
    skill_id: Mapped[int] = mapped_column(ForeignKey("skills.id"), nullable=False)
    min_agents_required: Mapped[int] = mapped_column(Integer, nullable=False)
    is_peak: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    weight: Mapped[float] = mapped_column(Numeric(5, 2), default=1.0, nullable=False)

    skill: Mapped["Skill"] = relationship()

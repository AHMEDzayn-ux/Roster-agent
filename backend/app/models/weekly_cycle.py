from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import WeeklyCycleStatus


class WeeklyCycle(Base):
    __tablename__ = "weekly_cycles"

    id: Mapped[int] = mapped_column(primary_key=True)
    week_start_date: Mapped[date] = mapped_column(Date, unique=True, nullable=False)
    request_deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    publish_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    appeal_deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    lock_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[WeeklyCycleStatus] = mapped_column(
        Enum(WeeklyCycleStatus, name="weekly_cycle_status"),
        default=WeeklyCycleStatus.open,
        nullable=False,
    )

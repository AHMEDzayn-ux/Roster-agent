from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import HalfDayPortion, RequestStatus, RequestType, SubmittedVia


class WeeklyRequest(Base):
    __tablename__ = "weekly_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    week_cycle_id: Mapped[int] = mapped_column(ForeignKey("weekly_cycles.id"), nullable=False)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), nullable=False)

    request_type: Mapped[RequestType] = mapped_column(Enum(RequestType, name="request_type"), nullable=False)

    # requested_date(s): single date, or a range for leave_multi (end_date null for single-day requests)
    requested_start_date: Mapped[date] = mapped_column(Date, nullable=False)
    requested_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    half_day_portion: Mapped[HalfDayPortion | None] = mapped_column(
        Enum(HalfDayPortion, name="half_day_portion"), nullable=True
    )
    requested_shift_id: Mapped[int | None] = mapped_column(ForeignKey("shift_templates.id"), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[RequestStatus] = mapped_column(
        Enum(RequestStatus, name="request_status"), default=RequestStatus.pending, nullable=False
    )
    denial_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    submitted_via: Mapped[SubmittedVia] = mapped_column(
        Enum(SubmittedVia, name="submitted_via"), default=SubmittedVia.form, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    agent: Mapped["Agent"] = relationship()
    week_cycle: Mapped["WeeklyCycle"] = relationship()
    requested_shift: Mapped["ShiftTemplate | None"] = relationship()

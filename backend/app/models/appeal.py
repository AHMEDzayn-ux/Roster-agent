from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import AppealStatus


class Appeal(Base):
    __tablename__ = "appeals"

    id: Mapped[int] = mapped_column(primary_key=True)
    weekly_request_id: Mapped[int] = mapped_column(ForeignKey("weekly_requests.id"), nullable=False)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), nullable=False)
    appeal_reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[AppealStatus] = mapped_column(
        Enum(AppealStatus, name="appeal_status"), default=AppealStatus.pending, nullable=False
    )
    manager_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    weekly_request: Mapped["WeeklyRequest"] = relationship()
    agent: Mapped["Agent"] = relationship(foreign_keys=[agent_id])
    resolver: Mapped["User | None"] = relationship(foreign_keys=[resolved_by])

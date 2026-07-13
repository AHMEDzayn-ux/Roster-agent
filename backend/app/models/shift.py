from datetime import time

from sqlalchemy import Integer, String, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ShiftTemplate(Base):
    __tablename__ = "shift_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    break_duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)

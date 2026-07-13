from datetime import date, datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import OffDayType


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    contact_info: Mapped[str | None] = mapped_column(String(255), nullable=True)
    default_shift_id: Mapped[int | None] = mapped_column(ForeignKey("shift_templates.id"), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    default_off_day_type: Mapped[OffDayType] = mapped_column(
        Enum(OffDayType, name="off_day_type"), default=OffDayType.flexible, nullable=False
    )
    default_off_day: Mapped[int | None] = mapped_column(Integer, nullable=True)
    default_off_days_per_week: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    default_shift: Mapped["ShiftTemplate | None"] = relationship(foreign_keys=[default_shift_id])
    skill_links: Mapped[list["AgentSkill"]] = relationship(back_populates="agent", cascade="all, delete-orphan")


class AgentSkill(Base):
    __tablename__ = "agent_skills"

    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), primary_key=True)
    skill_id: Mapped[int] = mapped_column(ForeignKey("skills.id"), primary_key=True)

    agent: Mapped["Agent"] = relationship(back_populates="skill_links")
    skill: Mapped["Skill"] = relationship(back_populates="agent_links")

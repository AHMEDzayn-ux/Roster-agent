from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import AssignmentSource, ConflictSeverity, GeneratedBy, RosterStatus


class Roster(Base):
    __tablename__ = "rosters"

    id: Mapped[int] = mapped_column(primary_key=True)
    week_cycle_id: Mapped[int] = mapped_column(ForeignKey("weekly_cycles.id"), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    generated_by: Mapped[GeneratedBy] = mapped_column(Enum(GeneratedBy, name="generated_by"), nullable=False)
    status: Mapped[RosterStatus] = mapped_column(
        Enum(RosterStatus, name="roster_status"), default=RosterStatus.draft, nullable=False
    )

    week_cycle: Mapped["WeeklyCycle"] = relationship()
    assignments: Mapped[list["RosterAssignment"]] = relationship(back_populates="roster", cascade="all, delete-orphan")


class RosterAssignment(Base):
    __tablename__ = "roster_assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    roster_id: Mapped[int] = mapped_column(ForeignKey("rosters.id"), nullable=False)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    shift_id: Mapped[int] = mapped_column(ForeignKey("shift_templates.id"), nullable=False)
    skill_covered_id: Mapped[int] = mapped_column(ForeignKey("skills.id"), nullable=False)
    source: Mapped[AssignmentSource] = mapped_column(
        Enum(AssignmentSource, name="assignment_source"), default=AssignmentSource.solver, nullable=False
    )

    roster: Mapped["Roster"] = relationship(back_populates="assignments")
    agent: Mapped["Agent"] = relationship()
    shift: Mapped["ShiftTemplate"] = relationship()
    skill_covered: Mapped["Skill"] = relationship()


class ConflictReport(Base):
    __tablename__ = "conflict_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    roster_id: Mapped[int] = mapped_column(ForeignKey("rosters.id"), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    affected_agent_id: Mapped[int | None] = mapped_column(ForeignKey("agents.id"), nullable=True)
    unmet_request_id: Mapped[int | None] = mapped_column(ForeignKey("weekly_requests.id"), nullable=True)
    severity: Mapped[ConflictSeverity] = mapped_column(
        Enum(ConflictSeverity, name="conflict_severity"), default=ConflictSeverity.warning, nullable=False
    )

    roster: Mapped["Roster"] = relationship()


class SatisfactionMetric(Base):
    __tablename__ = "satisfaction_metrics"

    id: Mapped[int] = mapped_column(primary_key=True)
    roster_id: Mapped[int] = mapped_column(ForeignKey("rosters.id"), nullable=False)
    agent_id: Mapped[int | None] = mapped_column(ForeignKey("agents.id"), nullable=True)  # null = aggregate
    metric_type: Mapped[str] = mapped_column(String(100), nullable=False)
    value: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)

    roster: Mapped["Roster"] = relationship()

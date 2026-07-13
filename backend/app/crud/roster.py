from datetime import date

from sqlalchemy.orm import Session

from app.models.enums import RosterStatus
from app.models.roster import ConflictReport, Roster, RosterAssignment, SatisfactionMetric
from app.models.weekly_cycle import WeeklyCycle

PUBLICLY_VISIBLE_STATUSES = (RosterStatus.published, RosterStatus.locked)


def get_roster(db: Session, roster_id: int) -> Roster | None:
    return db.query(Roster).filter(Roster.id == roster_id).first()


def get_public_roster_for_week(db: Session, week_start_date: date) -> Roster | None:
    return (
        db.query(Roster)
        .join(WeeklyCycle, Roster.week_cycle_id == WeeklyCycle.id)
        .filter(WeeklyCycle.week_start_date == week_start_date, Roster.status.in_(PUBLICLY_VISIBLE_STATUSES))
        .order_by(Roster.generated_at.desc())
        .first()
    )


def get_current_public_roster(db: Session) -> Roster | None:
    today = date.today()
    # Prefer the roster whose week has started (most recent one on/before today);
    # otherwise fall back to the nearest upcoming published roster.
    current_or_past = (
        db.query(Roster)
        .join(WeeklyCycle, Roster.week_cycle_id == WeeklyCycle.id)
        .filter(WeeklyCycle.week_start_date <= today, Roster.status.in_(PUBLICLY_VISIBLE_STATUSES))
        .order_by(WeeklyCycle.week_start_date.desc())
        .first()
    )
    if current_or_past is not None:
        return current_or_past
    return (
        db.query(Roster)
        .join(WeeklyCycle, Roster.week_cycle_id == WeeklyCycle.id)
        .filter(WeeklyCycle.week_start_date > today, Roster.status.in_(PUBLICLY_VISIBLE_STATUSES))
        .order_by(WeeklyCycle.week_start_date.asc())
        .first()
    )


def list_assignments(db: Session, roster_id: int) -> list[RosterAssignment]:
    return db.query(RosterAssignment).filter(RosterAssignment.roster_id == roster_id).all()


def list_conflicts(db: Session, roster_id: int) -> list[ConflictReport]:
    return db.query(ConflictReport).filter(ConflictReport.roster_id == roster_id).all()


def list_satisfaction_metrics(db: Session, roster_id: int) -> list[SatisfactionMetric]:
    return db.query(SatisfactionMetric).filter(SatisfactionMetric.roster_id == roster_id).all()

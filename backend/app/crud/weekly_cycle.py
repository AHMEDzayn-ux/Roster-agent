from datetime import datetime, time, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.enums import WeeklyCycleStatus
from app.models.weekly_cycle import WeeklyCycle
from app.schemas.weekly_cycle import WeeklyCycleCreate


def list_weekly_cycles(db: Session) -> list[WeeklyCycle]:
    return db.query(WeeklyCycle).order_by(WeeklyCycle.week_start_date.desc()).all()


def get_weekly_cycle(db: Session, cycle_id: int) -> WeeklyCycle | None:
    return db.query(WeeklyCycle).filter(WeeklyCycle.id == cycle_id).first()


def get_weekly_cycle_by_week_start(db: Session, week_start_date) -> WeeklyCycle | None:
    return db.query(WeeklyCycle).filter(WeeklyCycle.week_start_date == week_start_date).first()


def get_current_weekly_cycle(db: Session) -> WeeklyCycle | None:
    now = datetime.now(timezone.utc)
    return (
        db.query(WeeklyCycle)
        .filter(WeeklyCycle.lock_timestamp >= now)
        .order_by(WeeklyCycle.week_start_date.asc())
        .first()
    )


def _at_utc(d, days_offset: int, t: time) -> datetime:
    return datetime.combine(d + timedelta(days=days_offset), t, tzinfo=timezone.utc)


def create_weekly_cycle(db: Session, cycle_in: WeeklyCycleCreate) -> WeeklyCycle:
    week_start = cycle_in.week_start_date
    cycle = WeeklyCycle(
        week_start_date=week_start,
        # Thursday end-of-day: request window closes
        request_deadline=_at_utc(week_start, 3, time(23, 59, 59)),
        # Friday start-of-day: roster generation/publish day
        publish_date=_at_utc(week_start, 4, time(0, 0, 0)),
        # Friday end-of-day: appeal window closes
        appeal_deadline=_at_utc(week_start, 4, time(23, 59, 59)),
        # Saturday midnight: automatic hard lock
        lock_timestamp=_at_utc(week_start, 5, time(0, 0, 0)),
        status=WeeklyCycleStatus.open,
    )
    db.add(cycle)
    db.commit()
    db.refresh(cycle)
    return cycle

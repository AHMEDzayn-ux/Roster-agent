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


# Sri Lanka (Asia/Colombo) is a fixed UTC+5:30 offset year-round (no DST), so a
# fixed-offset tz is exact. Deadlines are authored as local wall-clock times and
# stored as UTC instants, so they render as the intended Sri Lanka clock time.
LOCAL_TZ = timezone(timedelta(hours=5, minutes=30))


def _local_to_utc(d, days_offset: int, t: time) -> datetime:
    """Wall-clock `t` on `d + days_offset` in local (Sri Lanka) time, returned as
    a UTC-aware datetime for storage and comparison."""
    return datetime.combine(d + timedelta(days=days_offset), t, tzinfo=LOCAL_TZ).astimezone(timezone.utc)


def ensure_upcoming_cycles(db: Session, weeks_ahead: int = 3) -> list[WeeklyCycle]:
    """Idempotently make sure a cycle exists for each of the next `weeks_ahead`
    Mondays, so agents always have upcoming weeks open for requests without a
    manager hand-creating each one. Skips weeks that already have a cycle and
    never touches the current (already-started) week. Returns the cycles created
    by this call. Meant to run daily via scripts/ensure_weekly_cycles.py."""
    from datetime import date

    today = date.today()
    days_until_monday = (7 - today.weekday()) % 7 or 7  # strictly the NEXT Monday
    first_monday = today + timedelta(days=days_until_monday)

    created: list[WeeklyCycle] = []
    for i in range(weeks_ahead):
        monday = first_monday + timedelta(days=7 * i)
        if get_weekly_cycle_by_week_start(db, monday) is None:
            created.append(create_weekly_cycle(db, WeeklyCycleCreate(week_start_date=monday)))
    return created


def create_weekly_cycle(db: Session, cycle_in: WeeklyCycleCreate) -> WeeklyCycle:
    week_start = cycle_in.week_start_date
    # Lead-time timeline: everything is settled in the week BEFORE the roster week
    # begins, so agents know their shifts in advance. Offsets are counted from the
    # roster week's Monday (week_start).
    cycle = WeeklyCycle(
        week_start_date=week_start,
        # Previous-week Thursday 00:00 local: request window closes.
        request_deadline=_local_to_utc(week_start, -4, time(0, 0, 0)),
        # Previous-week Saturday 00:00 local (Friday night): roster publish.
        publish_date=_local_to_utc(week_start, -2, time(0, 0, 0)),
        # Previous-week Sunday end-of-day local: appeal window closes.
        appeal_deadline=_local_to_utc(week_start, -1, time(23, 59, 59)),
        # Roster-week Monday 00:00 local: automatic hard lock as the week begins.
        lock_timestamp=_local_to_utc(week_start, 0, time(0, 0, 0)),
        status=WeeklyCycleStatus.open,
    )
    db.add(cycle)
    db.commit()
    db.refresh(cycle)
    return cycle

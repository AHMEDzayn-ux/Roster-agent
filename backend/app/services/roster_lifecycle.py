"""Weekly-cycle publish/lock timeline (spec §2.2): Friday publish, Saturday
midnight auto-lock. Locking is an automatic hard cutoff driven by
scripts/auto_lock_cycles.py (meant to run on a schedule, e.g. cron/systemd
timer, outside the web process so it doesn't interfere with app/test
lifecycles); POST /api/roster/{id}/lock exists as the spec-mandated
admin-triggerable equivalent for manual use and testing.
"""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.enums import RosterStatus, WeeklyCycleStatus
from app.models.roster import Roster
from app.models.weekly_cycle import WeeklyCycle


class RosterLifecycleError(Exception):
    def __init__(self, detail: str, status_code: int = 400):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


def publish_roster(db: Session, roster_id: int) -> Roster:
    roster = db.query(Roster).filter(Roster.id == roster_id).first()
    if roster is None:
        raise RosterLifecycleError("Roster not found", status_code=404)

    cycle = db.query(WeeklyCycle).filter(WeeklyCycle.id == roster.week_cycle_id).first()
    if cycle.status == WeeklyCycleStatus.locked:
        raise RosterLifecycleError("This weekly cycle is already locked; it cannot be published")
    if roster.status != RosterStatus.draft:
        raise RosterLifecycleError(f"Only a draft roster can be published (current status: {roster.status.value})")

    roster.status = RosterStatus.published
    if cycle.status == WeeklyCycleStatus.open:
        cycle.status = WeeklyCycleStatus.published
    db.commit()
    db.refresh(roster)
    return roster


def lock_roster(db: Session, roster_id: int) -> Roster:
    roster = db.query(Roster).filter(Roster.id == roster_id).first()
    if roster is None:
        raise RosterLifecycleError("Roster not found", status_code=404)
    if roster.status == RosterStatus.locked:
        raise RosterLifecycleError("This roster is already locked")
    if roster.status != RosterStatus.published:
        raise RosterLifecycleError("Only a published roster can be locked; publish it first")

    roster.status = RosterStatus.locked
    cycle = db.query(WeeklyCycle).filter(WeeklyCycle.id == roster.week_cycle_id).first()
    cycle.status = WeeklyCycleStatus.locked
    db.commit()
    db.refresh(roster)
    return roster


def auto_lock_due_cycles(db: Session) -> list[int]:
    """Locks every weekly cycle whose lock_timestamp has passed. Locks the
    cycle's published roster too, if one exists. Returns the ids of cycles
    that were locked by this call."""
    now = datetime.now(timezone.utc)
    due_cycles = (
        db.query(WeeklyCycle)
        .filter(WeeklyCycle.status != WeeklyCycleStatus.locked, WeeklyCycle.lock_timestamp <= now)
        .all()
    )
    locked_ids = []
    for cycle in due_cycles:
        cycle.status = WeeklyCycleStatus.locked
        published_roster = (
            db.query(Roster)
            .filter(Roster.week_cycle_id == cycle.id, Roster.status == RosterStatus.published)
            .first()
        )
        if published_roster is not None:
            published_roster.status = RosterStatus.locked
        locked_ids.append(cycle.id)
    db.commit()
    return locked_ids

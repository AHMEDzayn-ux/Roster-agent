"""Weekly-cycle publish/lock timeline (lead-time schedule): the roster is
published the Friday night (Saturday 00:00) before the roster week and hard-locks
as the week begins (Monday 00:00). Both are automatic, driven by scheduled
scripts outside the web process (auto_publish_cycles.py / auto_lock_cycles.py, run
on a cron/systemd timer so they don't interfere with app/test lifecycles).
Auto-publish only publishes a conflict-free roster; anything with unmet requests
is left as a draft for the manager. POST /api/roster/{id}/publish and
/api/roster/{id}/lock remain the admin-triggerable equivalents for manual use and
testing.
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


def auto_publish_due_cycles(db: Session) -> dict[str, list[int]]:
    """Saturday-00:00 auto-publish (spec: publish Friday night). For every open
    cycle whose publish_date has passed but which isn't locked yet, ensure a draft
    roster exists (generating one if the manager hasn't) and publish it ONLY when
    it has zero conflicts. A roster with any unmet request is left as a draft for
    the manager to review — nothing unreviewed goes out.

    Idempotent: a cycle already published/locked is skipped, and a held draft with
    conflicts is re-checked (not duplicated) on later runs. Returns which cycles
    were published vs. held for review.

    Meant to run on a schedule (cron/systemd) via scripts/auto_publish_cycles.py,
    kept outside the web process like auto_lock_due_cycles."""
    from app.models.roster import ConflictReport
    from app.solver.service import RosterGenerationError, generate_roster

    now = datetime.now(timezone.utc)
    due_cycles = (
        db.query(WeeklyCycle)
        .filter(
            WeeklyCycle.status == WeeklyCycleStatus.open,
            WeeklyCycle.publish_date <= now,
            WeeklyCycle.lock_timestamp > now,
        )
        .all()
    )

    published_ids: list[int] = []
    held_ids: list[int] = []
    for cycle in due_cycles:
        roster = (
            db.query(Roster)
            .filter(Roster.week_cycle_id == cycle.id)
            .order_by(Roster.id.desc())
            .first()
        )
        # Reuse the manager's latest draft if present; otherwise generate one.
        if roster is None:
            try:
                roster = generate_roster(db, cycle.id)
            except RosterGenerationError:
                held_ids.append(cycle.id)
                continue
        elif roster.status != RosterStatus.draft:
            # Already published/locked for this cycle — nothing to do.
            continue

        conflict_count = (
            db.query(ConflictReport).filter(ConflictReport.roster_id == roster.id).count()
        )
        if conflict_count == 0:
            publish_roster(db, roster.id)
            published_ids.append(cycle.id)
        else:
            held_ids.append(cycle.id)

    return {"published": published_ids, "held": held_ids}


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

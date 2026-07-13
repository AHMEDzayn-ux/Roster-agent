from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.crud import roster as crud
from app.db.session import get_db
from app.models.roster import RosterAssignment
from app.schemas.public_roster import PublicAssignmentOut, PublicRosterOut

router = APIRouter(prefix="/api/roster", tags=["public-roster"])


def _build_public_roster(db: Session, roster) -> PublicRosterOut:
    assignments = (
        db.query(RosterAssignment)
        .options(
            joinedload(RosterAssignment.agent),
            joinedload(RosterAssignment.shift),
            joinedload(RosterAssignment.skill_covered),
        )
        .filter(RosterAssignment.roster_id == roster.id)
        .order_by(RosterAssignment.date, RosterAssignment.agent_id)
        .all()
    )
    return PublicRosterOut(
        week_start_date=roster.week_cycle.week_start_date,
        status=roster.status,
        assignments=[
            PublicAssignmentOut(
                agent_name=a.agent.name,
                date=a.date,
                shift_name=a.shift.name,
                shift_start=a.shift.start_time,
                shift_end=a.shift.end_time,
                skill_name=a.skill_covered.name,
            )
            for a in assignments
        ],
    )


@router.get("/current", response_model=PublicRosterOut)
def get_current_roster(db: Session = Depends(get_db)) -> PublicRosterOut:
    roster = crud.get_current_public_roster(db)
    if roster is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No published roster is available yet")
    return _build_public_roster(db, roster)


@router.get("/{week_start_date}", response_model=PublicRosterOut)
def get_roster_for_week(week_start_date: date, db: Session = Depends(get_db)) -> PublicRosterOut:
    roster = crud.get_public_roster_for_week(db, week_start_date)
    if roster is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No published roster is available for that week"
        )
    return _build_public_roster(db, roster)

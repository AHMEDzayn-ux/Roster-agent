from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_manager
from app.crud import roster as crud
from app.db.session import get_db
from app.schemas.roster import (
    ConflictReportOut,
    RosterAssignmentOut,
    RosterGenerateResponse,
    RosterOut,
    SatisfactionMetricOut,
)
from app.services.roster_lifecycle import RosterLifecycleError, lock_roster, publish_roster
from app.solver.service import RosterGenerationError, generate_roster

router = APIRouter(prefix="/api/roster", tags=["roster"], dependencies=[Depends(require_manager)])


@router.post("/generate", response_model=RosterGenerateResponse, status_code=status.HTTP_201_CREATED)
def generate(week_cycle_id: int, db: Session = Depends(get_db)) -> RosterGenerateResponse:
    try:
        roster = generate_roster(db, week_cycle_id)
    except RosterGenerationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)

    return RosterGenerateResponse(
        roster=roster,
        assignments=crud.list_assignments(db, roster.id),
        conflicts=crud.list_conflicts(db, roster.id),
        satisfaction_metrics=crud.list_satisfaction_metrics(db, roster.id),
    )


@router.get("/{roster_id}/detail", response_model=RosterOut)
def get_roster(roster_id: int, db: Session = Depends(get_db)) -> RosterOut:
    roster = crud.get_roster(db, roster_id)
    if roster is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Roster not found")
    return roster


@router.post("/{roster_id}/publish", response_model=RosterOut)
def publish(roster_id: int, db: Session = Depends(get_db)) -> RosterOut:
    try:
        return publish_roster(db, roster_id)
    except RosterLifecycleError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)


@router.post("/{roster_id}/lock", response_model=RosterOut)
def lock(roster_id: int, db: Session = Depends(get_db)) -> RosterOut:
    try:
        return lock_roster(db, roster_id)
    except RosterLifecycleError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)


@router.get("/{roster_id}/assignments", response_model=list[RosterAssignmentOut])
def get_assignments(roster_id: int, db: Session = Depends(get_db)) -> list[RosterAssignmentOut]:
    return crud.list_assignments(db, roster_id)


@router.get("/{roster_id}/conflicts", response_model=list[ConflictReportOut])
def get_conflicts(roster_id: int, db: Session = Depends(get_db)) -> list[ConflictReportOut]:
    return crud.list_conflicts(db, roster_id)


@router.get("/{roster_id}/satisfaction", response_model=list[SatisfactionMetricOut])
def get_satisfaction(roster_id: int, db: Session = Depends(get_db)) -> list[SatisfactionMetricOut]:
    return crud.list_satisfaction_metrics(db, roster_id)

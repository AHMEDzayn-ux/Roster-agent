from io import BytesIO

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import require_manager
from app.crud import roster as crud
from app.db.session import get_db
from app.models.user import User
from app.schemas.roster import (
    ConflictReportOut,
    RosterAssignmentOut,
    RosterGenerateResponse,
    RosterImportResponse,
    RosterOut,
    RosterOverrideRequest,
    SatisfactionMetricOut,
)
from app.services.roster_excel import (
    RosterImportError,
    apply_manual_override,
    export_roster_workbook,
    parse_import_file,
    revalidate_and_apply_import,
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


@router.get("/{roster_id}/export")
def export_roster(roster_id: int, db: Session = Depends(get_db)) -> StreamingResponse:
    roster = crud.get_roster(db, roster_id)
    if roster is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Roster not found")

    workbook = export_roster_workbook(db, roster)
    buffer = BytesIO()
    workbook.save(buffer)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=roster_{roster_id}.xlsx"},
    )


@router.post("/{roster_id}/import", response_model=RosterImportResponse)
async def import_roster(
    roster_id: int,
    file: UploadFile = File(...),
    reason: str | None = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
) -> RosterImportResponse:
    file_bytes = await file.read()
    try:
        rows = parse_import_file(file_bytes)
        result = revalidate_and_apply_import(db, roster_id, rows, reason, current_user.id)
    except RosterImportError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail={"message": exc.detail, "violations": exc.violations}
        )

    return RosterImportResponse(
        roster=result.roster,
        assignments=crud.list_assignments(db, roster_id),
        overridden_requests=result.overridden_requests,
    )


@router.post("/{roster_id}/override", response_model=RosterImportResponse)
def override_assignment(
    roster_id: int,
    payload: RosterOverrideRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
) -> RosterImportResponse:
    try:
        result = apply_manual_override(
            db,
            roster_id,
            agent_id=payload.agent_id,
            target_date=payload.date,
            shift_id=payload.shift_id,
            skill_id=payload.skill_id,
            reason=payload.reason,
            actor_id=current_user.id,
        )
    except RosterImportError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail={"message": exc.detail, "violations": exc.violations}
        )

    return RosterImportResponse(
        roster=result.roster,
        assignments=crud.list_assignments(db, roster_id),
        overridden_requests=result.overridden_requests,
    )


@router.get("/{roster_id}/assignments", response_model=list[RosterAssignmentOut])
def get_assignments(roster_id: int, db: Session = Depends(get_db)) -> list[RosterAssignmentOut]:
    return crud.list_assignments(db, roster_id)


@router.get("/{roster_id}/conflicts", response_model=list[ConflictReportOut])
def get_conflicts(roster_id: int, db: Session = Depends(get_db)) -> list[ConflictReportOut]:
    return crud.list_conflicts(db, roster_id)


@router.get("/{roster_id}/satisfaction", response_model=list[SatisfactionMetricOut])
def get_satisfaction(roster_id: int, db: Session = Depends(get_db)) -> list[SatisfactionMetricOut]:
    return crud.list_satisfaction_metrics(db, roster_id)

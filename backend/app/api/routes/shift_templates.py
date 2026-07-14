from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_manager
from app.api.errors import delete_or_conflict
from app.crud import shift as crud
from app.db.session import get_db
from app.schemas.shift import ShiftTemplateCreate, ShiftTemplateOut, ShiftTemplateUpdate

router = APIRouter(prefix="/api/shift-templates", tags=["shift-templates"])


# Readable by any authenticated user — agents need the shift list to file a
# shift-change request; only writes are manager-only.
@router.get("", response_model=list[ShiftTemplateOut], dependencies=[Depends(get_current_user)])
def list_shift_templates(db: Session = Depends(get_db)) -> list[ShiftTemplateOut]:
    return crud.list_shift_templates(db)


@router.post(
    "", response_model=ShiftTemplateOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_manager)]
)
def create_shift_template(payload: ShiftTemplateCreate, db: Session = Depends(get_db)) -> ShiftTemplateOut:
    return crud.create_shift_template(db, payload)


@router.patch("/{shift_id}", response_model=ShiftTemplateOut, dependencies=[Depends(require_manager)])
def update_shift_template(
    shift_id: int, payload: ShiftTemplateUpdate, db: Session = Depends(get_db)
) -> ShiftTemplateOut:
    shift = crud.get_shift_template(db, shift_id)
    if shift is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shift template not found")
    return crud.update_shift_template(db, shift, payload)


@router.delete("/{shift_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_manager)])
def delete_shift_template(shift_id: int, db: Session = Depends(get_db)) -> None:
    shift = crud.get_shift_template(db, shift_id)
    if shift is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shift template not found")
    delete_or_conflict(db, crud.delete_shift_template, shift, entity_name="shift template")

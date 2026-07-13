from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_manager
from app.crud import coverage as crud
from app.db.session import get_db
from app.schemas.coverage import CoverageRequirementCreate, CoverageRequirementOut, CoverageRequirementUpdate

router = APIRouter(
    prefix="/api/coverage-requirements", tags=["coverage-requirements"], dependencies=[Depends(require_manager)]
)


@router.get("", response_model=list[CoverageRequirementOut])
def list_coverage_requirements(db: Session = Depends(get_db)) -> list[CoverageRequirementOut]:
    return crud.list_coverage_requirements(db)


@router.post("", response_model=CoverageRequirementOut, status_code=status.HTTP_201_CREATED)
def create_coverage_requirement(
    payload: CoverageRequirementCreate, db: Session = Depends(get_db)
) -> CoverageRequirementOut:
    return crud.create_coverage_requirement(db, payload)


@router.patch("/{requirement_id}", response_model=CoverageRequirementOut)
def update_coverage_requirement(
    requirement_id: int, payload: CoverageRequirementUpdate, db: Session = Depends(get_db)
) -> CoverageRequirementOut:
    requirement = crud.get_coverage_requirement(db, requirement_id)
    if requirement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coverage requirement not found")
    return crud.update_coverage_requirement(db, requirement, payload)


@router.delete("/{requirement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_coverage_requirement(requirement_id: int, db: Session = Depends(get_db)) -> None:
    requirement = crud.get_coverage_requirement(db, requirement_id)
    if requirement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coverage requirement not found")
    crud.delete_coverage_requirement(db, requirement)

from sqlalchemy.orm import Session

from app.models.coverage import CoverageRequirement
from app.schemas.coverage import CoverageRequirementCreate, CoverageRequirementUpdate


def list_coverage_requirements(db: Session) -> list[CoverageRequirement]:
    return db.query(CoverageRequirement).order_by(
        CoverageRequirement.day_of_week, CoverageRequirement.time_slot_start
    ).all()


def get_coverage_requirement(db: Session, requirement_id: int) -> CoverageRequirement | None:
    return db.query(CoverageRequirement).filter(CoverageRequirement.id == requirement_id).first()


def create_coverage_requirement(db: Session, req_in: CoverageRequirementCreate) -> CoverageRequirement:
    requirement = CoverageRequirement(**req_in.model_dump())
    db.add(requirement)
    db.commit()
    db.refresh(requirement)
    return requirement


def update_coverage_requirement(
    db: Session, requirement: CoverageRequirement, req_in: CoverageRequirementUpdate
) -> CoverageRequirement:
    for field, value in req_in.model_dump(exclude_unset=True).items():
        setattr(requirement, field, value)
    db.commit()
    db.refresh(requirement)
    return requirement


def delete_coverage_requirement(db: Session, requirement: CoverageRequirement) -> None:
    db.delete(requirement)
    db.commit()

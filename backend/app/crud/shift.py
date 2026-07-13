from sqlalchemy.orm import Session

from app.models.shift import ShiftTemplate
from app.schemas.shift import ShiftTemplateCreate, ShiftTemplateUpdate


def list_shift_templates(db: Session) -> list[ShiftTemplate]:
    return db.query(ShiftTemplate).order_by(ShiftTemplate.start_time).all()


def get_shift_template(db: Session, shift_id: int) -> ShiftTemplate | None:
    return db.query(ShiftTemplate).filter(ShiftTemplate.id == shift_id).first()


def create_shift_template(db: Session, shift_in: ShiftTemplateCreate) -> ShiftTemplate:
    shift = ShiftTemplate(**shift_in.model_dump())
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return shift


def update_shift_template(db: Session, shift: ShiftTemplate, shift_in: ShiftTemplateUpdate) -> ShiftTemplate:
    for field, value in shift_in.model_dump(exclude_unset=True).items():
        setattr(shift, field, value)
    db.commit()
    db.refresh(shift)
    return shift


def delete_shift_template(db: Session, shift: ShiftTemplate) -> None:
    db.delete(shift)
    db.commit()

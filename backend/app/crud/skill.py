from sqlalchemy.orm import Session

from app.models.skill import Skill
from app.schemas.skill import SkillCreate, SkillUpdate


def list_skills(db: Session) -> list[Skill]:
    return db.query(Skill).order_by(Skill.name).all()


def get_skill(db: Session, skill_id: int) -> Skill | None:
    return db.query(Skill).filter(Skill.id == skill_id).first()


def create_skill(db: Session, skill_in: SkillCreate) -> Skill:
    skill = Skill(name=skill_in.name, description=skill_in.description)
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return skill


def update_skill(db: Session, skill: Skill, skill_in: SkillUpdate) -> Skill:
    for field, value in skill_in.model_dump(exclude_unset=True).items():
        setattr(skill, field, value)
    db.commit()
    db.refresh(skill)
    return skill


def delete_skill(db: Session, skill: Skill) -> None:
    db.delete(skill)
    db.commit()

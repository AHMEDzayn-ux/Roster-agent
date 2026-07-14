from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_manager
from app.api.errors import delete_or_conflict
from app.crud import skill as crud
from app.db.session import get_db
from app.schemas.skill import SkillCreate, SkillOut, SkillUpdate

router = APIRouter(prefix="/api/skills", tags=["skills"], dependencies=[Depends(require_manager)])


@router.get("", response_model=list[SkillOut])
def list_skills(db: Session = Depends(get_db)) -> list[SkillOut]:
    return crud.list_skills(db)


@router.post("", response_model=SkillOut, status_code=status.HTTP_201_CREATED)
def create_skill(payload: SkillCreate, db: Session = Depends(get_db)) -> SkillOut:
    return crud.create_skill(db, payload)


@router.patch("/{skill_id}", response_model=SkillOut)
def update_skill(skill_id: int, payload: SkillUpdate, db: Session = Depends(get_db)) -> SkillOut:
    skill = crud.get_skill(db, skill_id)
    if skill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")
    return crud.update_skill(db, skill, payload)


@router.delete("/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_skill(skill_id: int, db: Session = Depends(get_db)) -> None:
    skill = crud.get_skill(db, skill_id)
    if skill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")
    delete_or_conflict(db, crud.delete_skill, skill, entity_name="skill")

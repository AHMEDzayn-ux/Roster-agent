from pydantic import BaseModel


class SkillCreate(BaseModel):
    name: str
    description: str | None = None


class SkillUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class SkillOut(BaseModel):
    id: int
    name: str
    description: str | None

    model_config = {"from_attributes": True}

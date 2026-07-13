from pydantic import BaseModel, EmailStr

from app.models.enums import UserRole


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: UserRole
    agent_id: int | None = None


class UserOut(BaseModel):
    id: int
    email: EmailStr
    role: UserRole
    agent_id: int | None
    active: bool

    model_config = {"from_attributes": True}

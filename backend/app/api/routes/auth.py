from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_manager
from app.core.security import create_access_token, verify_password
from app.crud.user import create_user, get_user_by_email
from app.db.session import get_db
from app.models.agent import Agent
from app.models.user import User
from app.schemas.auth import LoginRequest, MeOut, TokenResponse, UserCreate, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me", response_model=MeOut)
def get_me(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> MeOut:
    agent_name = None
    if current_user.agent_id is not None:
        agent = db.query(Agent).filter(Agent.id == current_user.agent_id).first()
        agent_name = agent.name if agent else None
    return MeOut(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role,
        agent_id=current_user.agent_id,
        agent_name=agent_name,
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = get_user_by_email(db, payload.email)
    if user is None or not user.active or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    token = create_access_token(subject=str(user.id), role=user.role.value, agent_id=user.agent_id)
    return TokenResponse(access_token=token)


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user_account(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _manager=Depends(require_manager),
) -> UserOut:
    if get_user_by_email(db, payload.email) is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    user = create_user(db, payload)
    return UserOut.model_validate(user)

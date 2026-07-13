from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_manager
from app.crud import agent as crud
from app.db.session import get_db
from app.models.agent import Agent
from app.schemas.agent import AgentCreate, AgentOut, AgentUpdate

router = APIRouter(prefix="/api/agents", tags=["agents"], dependencies=[Depends(require_manager)])


def _to_out(agent: Agent) -> AgentOut:
    return AgentOut(
        id=agent.id,
        name=agent.name,
        contact_info=agent.contact_info,
        default_shift_id=agent.default_shift_id,
        active=agent.active,
        default_off_day_type=agent.default_off_day_type,
        default_off_day=agent.default_off_day,
        default_off_days_per_week=agent.default_off_days_per_week,
        skill_ids=[link.skill_id for link in agent.skill_links],
    )


@router.get("", response_model=list[AgentOut])
def list_agents(db: Session = Depends(get_db)) -> list[AgentOut]:
    return [_to_out(a) for a in crud.list_agents(db)]


@router.post("", response_model=AgentOut, status_code=status.HTTP_201_CREATED)
def create_agent(payload: AgentCreate, db: Session = Depends(get_db)) -> AgentOut:
    agent = crud.create_agent(db, payload)
    return _to_out(agent)


@router.patch("/{agent_id}", response_model=AgentOut)
def update_agent(agent_id: int, payload: AgentUpdate, db: Session = Depends(get_db)) -> AgentOut:
    agent = crud.get_agent(db, agent_id)
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    agent = crud.update_agent(db, agent, payload)
    return _to_out(agent)


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent(agent_id: int, db: Session = Depends(get_db)) -> None:
    agent = crud.get_agent(db, agent_id)
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    crud.delete_agent(db, agent)

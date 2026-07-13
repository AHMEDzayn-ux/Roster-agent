from sqlalchemy.orm import Session, joinedload

from app.models.agent import Agent, AgentSkill
from app.schemas.agent import AgentCreate, AgentUpdate


def list_agents(db: Session) -> list[Agent]:
    return db.query(Agent).options(joinedload(Agent.skill_links)).order_by(Agent.name).all()


def get_agent(db: Session, agent_id: int) -> Agent | None:
    return db.query(Agent).options(joinedload(Agent.skill_links)).filter(Agent.id == agent_id).first()


def _sync_skills(db: Session, agent: Agent, skill_ids: list[int]) -> None:
    db.query(AgentSkill).filter(AgentSkill.agent_id == agent.id).delete()
    for skill_id in set(skill_ids):
        db.add(AgentSkill(agent_id=agent.id, skill_id=skill_id))


def create_agent(db: Session, agent_in: AgentCreate) -> Agent:
    data = agent_in.model_dump(exclude={"skill_ids"})
    agent = Agent(**data)
    db.add(agent)
    db.flush()
    _sync_skills(db, agent, agent_in.skill_ids)
    db.commit()
    db.refresh(agent)
    return agent


def update_agent(db: Session, agent: Agent, agent_in: AgentUpdate) -> Agent:
    update_data = agent_in.model_dump(exclude_unset=True, exclude={"skill_ids"})
    for field, value in update_data.items():
        setattr(agent, field, value)
    if agent_in.skill_ids is not None:
        _sync_skills(db, agent, agent_in.skill_ids)
    db.commit()
    db.refresh(agent)
    return agent


def delete_agent(db: Session, agent: Agent) -> None:
    db.delete(agent)
    db.commit()

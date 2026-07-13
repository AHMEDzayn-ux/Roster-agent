import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.enums import UserRole
from app.models.user import User

engine = create_engine(settings.test_database_url)
Base.metadata.create_all(engine)


@pytest.fixture()
def db_session():
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def manager_user(db_session):
    user = User(
        email="manager@callroster-demo.com",
        hashed_password=hash_password("managerpass123"),
        role=UserRole.manager,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def agent_user(db_session):
    user = User(
        email="agent@callroster-demo.com",
        hashed_password=hash_password("agentpass123"),
        role=UserRole.agent,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def manager_token(manager_user):
    return create_access_token(subject=str(manager_user.id), role=manager_user.role.value, agent_id=None)


@pytest.fixture()
def agent_token(agent_user):
    return create_access_token(subject=str(agent_user.id), role=agent_user.role.value, agent_id=None)


@pytest.fixture()
def manager_headers(manager_token):
    return {"Authorization": f"Bearer {manager_token}"}


@pytest.fixture()
def agent_headers(agent_token):
    return {"Authorization": f"Bearer {agent_token}"}

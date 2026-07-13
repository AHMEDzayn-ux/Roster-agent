from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Import all models here so Alembic's autogenerate can discover them
# via Base.metadata. Individual modules are imported for side effects only.
from app.models import (  # noqa: E402,F401
    agent,
    appeal,
    audit,
    coverage,
    leave_balance,
    roster,
    shift,
    skill,
    user,
    weekly_cycle,
    weekly_request,
)

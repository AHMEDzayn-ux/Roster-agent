"""drop unused default_off_day_weight from solver_weights

A fixed agent off-day is enforced as a HARD constraint in the solver, and a
flexible agent has no preferred off-day, so this soft weight had no meaning and
was never read by the objective. Removing the misleading knob.

Revision ID: e3a5b7c9d1f2
Revises: d2f4a6c8e1b7
Create Date: 2026-07-15

"""
from alembic import op
import sqlalchemy as sa

revision = "e3a5b7c9d1f2"
down_revision = "d2f4a6c8e1b7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("solver_weights", "default_off_day_weight")


def downgrade() -> None:
    op.add_column(
        "solver_weights",
        sa.Column("default_off_day_weight", sa.Numeric(6, 2), nullable=False, server_default="40"),
    )

"""add max_agents to shift_templates

Revision ID: d2f4a6c8e1b7
Revises: c1b3e5f9a2d4
Create Date: 2026-07-15

"""
from alembic import op
import sqlalchemy as sa

revision = "d2f4a6c8e1b7"
down_revision = "c1b3e5f9a2d4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("shift_templates", sa.Column("max_agents", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("shift_templates", "max_agents")

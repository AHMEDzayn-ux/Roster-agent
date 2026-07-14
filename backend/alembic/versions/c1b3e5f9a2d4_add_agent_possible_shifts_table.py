"""add agent_possible_shifts table

Revision ID: c1b3e5f9a2d4
Revises: 9ad49dd9f32d
Create Date: 2026-07-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1b3e5f9a2d4'
down_revision: Union[str, None] = '9ad49dd9f32d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'agent_possible_shifts',
        sa.Column('agent_id', sa.Integer(), nullable=False),
        sa.Column('shift_template_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['agent_id'], ['agents.id']),
        sa.ForeignKeyConstraint(['shift_template_id'], ['shift_templates.id']),
        sa.PrimaryKeyConstraint('agent_id', 'shift_template_id'),
    )


def downgrade() -> None:
    op.drop_table('agent_possible_shifts')

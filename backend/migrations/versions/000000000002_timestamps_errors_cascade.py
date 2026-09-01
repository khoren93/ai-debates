"""Timezone-aware timestamps, error columns, cascading deletes

Revision ID: 000000000002
Revises: 000000000001
Create Date: 2026-09-01 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '000000000002'
down_revision: Union[str, None] = '000000000001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TIMESTAMP_COLUMNS = [
    ("sessions", "created_at"),
    ("sessions", "last_seen_at"),
    ("debates", "created_at"),
    ("debates", "started_at"),
    ("debates", "ended_at"),
    ("turns", "created_at"),
]


def upgrade() -> None:
    # Existing rows were written as naive UTC; reinterpret them as UTC.
    for table, column in _TIMESTAMP_COLUMNS:
        op.execute(
            f"ALTER TABLE {table} ALTER COLUMN {column} "
            f"TYPE TIMESTAMP WITH TIME ZONE USING {column} AT TIME ZONE 'UTC'"
        )

    op.add_column('debates', sa.Column('error_message', sa.Text(), nullable=True))
    op.add_column('turns', sa.Column('error', sa.Text(), nullable=True))

    op.drop_constraint('turns_debate_id_fkey', 'turns', type_='foreignkey')
    op.create_foreign_key(
        'turns_debate_id_fkey', 'turns', 'debates', ['debate_id'], ['id'], ondelete='CASCADE'
    )
    op.drop_constraint(
        'debate_participants_debate_id_fkey', 'debate_participants', type_='foreignkey'
    )
    op.create_foreign_key(
        'debate_participants_debate_id_fkey',
        'debate_participants',
        'debates',
        ['debate_id'],
        ['id'],
        ondelete='CASCADE',
    )


def downgrade() -> None:
    op.drop_constraint(
        'debate_participants_debate_id_fkey', 'debate_participants', type_='foreignkey'
    )
    op.create_foreign_key(
        'debate_participants_debate_id_fkey',
        'debate_participants',
        'debates',
        ['debate_id'],
        ['id'],
    )
    op.drop_constraint('turns_debate_id_fkey', 'turns', type_='foreignkey')
    op.create_foreign_key('turns_debate_id_fkey', 'turns', 'debates', ['debate_id'], ['id'])

    op.drop_column('turns', 'error')
    op.drop_column('debates', 'error_message')

    for table, column in _TIMESTAMP_COLUMNS:
        op.execute(
            f"ALTER TABLE {table} ALTER COLUMN {column} "
            f"TYPE TIMESTAMP WITHOUT TIME ZONE USING {column} AT TIME ZONE 'UTC'"
        )

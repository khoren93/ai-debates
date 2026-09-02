"""Media pipeline: media_status / media_json on debates

Revision ID: 000000000003
Revises: 000000000002
Create Date: 2026-09-03 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '000000000003'
down_revision: Union[str, None] = '000000000002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'debates',
        sa.Column('media_status', sa.String(), nullable=False, server_default='none'),
    )
    op.add_column(
        'debates',
        sa.Column('media_json', sa.JSON(), nullable=False, server_default='{}'),
    )
    op.create_index('ix_debates_media_status', 'debates', ['media_status'])


def downgrade() -> None:
    op.drop_index('ix_debates_media_status', table_name='debates')
    op.drop_column('debates', 'media_json')
    op.drop_column('debates', 'media_status')

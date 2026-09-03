"""Accounts, credit ledger, public gallery and structured verdicts

Revision ID: 000000000004
Revises: 000000000003
Create Date: 2026-09-03 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '000000000004'
down_revision: Union[str, None] = '000000000003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(length=320), nullable=False),
        sa.Column('password_hash', sa.String(length=200), nullable=False),
        sa.Column('display_name', sa.String(length=100), nullable=False),
        sa.Column('avatar_seed', sa.String(length=64), nullable=False, server_default=''),
        sa.Column('plan', sa.String(length=32), nullable=False, server_default='free'),
        sa.Column('credits_usd', sa.Numeric(14, 6), nullable=False, server_default='0'),
        sa.Column('openrouter_key_enc', sa.Text(), nullable=True),
        sa.Column('openrouter_key_last4', sa.String(length=8), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=True)

    op.add_column('debates', sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        'debates_user_id_fkey', 'debates', 'users', ['user_id'], ['id'], ondelete='SET NULL'
    )
    op.create_index('ix_debates_user_id', 'debates', ['user_id'])
    op.add_column(
        'debates', sa.Column('verdict_json', sa.JSON(), nullable=False, server_default='{}')
    )
    op.add_column(
        'debates', sa.Column('is_public', sa.Boolean(), nullable=False, server_default='false')
    )
    op.create_index('ix_debates_is_public', 'debates', ['is_public'])
    op.add_column('debates', sa.Column('slug', sa.String(length=32), nullable=True))
    op.create_unique_constraint('uq_debates_slug', 'debates', ['slug'])
    op.add_column('debates', sa.Column('category', sa.String(length=40), nullable=True))
    op.add_column('debates', sa.Column('views', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('debates', sa.Column('published_at', sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        'credit_transactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('amount_usd', sa.Numeric(14, 6), nullable=False),
        sa.Column('balance_after_usd', sa.Numeric(14, 6), nullable=False),
        sa.Column('kind', sa.String(length=32), nullable=False),
        sa.Column('description', sa.String(length=300), nullable=True),
        sa.Column('debate_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('provider', sa.String(length=32), nullable=True),
        sa.Column('provider_ref', sa.String(length=200), nullable=True),
        sa.Column('meta_json', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['debate_id'], ['debates.id'], ondelete='SET NULL'),
        sa.UniqueConstraint('provider_ref', name='uq_credit_transactions_provider_ref'),
    )
    op.create_index('ix_credit_transactions_user_id', 'credit_transactions', ['user_id'])
    op.create_index('ix_credit_transactions_debate_id', 'credit_transactions', ['debate_id'])
    op.create_index('ix_credit_transactions_kind', 'credit_transactions', ['kind'])
    op.create_index('ix_credit_transactions_created_at', 'credit_transactions', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_credit_transactions_created_at', table_name='credit_transactions')
    op.drop_index('ix_credit_transactions_kind', table_name='credit_transactions')
    op.drop_index('ix_credit_transactions_debate_id', table_name='credit_transactions')
    op.drop_index('ix_credit_transactions_user_id', table_name='credit_transactions')
    op.drop_table('credit_transactions')

    op.drop_column('debates', 'published_at')
    op.drop_column('debates', 'views')
    op.drop_column('debates', 'category')
    op.drop_constraint('uq_debates_slug', 'debates', type_='unique')
    op.drop_column('debates', 'slug')
    op.drop_index('ix_debates_is_public', table_name='debates')
    op.drop_column('debates', 'is_public')
    op.drop_column('debates', 'verdict_json')
    op.drop_index('ix_debates_user_id', table_name='debates')
    op.drop_constraint('debates_user_id_fkey', 'debates', type_='foreignkey')
    op.drop_column('debates', 'user_id')

    op.drop_index('ix_users_email', table_name='users')
    op.drop_table('users')

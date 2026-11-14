"""add tags JSON column to stays table

Revision ID: 202605240001
Revises: 202605210002
Create Date: 2026-05-24 00:10:00
"""

from alembic import op
import sqlalchemy as sa


revision = "202605240001"
down_revision = "202605210002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("stays", sa.Column("tags", sa.JSON(), nullable=True, server_default="[]"))


def downgrade() -> None:
    op.drop_column("stays", "tags")

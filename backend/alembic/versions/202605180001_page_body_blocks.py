"""add page body blocks

Revision ID: 202605180001
Revises: 202605160001
Create Date: 2026-05-18
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "202605180001"
down_revision: Union[str, None] = "202605160001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("pages", sa.Column("body_blocks", sa.JSON(), nullable=False, server_default="[]"))


def downgrade() -> None:
    op.drop_column("pages", "body_blocks")

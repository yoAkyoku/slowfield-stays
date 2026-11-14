"""content translations

Revision ID: 202605300001
Revises: 202605260001
Create Date: 2026-05-30
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "202605300001"
down_revision: Union[str, None] = "202605260001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("pages", sa.Column("translations", sa.JSON(), nullable=False, server_default="{}"))
    op.add_column("stays", sa.Column("translations", sa.JSON(), nullable=False, server_default="{}"))
    op.add_column("banners", sa.Column("translations", sa.JSON(), nullable=False, server_default="{}"))


def downgrade() -> None:
    op.drop_column("banners", "translations")
    op.drop_column("stays", "translations")
    op.drop_column("pages", "translations")

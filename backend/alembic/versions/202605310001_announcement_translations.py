"""announcement translations

Revision ID: 202605310001
Revises: 202605300001
Create Date: 2026-05-31
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "202605310001"
down_revision: Union[str, None] = "202605300001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("announcements", sa.Column("translations", sa.JSON(), nullable=False, server_default="{}"))


def downgrade() -> None:
    op.drop_column("announcements", "translations")

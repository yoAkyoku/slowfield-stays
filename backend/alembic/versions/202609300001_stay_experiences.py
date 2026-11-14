"""add stays.experiences

慢域體驗 is a managed search facet. Each stay stores the canonical values it
offers, separately from editorial tags and from physical facilities.

Revision ID: 202609300001
Revises: 202608300004
Create Date: 2026-09-30
"""

from alembic import op
import sqlalchemy as sa


revision = "202609300001"
down_revision = "202608300004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "stays",
        sa.Column("experiences", sa.JSON(), nullable=False, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("stays", "experiences")

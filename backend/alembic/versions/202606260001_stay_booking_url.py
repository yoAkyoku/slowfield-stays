"""add stays.booking_url

The homepage 精選住宿 (featured stays) cards have a 立即訂房 button that should jump to each
villa's real booking page (網站修改.pptx slide 1). Store that URL per stay.

Revision ID: 202606260001
Revises: 202606200001
Create Date: 2026-06-26
"""

from alembic import op
import sqlalchemy as sa


revision = "202606260001"
down_revision = "202606200001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "stays",
        sa.Column("booking_url", sa.String(length=500), nullable=False, server_default=""),
    )
    # Drop the server default now that existing rows are backfilled with "".
    op.alter_column("stays", "booking_url", server_default=None)


def downgrade() -> None:
    op.drop_column("stays", "booking_url")

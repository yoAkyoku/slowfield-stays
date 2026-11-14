"""store generated poster images for uploaded videos

Revision ID: 202610030002
Revises: 202610030001
Create Date: 2026-10-03
"""

from alembic import op
import sqlalchemy as sa


revision = "202610030002"
down_revision = "202610030001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "media_assets",
        sa.Column("poster_url", sa.String(500), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_column("media_assets", "poster_url")

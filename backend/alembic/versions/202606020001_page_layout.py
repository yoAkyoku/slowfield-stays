"""add layout column to pages

Revision ID: 202606020001
Revises: 202605310001
Create Date: 2026-06-02 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "202606020001"
down_revision = "202605310001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pages",
        sa.Column("layout", sa.String(length=40), nullable=False, server_default="page"),
    )


def downgrade() -> None:
    op.drop_column("pages", "layout")

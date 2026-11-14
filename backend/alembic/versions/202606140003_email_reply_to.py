"""add email_settings.reply_to for routing replies to multiple managers

Revision ID: 202606140003
Revises: 202606140002
Create Date: 2026-06-14
"""

from alembic import op
import sqlalchemy as sa


revision = "202606140003"
down_revision = "202606140002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "email_settings",
        sa.Column("reply_to", sa.String(500), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_column("email_settings", "reply_to")

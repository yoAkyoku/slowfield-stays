"""add email_settings.daily_cap for per-site send throttling

Revision ID: 202606140002
Revises: 202606140001
Create Date: 2026-06-14
"""

from alembic import op
import sqlalchemy as sa


revision = "202606140002"
down_revision = "202606140001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 100 = Resend free-tier default. 0 means "no cap".
    op.add_column(
        "email_settings",
        sa.Column("daily_cap", sa.Integer(), nullable=False, server_default="100"),
    )


def downgrade() -> None:
    op.drop_column("email_settings", "daily_cap")

"""add newsletter_campaigns.scheduled_at for delayed dispatch

Revision ID: 202606140001
Revises: 202606130001
Create Date: 2026-06-14
"""

from alembic import op
import sqlalchemy as sa


revision = "202606140001"
down_revision = "202606130001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "newsletter_campaigns",
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_newsletter_campaigns_scheduled_at",
        "newsletter_campaigns",
        ["scheduled_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_newsletter_campaigns_scheduled_at", table_name="newsletter_campaigns")
    op.drop_column("newsletter_campaigns", "scheduled_at")

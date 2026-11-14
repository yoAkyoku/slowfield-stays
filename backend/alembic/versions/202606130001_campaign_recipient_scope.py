"""add newsletter_campaigns.recipient_scope for parent->children fan-out

Revision ID: 202606130001
Revises: 202606090001
Create Date: 2026-06-13
"""

from alembic import op
import sqlalchemy as sa


revision = "202606130001"
down_revision = "202606090001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "newsletter_campaigns",
        sa.Column("recipient_scope", sa.String(20), nullable=False, server_default="self"),
    )


def downgrade() -> None:
    op.drop_column("newsletter_campaigns", "recipient_scope")

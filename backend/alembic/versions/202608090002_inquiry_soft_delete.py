"""add inquiries.deleted_at

The inbox had no way to remove anything — a spam or test enquiry could only be
marked closed, so it stayed in the list forever. Soft delete, the same pattern
stays / pages / banners / subscribers already use: the row survives, the list
hides it, and a mistake is recoverable.

Revision ID: 202608090002
Revises: 202608090001
Create Date: 2026-08-09
"""

from alembic import op
import sqlalchemy as sa


revision = "202608090002"
down_revision = "202608090001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "inquiries",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("inquiries", "deleted_at")

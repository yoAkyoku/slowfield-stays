"""add booking_requests.deleted_at

The inquiry inbox has had soft delete since 202608090002; the booking inbox
never got it, and had no delete route of any kind. Spam and test bookings
therefore could not be removed from the list at all — the only way out was
psql. Mirrors the inquiry column exactly so the two inboxes behave alike.

Revision ID: 202608150001
Revises: 202608100001
Create Date: 2026-08-15
"""

from alembic import op
import sqlalchemy as sa


revision = "202608150001"
down_revision = "202608100001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "booking_requests",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("booking_requests", "deleted_at")

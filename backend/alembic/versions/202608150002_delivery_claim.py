"""add newsletter_deliveries.claimed_at

process_newsletter_queue() selected every `pending` delivery, sent them all, and
only wrote their status at the very end. Three callers can run it at once — the
60-second scheduler tick, the admin "process now" button, and the per-campaign
process route — so two overlapping runs read the same rows and both sent them.
Real subscribers received the same newsletter twice, and the window was the
whole batch of SMTP round trips.

Rows are now claimed (`status='sending'`) and committed before the first send.
This column records when, so a run can tell a claim abandoned by a crashed
process from one that is genuinely still in flight.

Revision ID: 202608150002
Revises: 202608150001
Create Date: 2026-08-15
"""

from alembic import op
import sqlalchemy as sa


revision = "202608150002"
down_revision = "202608150001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "newsletter_deliveries",
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("newsletter_deliveries", "claimed_at")

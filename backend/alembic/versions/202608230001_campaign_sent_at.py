"""add newsletter_campaigns.sent_at

process_newsletter_queue() has always done `campaign.sent_at = datetime.now(UTC)`
when a campaign's queue drains — but there was no such column. SQLAlchemy lets
you set any attribute on a mapped instance, so the assignment quietly created a
transient Python attribute and the value was discarded at commit.

The admin's 電子報列表 has a 發送時間 column for exactly this value, so it showed
"—" for every campaign ever sent, including ones sent months earlier. Nothing
failed; the answer was simply never stored.

Nullable and additive: existing rows keep "—" because that send genuinely was
not recorded, and every send from here on fills in.

Revision ID: 202608230001
Revises: 202608150002
Create Date: 2026-08-23
"""

from alembic import op
import sqlalchemy as sa


revision = "202608230001"
down_revision = "202608150002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "newsletter_campaigns",
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("newsletter_campaigns", "sent_at")

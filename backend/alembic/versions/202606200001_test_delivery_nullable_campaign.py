"""make newsletter_deliveries.campaign_id nullable

Test sends (from the Email Settings test button) are real emails that count
against the provider's daily quota, so we record them as deliveries with no
campaign. That requires campaign_id to be nullable.

Revision ID: 202606200001
Revises: 202606140003
Create Date: 2026-06-20
"""

from alembic import op
import sqlalchemy as sa


revision = "202606200001"
down_revision = "202606140003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "newsletter_deliveries",
        "campaign_id",
        existing_type=sa.Integer(),
        nullable=True,
    )


def downgrade() -> None:
    # Test sends are stored with campaign_id=NULL, so on any database where the
    # Email Settings test button has been used, re-adding NOT NULL aborts. The
    # only way to satisfy the constraint is to delete those rows, and they are
    # the record of real mail that went out through the provider: count_sent_today
    # counts them, so deleting them silently hands the site back allowance it has
    # already spent against daily_cap.
    #
    # So this refuses instead of deleting — the call belongs to the operator, made
    # deliberately, not discovered as a side effect halfway through a rollback.
    # The check runs first so nothing is altered before the refusal, and so the
    # downgrade still works once the operator has dealt with the rows.
    orphans = op.get_bind().execute(
        sa.text("SELECT count(*) FROM newsletter_deliveries WHERE campaign_id IS NULL")
    ).scalar_one()
    if orphans:
        raise NotImplementedError(
            f"Cannot downgrade 202606200001: {orphans} newsletter_deliveries row(s) "
            "record test sends with campaign_id=NULL, and NOT NULL cannot be "
            "restored while they exist. Decide what happens to them first — "
            "DELETE FROM newsletter_deliveries WHERE campaign_id IS NULL, "
            "accepting that today's count against the email daily cap drops with "
            "them — then re-run this downgrade."
        )
    op.alter_column(
        "newsletter_deliveries",
        "campaign_id",
        existing_type=sa.Integer(),
        nullable=False,
    )

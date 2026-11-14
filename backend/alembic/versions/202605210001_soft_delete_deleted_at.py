"""Add deleted_at soft delete columns.

Revision ID: 202605210001
Revises: 202605180001
Create Date: 2026-05-21 00:01:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "202605210001"
down_revision: str | None = "202605180001"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("stays", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_stays_deleted_at", "stays", ["deleted_at"], unique=False)
    op.create_index("ix_stays_site_deleted_at", "stays", ["site_id", "deleted_at"], unique=False)

    op.add_column("pages", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_pages_deleted_at", "pages", ["deleted_at"], unique=False)
    op.create_index("ix_pages_site_deleted_at", "pages", ["site_id", "deleted_at"], unique=False)

    op.add_column("banners", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_banners_deleted_at", "banners", ["deleted_at"], unique=False)
    op.create_index("ix_banners_site_deleted_at", "banners", ["site_id", "deleted_at"], unique=False)

    op.add_column("newsletter_subscribers", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_newsletter_subscribers_deleted_at", "newsletter_subscribers", ["deleted_at"], unique=False)
    op.create_index(
        "ix_newsletter_subscribers_site_deleted_at",
        "newsletter_subscribers",
        ["site_id", "deleted_at"],
        unique=False,
    )

    op.add_column("newsletter_campaigns", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_newsletter_campaigns_deleted_at", "newsletter_campaigns", ["deleted_at"], unique=False)
    op.create_index(
        "ix_newsletter_campaigns_site_deleted_at",
        "newsletter_campaigns",
        ["site_id", "deleted_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_newsletter_campaigns_site_deleted_at", table_name="newsletter_campaigns")
    op.drop_index("ix_newsletter_campaigns_deleted_at", table_name="newsletter_campaigns")
    op.drop_column("newsletter_campaigns", "deleted_at")

    op.drop_index("ix_newsletter_subscribers_site_deleted_at", table_name="newsletter_subscribers")
    op.drop_index("ix_newsletter_subscribers_deleted_at", table_name="newsletter_subscribers")
    op.drop_column("newsletter_subscribers", "deleted_at")

    op.drop_index("ix_banners_site_deleted_at", table_name="banners")
    op.drop_index("ix_banners_deleted_at", table_name="banners")
    op.drop_column("banners", "deleted_at")

    op.drop_index("ix_pages_site_deleted_at", table_name="pages")
    op.drop_index("ix_pages_deleted_at", table_name="pages")
    op.drop_column("pages", "deleted_at")

    op.drop_index("ix_stays_site_deleted_at", table_name="stays")
    op.drop_index("ix_stays_deleted_at", table_name="stays")
    op.drop_column("stays", "deleted_at")

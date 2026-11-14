"""complete cms newsletter

Revision ID: 202605160001
Revises: 202605150003
Create Date: 2026-05-16
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "202605160001"
down_revision: Union[str, None] = "202605150003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("sites", sa.Column("parent_site_id", sa.Integer(), nullable=True))
    op.add_column("sites", sa.Column("template_site_id", sa.Integer(), nullable=True))
    op.add_column("sites", sa.Column("is_template", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("sites", sa.Column("template_version", sa.String(40), nullable=False, server_default="v1"))
    op.add_column("sites", sa.Column("settings", sa.JSON(), nullable=False, server_default="{}"))
    op.create_index("ix_sites_parent_site_id", "sites", ["parent_site_id"])
    op.create_index("ix_sites_template_site_id", "sites", ["template_site_id"])
    op.create_foreign_key("fk_sites_parent_site_id_sites", "sites", "sites", ["parent_site_id"], ["id"])
    op.create_foreign_key("fk_sites_template_site_id_sites", "sites", "sites", ["template_site_id"], ["id"])

    for column in [
        sa.Column("content_type", sa.String(40), nullable=False, server_default="page"),
        sa.Column("cover_image_url", sa.String(500), nullable=False, server_default=""),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tags", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("related_stay_ids", sa.JSON(), nullable=False, server_default="[]"),
    ]:
        op.add_column("pages", column)
    op.create_index("ix_pages_content_type", "pages", ["content_type"])

    for column in [
        sa.Column("detail_config", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("faq", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("house_rules", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("location_config", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("social_links", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("related_content_ids", sa.JSON(), nullable=False, server_default="[]"),
    ]:
        op.add_column("stays", column)

    op.create_table(
        "announcements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("site_id", sa.Integer(), sa.ForeignKey("sites.id"), nullable=True),
        sa.Column("title", sa.String(180), nullable=False),
        sa.Column("body", sa.Text(), nullable=False, server_default=""),
        sa.Column("image_url", sa.String(500), nullable=False, server_default=""),
        sa.Column("cta_label", sa.String(80), nullable=False, server_default=""),
        sa.Column("cta_href", sa.String(260), nullable=False, server_default=""),
        sa.Column("display_mode", sa.String(40), nullable=False, server_default="popup"),
        sa.Column("status", sa.String(40), nullable=False, server_default="draft"),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_announcements_site_id", "announcements", ["site_id"])

    op.create_table(
        "booking_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("site_id", sa.Integer(), sa.ForeignKey("sites.id"), nullable=True),
        sa.Column("stay_id", sa.Integer(), sa.ForeignKey("stays.id"), nullable=True),
        sa.Column("room_type", sa.String(140), nullable=False, server_default=""),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("phone", sa.String(80), nullable=True),
        sa.Column("line_id", sa.String(120), nullable=True),
        sa.Column("check_in", sa.Date(), nullable=True),
        sa.Column("check_out", sa.Date(), nullable=True),
        sa.Column("guests", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("message", sa.Text(), nullable=False, server_default=""),
        sa.Column("source", sa.String(80), nullable=False, server_default="website"),
        sa.Column("status", sa.String(40), nullable=False, server_default="new"),
        sa.Column("admin_note", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_booking_requests_site_id", "booking_requests", ["site_id"])
    op.create_index("ix_booking_requests_stay_id", "booking_requests", ["stay_id"])

    op.add_column("email_settings", sa.Column("site_id", sa.Integer(), nullable=True))
    op.create_index("ix_email_settings_site_id", "email_settings", ["site_id"])
    op.create_foreign_key("fk_email_settings_site_id_sites", "email_settings", "sites", ["site_id"], ["id"])

    op.create_table(
        "newsletter_subscribers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("site_id", sa.Integer(), sa.ForeignKey("sites.id"), nullable=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("name", sa.String(120), nullable=False, server_default=""),
        sa.Column("groups", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("status", sa.String(40), nullable=False, server_default="subscribed"),
        sa.Column("unsubscribe_token", sa.String(120), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_newsletter_subscribers_site_id", "newsletter_subscribers", ["site_id"])
    op.create_index("ix_newsletter_subscribers_email", "newsletter_subscribers", ["email"])
    op.create_index("ix_newsletter_subscribers_unsubscribe_token", "newsletter_subscribers", ["unsubscribe_token"], unique=True)

    op.create_table(
        "newsletter_campaigns",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("site_id", sa.Integer(), sa.ForeignKey("sites.id"), nullable=True),
        sa.Column("subject", sa.String(180), nullable=False),
        sa.Column("body", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(40), nullable=False, server_default="draft"),
        sa.Column("target_groups", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("queued_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_newsletter_campaigns_site_id", "newsletter_campaigns", ["site_id"])

    op.create_table(
        "newsletter_deliveries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("site_id", sa.Integer(), sa.ForeignKey("sites.id"), nullable=True),
        sa.Column("campaign_id", sa.Integer(), sa.ForeignKey("newsletter_campaigns.id"), nullable=False),
        sa.Column("subscriber_id", sa.Integer(), sa.ForeignKey("newsletter_subscribers.id"), nullable=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("status", sa.String(40), nullable=False, server_default="pending"),
        sa.Column("error", sa.Text(), nullable=False, server_default=""),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_newsletter_deliveries_site_id", "newsletter_deliveries", ["site_id"])
    op.create_index("ix_newsletter_deliveries_campaign_id", "newsletter_deliveries", ["campaign_id"])
    op.create_index("ix_newsletter_deliveries_email", "newsletter_deliveries", ["email"])
    op.create_index("ix_newsletter_deliveries_status", "newsletter_deliveries", ["status"])


def downgrade() -> None:
    op.drop_table("newsletter_deliveries")
    op.drop_table("newsletter_campaigns")
    op.drop_table("newsletter_subscribers")
    op.drop_constraint("fk_email_settings_site_id_sites", "email_settings", type_="foreignkey")
    op.drop_index("ix_email_settings_site_id", table_name="email_settings")
    op.drop_column("email_settings", "site_id")
    op.drop_table("booking_requests")
    op.drop_table("announcements")
    for column in ["related_content_ids", "social_links", "location_config", "house_rules", "faq", "detail_config"]:
        op.drop_column("stays", column)
    op.drop_index("ix_pages_content_type", table_name="pages")
    for column in ["related_stay_ids", "tags", "sort_order", "cover_image_url", "content_type"]:
        op.drop_column("pages", column)
    op.drop_constraint("fk_sites_template_site_id_sites", "sites", type_="foreignkey")
    op.drop_constraint("fk_sites_parent_site_id_sites", "sites", type_="foreignkey")
    op.drop_index("ix_sites_template_site_id", table_name="sites")
    op.drop_index("ix_sites_parent_site_id", table_name="sites")
    for column in ["settings", "template_version", "is_template", "template_site_id", "parent_site_id"]:
        op.drop_column("sites", column)

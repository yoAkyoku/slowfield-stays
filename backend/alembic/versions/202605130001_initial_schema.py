"""initial schema

Revision ID: 202605130001
Revises:
Create Date: 2026-05-13
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "202605130001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "roles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(80), nullable=False, unique=True),
        sa.Column("permissions", sa.JSON(), nullable=False, server_default="[]"),
    )
    op.create_table(
        "admin_users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role_id", sa.Integer(), sa.ForeignKey("roles.id"), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "login_audits",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("admin_user_id", sa.Integer(), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("ip_address", sa.String(80), nullable=True),
        sa.Column("success", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "pages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("slug", sa.String(160), nullable=False, unique=True),
        sa.Column("title", sa.String(180), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False, server_default=""),
        sa.Column("body", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(40), nullable=False, server_default="draft"),
        sa.Column("seo", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "banners",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(180), nullable=False),
        sa.Column("subtitle", sa.String(260), nullable=False, server_default=""),
        sa.Column("image_url", sa.String(500), nullable=False),
        sa.Column("cta_label", sa.String(80), nullable=False, server_default="Explore"),
        sa.Column("cta_href", sa.String(260), nullable=False, server_default="/stays"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(40), nullable=False, server_default="draft"),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "stays",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("slug", sa.String(160), nullable=False, unique=True),
        sa.Column("name", sa.String(180), nullable=False),
        sa.Column("destination", sa.String(120), nullable=False),
        sa.Column("region", sa.String(120), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("story", sa.Text(), nullable=False, server_default=""),
        sa.Column("hero_image_url", sa.String(500), nullable=False),
        sa.Column("base_price", sa.Integer(), nullable=False),
        sa.Column("max_guests", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(40), nullable=False, server_default="draft"),
        sa.Column("seo", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "tags",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(80), nullable=False, unique=True),
        sa.Column("slug", sa.String(100), nullable=False, unique=True),
    )
    op.create_table(
        "amenities",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("stay_id", sa.Integer(), sa.ForeignKey("stays.id"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
    )
    op.create_table(
        "room_types",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("stay_id", sa.Integer(), sa.ForeignKey("stays.id"), nullable=False),
        sa.Column("name", sa.String(140), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("price", sa.Integer(), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False),
    )
    op.create_table(
        "stay_images",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("stay_id", sa.Integer(), sa.ForeignKey("stays.id"), nullable=False),
        sa.Column("image_url", sa.String(500), nullable=False),
        sa.Column("alt_text", sa.String(180), nullable=False, server_default=""),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_table(
        "media_assets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("url", sa.String(500), nullable=False),
        sa.Column("alt_text", sa.String(180), nullable=False, server_default=""),
        sa.Column("mime_type", sa.String(120), nullable=False, server_default="image/jpeg"),
        sa.Column("storage_key", sa.String(260), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "inquiries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("stay_id", sa.Integer(), sa.ForeignKey("stays.id"), nullable=True),
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
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("inquiries")
    op.drop_table("media_assets")
    op.drop_table("stay_images")
    op.drop_table("room_types")
    op.drop_table("amenities")
    op.drop_table("tags")
    op.drop_table("stays")
    op.drop_table("banners")
    op.drop_table("pages")
    op.drop_table("login_audits")
    op.drop_table("admin_users")
    op.drop_table("roles")


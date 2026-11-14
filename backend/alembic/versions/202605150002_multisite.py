"""multisite

Revision ID: 202605150002
Revises: 202605150001
Create Date: 2026-05-15
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "202605150002"
down_revision: Union[str, None] = "202605150001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sites",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(180), nullable=False),
        sa.Column("slug", sa.String(120), nullable=False, unique=True),
        sa.Column("domain", sa.String(255), nullable=False, unique=True),
        sa.Column("status", sa.String(40), nullable=False, server_default="active"),
        sa.Column("default_locale", sa.String(12), nullable=False, server_default="zh"),
        sa.Column("theme_config", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("contact_config", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("seo_defaults", sa.JSON(), nullable=False, server_default="{}"),
    )
    op.create_index("ix_sites_slug", "sites", ["slug"], unique=True)
    op.create_index("ix_sites_domain", "sites", ["domain"], unique=True)
    op.execute(
        """
        insert into sites (name, slug, domain, status, default_locale, theme_config, contact_config, seo_defaults)
        values (
            'Slowfield Stays',
            'slowfield',
            'localhost',
            'active',
            'zh',
            '{"primaryColor":"#2f4638","accentColor":"#b78b58"}',
            '{"email":"hello@example.com","line":"@slowfield"}',
            '{"title":"Slowfield Stays","description":"Curated private stays."}'
        )
        """
    )
    for table in ["pages", "banners", "stays", "media_assets", "inquiries"]:
        op.add_column(table, sa.Column("site_id", sa.Integer(), nullable=True))
        op.create_index(f"ix_{table}_site_id", table, ["site_id"])
        op.create_foreign_key(f"fk_{table}_site_id_sites", table, "sites", ["site_id"], ["id"])
        op.execute(f"update {table} set site_id = (select id from sites where slug = 'slowfield') where site_id is null")
    op.create_unique_constraint("uq_pages_site_slug", "pages", ["site_id", "slug"])
    op.create_unique_constraint("uq_stays_site_slug", "stays", ["site_id", "slug"])
    op.create_table(
        "admin_user_sites",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("admin_user_id", sa.Integer(), sa.ForeignKey("admin_users.id"), nullable=False),
        sa.Column("site_id", sa.Integer(), sa.ForeignKey("sites.id"), nullable=False),
        sa.Column("role_id", sa.Integer(), sa.ForeignKey("roles.id"), nullable=False),
    )
    op.create_index("ix_admin_user_sites_admin_user_id", "admin_user_sites", ["admin_user_id"])
    op.create_index("ix_admin_user_sites_site_id", "admin_user_sites", ["site_id"])
    op.execute(
        """
        insert into admin_user_sites (admin_user_id, site_id, role_id)
        select admin_users.id, sites.id, admin_users.role_id
        from admin_users cross join sites
        where sites.slug = 'slowfield'
        """
    )


def downgrade() -> None:
    op.drop_table("admin_user_sites")
    op.drop_constraint("uq_stays_site_slug", "stays", type_="unique")
    op.drop_constraint("uq_pages_site_slug", "pages", type_="unique")
    for table in ["inquiries", "media_assets", "stays", "banners", "pages"]:
        op.drop_constraint(f"fk_{table}_site_id_sites", table, type_="foreignkey")
        op.drop_index(f"ix_{table}_site_id", table_name=table)
        op.drop_column(table, "site_id")
    op.drop_index("ix_sites_domain", table_name="sites")
    op.drop_index("ix_sites_slug", table_name="sites")
    op.drop_table("sites")

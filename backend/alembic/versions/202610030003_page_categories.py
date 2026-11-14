"""allow CMS pages to appear in multiple categories

Revision ID: 202610030003
Revises: 202610030002
Create Date: 2026-10-03
"""

from alembic import op
import sqlalchemy as sa


revision = "202610030003"
down_revision = "202610030002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("pages", sa.Column("categories", sa.JSON(), nullable=False, server_default="[]"))
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id, content_type FROM pages")).fetchall()
    pages = sa.table(
        "pages",
        sa.column("id", sa.Integer()),
        sa.column("categories", sa.JSON()),
    )
    for row in rows:
        bind.execute(
            sa.update(pages)
            .where(pages.c.id == row.id)
            .values(categories=[row.content_type or "page"])
        )


def downgrade() -> None:
    op.drop_column("pages", "categories")

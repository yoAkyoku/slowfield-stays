"""preserve a user-facing name for media assets

Revision ID: 202610030001
Revises: 202609300001
Create Date: 2026-10-03
"""

from pathlib import Path

from alembic import op
import sqlalchemy as sa


revision = "202610030001"
down_revision = "202609300001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "media_assets",
        sa.Column("display_name", sa.String(260), nullable=False, server_default=""),
    )
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id, storage_key, url FROM media_assets")).fetchall()
    for row in rows:
        fallback = (row.storage_key or Path(row.url or "").name or f"media-{row.id}")[:260]
        bind.execute(
            sa.text("UPDATE media_assets SET display_name = :name WHERE id = :id"),
            {"name": fallback, "id": row.id},
        )


def downgrade() -> None:
    op.drop_column("media_assets", "display_name")

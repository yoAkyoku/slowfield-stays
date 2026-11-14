"""make page slug nullable and migrate fixed page content types

Revision ID: 202605210002
Revises: 202605210001
Create Date: 2026-05-21 00:20:00
"""

from alembic import op
import sqlalchemy as sa


revision = "202605210002"
down_revision = "202605210001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE pages SET content_type = 'experience' WHERE slug = 'experience' AND content_type = 'page'")
    op.execute("UPDATE pages SET content_type = 'privacy' WHERE slug = 'privacy' AND content_type = 'page'")
    op.alter_column("pages", "slug", existing_type=sa.String(length=160), nullable=True)


def downgrade() -> None:
    op.execute("UPDATE pages SET content_type = 'page' WHERE content_type IN ('experience', 'privacy')")
    # create_page/update_page store slug=None for pages on a fixed route (the
    # ones with no slug of their own), so re-adding NOT NULL on a populated
    # database aborted. The id supplies a value that is distinct both per site
    # (uq_pages_site_slug) and globally (pages_slug_key, which 202605260001's
    # own downgrade restores before this one runs). Nothing is overwritten: only
    # rows that never had a slug are touched.
    #
    # A pre-existing page literally slugged 'untitled-<some other page id>' would
    # collide; the UPDATE then fails inside the migration's transaction and the
    # whole downgrade rolls back, which is the outcome this change is for.
    op.execute("UPDATE pages SET slug = 'untitled-' || id WHERE slug IS NULL")
    op.alter_column("pages", "slug", existing_type=sa.String(length=160), nullable=False)

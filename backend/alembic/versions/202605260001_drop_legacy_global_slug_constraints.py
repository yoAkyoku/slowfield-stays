"""drop legacy global slug constraints

Revision ID: 202605260001
Revises: 202605240001
Create Date: 2026-05-26
"""

from typing import Sequence, Union

from alembic import op

revision: str = "202605260001"
down_revision: Union[str, None] = "202605240001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'pages_slug_key'
            ) THEN
                ALTER TABLE pages DROP CONSTRAINT pages_slug_key;
            END IF;
        END$$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'stays_slug_key'
            ) THEN
                ALTER TABLE stays DROP CONSTRAINT stays_slug_key;
            END IF;
        END$$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'pages_slug_key'
            ) THEN
                ALTER TABLE pages ADD CONSTRAINT pages_slug_key UNIQUE (slug);
            END IF;
        END$$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'stays_slug_key'
            ) THEN
                ALTER TABLE stays ADD CONSTRAINT stays_slug_key UNIQUE (slug);
            END IF;
        END$$;
        """
    )

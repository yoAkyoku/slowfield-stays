"""email settings

Revision ID: 202605150003
Revises: 202605150002
Create Date: 2026-05-15
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "202605150003"
down_revision: Union[str, None] = "202605150002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "email_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("smtp_host", sa.String(255), nullable=False, server_default=""),
        sa.Column("smtp_port", sa.Integer(), nullable=False, server_default="587"),
        sa.Column("smtp_username", sa.String(255), nullable=False, server_default=""),
        sa.Column("smtp_password", sa.String(500), nullable=False, server_default=""),
        sa.Column("from_email", sa.String(255), nullable=False, server_default=""),
        sa.Column("from_name", sa.String(120), nullable=False, server_default="Slowfield Stays"),
        sa.Column("use_tls", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_table("email_settings")

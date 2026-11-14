"""add inquiries.subject

The contact form asked for a 詢問類型 out of four fixed codes, which was the
inbox's filing system rather than anything the writer wanted to say — real
enquiries collected under "other". It now asks for a free-text 主旨, and the
inbox lists it as its own column (客戶: 主旨變成收件匣列表上獨立的一欄).

Nullable with a "" default: every existing row keeps working and the column
reads as empty rather than as missing.

Revision ID: 202608090001
Revises: 202606260002
Create Date: 2026-08-09
"""

from alembic import op
import sqlalchemy as sa


revision = "202608090001"
down_revision = "202606260002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "inquiries",
        sa.Column("subject", sa.String(length=200), nullable=False, server_default=""),
    )
    op.alter_column("inquiries", "subject", server_default=None)


def downgrade() -> None:
    op.drop_column("inquiries", "subject")

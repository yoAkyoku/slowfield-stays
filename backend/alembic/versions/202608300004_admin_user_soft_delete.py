"""add admin_users.deleted_at

帳號管理 had 停用 and nothing else. An account that should not exist at all —
someone who left, a duplicate, a test account made during setup — could only be
archived, so it stayed in the list, kept its site links, and kept its row in
every picker that lists administrators. The only way to remove one was psql.

Soft, like the seven lists that already work this way (住宿, 內容頁, 橫幅,
表單聯絡, 訂房需求, 電子報): deleting moves the account to 已刪除, where it can be
restored, and deleting it a second time from there removes it for good. Mirrors
the `deleted_at` column those tables carry so the admin behaves the same
everywhere.

Nullable with no default, so applying it deletes nobody: every existing account
comes through with `deleted_at IS NULL`, which is exactly "not deleted".

Revision ID: 202608300004
Revises: 202608300003
Create Date: 2026-08-30
"""

from alembic import op
import sqlalchemy as sa


revision = "202608300004"
down_revision = "202608300003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "admin_users",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("admin_users", "deleted_at")

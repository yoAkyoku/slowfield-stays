from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    permissions: Mapped[list[str]] = mapped_column(JSON, default=list)


class AdminUser(Base):
    __tablename__ = "admin_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    #: Bumped whenever this account's password changes. The number is copied
    #: into every token issued, and get_current_admin rejects a token whose copy
    #: is behind — so changing a password ends every session that was open with
    #: the old one. Without it a stolen token stayed valid for its full seven
    #: days no matter what the victim did, and deactivating the account was the
    #: only way to end it.
    token_epoch: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    #: Set when the account is deleted from 帳號管理. Soft, like every other
    #: delete in this admin: the row moves to 已刪除 and can be restored from
    #: there, or removed for good with the second delete. `is_active` is a
    #: separate axis and stays what it was — 停用 is a door someone can be let
    #: back through, deletion is not.
    #:
    #: Nothing authenticates while this is set: `login` refuses, and
    #: `get_current_admin` rejects a token already in someone's browser, so a
    #: session open at the moment of deletion ends on its next request.
    deleted_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    role: Mapped[Role] = relationship()


class LoginAudit(Base):
    __tablename__ = "login_audits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    admin_user_id: Mapped[int | None] = mapped_column(ForeignKey("admin_users.id"), nullable=True)
    email: Mapped[str] = mapped_column(String(255))
    ip_address: Mapped[str | None] = mapped_column(String(80), nullable=True)
    success: Mapped[bool] = mapped_column(Boolean)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    admin_user_id: Mapped[int] = mapped_column(ForeignKey("admin_users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

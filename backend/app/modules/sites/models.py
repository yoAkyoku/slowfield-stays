from sqlalchemy import Boolean, ForeignKey, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.modules.auth.models import Role


class Site(Base):
    __tablename__ = "sites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    parent_site_id: Mapped[int | None] = mapped_column(ForeignKey("sites.id"), nullable=True, index=True)
    template_site_id: Mapped[int | None] = mapped_column(ForeignKey("sites.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(180))
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    domain: Mapped[str | None] = mapped_column(String(255), unique=True, index=True, nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="active")
    is_template: Mapped[bool] = mapped_column(Boolean, default=False)
    template_version: Mapped[str] = mapped_column(String(40), default="v1")
    default_locale: Mapped[str] = mapped_column(String(12), default="zh")
    theme_config: Mapped[dict] = mapped_column(JSON, default=dict)
    contact_config: Mapped[dict] = mapped_column(JSON, default=dict)
    seo_defaults: Mapped[dict] = mapped_column(JSON, default=dict)
    settings: Mapped[dict] = mapped_column(JSON, default=dict)


class AdminUserSite(Base):
    __tablename__ = "admin_user_sites"
    __table_args__ = (UniqueConstraint("admin_user_id", "site_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    admin_user_id: Mapped[int] = mapped_column(ForeignKey("admin_users.id"), index=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id"), index=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"))

    site: Mapped[Site] = relationship()
    role: Mapped[Role] = relationship()

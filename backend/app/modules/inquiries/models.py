from datetime import date

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Inquiry(Base):
    __tablename__ = "inquiries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    site_id: Mapped[int | None] = mapped_column(ForeignKey("sites.id"), nullable=True, index=True)
    stay_id: Mapped[int | None] = mapped_column(ForeignKey("stays.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(80), nullable=True)
    line_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    check_in: Mapped[date | None] = mapped_column(Date, nullable=True)
    check_out: Mapped[date | None] = mapped_column(Date, nullable=True)
    guests: Mapped[int] = mapped_column(Integer, default=2)
    # What the enquiry is about, in the visitor's own words. Replaced the fixed
    # 詢問類型 codes, which filed anything real under "other".
    subject: Mapped[str] = mapped_column(String(200), default="")
    message: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str] = mapped_column(String(80), default="website")
    status: Mapped[str] = mapped_column(String(40), default="new")
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Soft delete, as on stays / pages / banners: spam and test entries leave
    # the list without leaving the database, so a mis-click is recoverable.
    deleted_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)

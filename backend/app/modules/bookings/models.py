from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BookingRequest(Base):
    __tablename__ = "booking_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    site_id: Mapped[int | None] = mapped_column(ForeignKey("sites.id"), nullable=True, index=True)
    stay_id: Mapped[int | None] = mapped_column(ForeignKey("stays.id"), nullable=True, index=True)
    room_type: Mapped[str] = mapped_column(String(140), default="")
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(80), nullable=True)
    line_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    check_in: Mapped[date | None] = mapped_column(Date, nullable=True)
    check_out: Mapped[date | None] = mapped_column(Date, nullable=True)
    guests: Mapped[int] = mapped_column(Integer, default=2)
    message: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str] = mapped_column(String(80), default="website")
    status: Mapped[str] = mapped_column(String(40), default="new")
    admin_note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Soft delete, as on Inquiry: a spam or test booking leaves the inbox but
    # stays in the database, so "delete" is undoable and an enquiry that turned
    # out to be real is recoverable.
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

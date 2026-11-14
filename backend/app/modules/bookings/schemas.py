from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field, model_validator


class _BookingRequestFields(BaseModel):
    stay_id: int | None = None
    room_type: str = Field(default="", max_length=140)
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    # Bounded to the column width. name/subject/message were, these three
    # were not, so an unauthenticated POST with a 5,000-character phone
    # reached Postgres and came back as a 500 (StringDataRightTruncation)
    # instead of a 422 — an error path any visitor could trigger at will,
    # and a log line for every one of them.
    phone: str | None = Field(default=None, max_length=80)
    line_id: str | None = Field(default=None, max_length=120)
    check_in: date | None = None
    check_out: date | None = None
    guests: int = Field(default=2, ge=1, le=20)
    message: str = Field(default="", max_length=2000)
    # "partnership" covers 企劃合作 enquiries, which the contact form offers as a
    # type but had no code of its own — they were landing under "other" next to
    # genuinely uncategorised mail. Widening the pattern needs no migration; the
    # column is a plain string.
    source: str = Field(default="website", pattern="^(website|phone|email|line|walk-in|booking|franchise|pr|partnership|career|other)$")
    # Honeypot: real visitors leave this empty; bots that auto-fill every
    # field will populate it and we silently drop their submission. The
    # frontend renders this input off-screen with aria-hidden.
    website: str = ""


class BookingRequestCreate(_BookingRequestFields):
    @model_validator(mode="after")
    def validate_date_order(self):
        if self.check_in and self.check_out and self.check_out <= self.check_in:
            raise ValueError("Check-out must be after check-in")
        return self


class BookingRequestPublicRead(_BookingRequestFields):
    id: int
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class BookingRequestRead(_BookingRequestFields):
    id: int
    status: str
    admin_note: str = ""
    created_at: datetime

    model_config = {"from_attributes": True}

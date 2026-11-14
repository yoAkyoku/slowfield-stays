from pydantic import BaseModel, EmailStr


class NewsletterSubscribe(BaseModel):
    email: EmailStr
    name: str = ""
    groups: list[str] = []


class NewsletterResult(BaseModel):
    ok: bool
    status: str
    # Which site the action applied to (resolved from the subscriber), so the
    # unsubscribe page can tell the visitor exactly what they left.
    site_name: str | None = None
    site_slug: str | None = None

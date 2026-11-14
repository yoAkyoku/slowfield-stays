from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, JSON, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class EmailSettings(Base):
    __tablename__ = "email_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    site_id: Mapped[int | None] = mapped_column(ForeignKey("sites.id"), nullable=True, index=True)
    smtp_host: Mapped[str] = mapped_column(String(255), default="")
    smtp_port: Mapped[int] = mapped_column(Integer, default=587)
    smtp_username: Mapped[str] = mapped_column(String(255), default="")
    smtp_password: Mapped[str] = mapped_column(String(500), default="")
    from_email: Mapped[str] = mapped_column(String(255), default="")
    from_name: Mapped[str] = mapped_column(String(120), default="Slowfield Stays")
    use_tls: Mapped[bool] = mapped_column(Boolean, default=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    # Hard daily ceiling — when process_newsletter_queue() has already sent
    # this many deliveries today (UTC midnight rollover) for this site, the
    # rest stay pending and try again tomorrow. 0 disables the cap (Resend
    # Pro, AWS SES, Workspace etc with no daily limit). Default 100 matches
    # the Resend free tier.
    daily_cap: Mapped[int] = mapped_column(Integer, default=100)
    # Comma-separated list of addresses set as the Reply-To header on every
    # outbound message. When a subscriber hits Reply, their mail client
    # populates To: with these (works in Gmail, Apple Mail, Outlook). Lets
    # the From: stay on-brand (hejing@slowfield.example) while replies
    # land in the property managers' actual Gmail inboxes.
    reply_to: Mapped[str] = mapped_column(String(500), default="")


class NewsletterSubscriber(Base):
    __tablename__ = "newsletter_subscribers"

    # One LIVE subscription per site and address. Without it the same address
    # could exist several times for one site, which meant duplicate newsletters,
    # an unsubscribe that only stopped one copy, and a 500 on the signup form
    # (the lookup uses scalar_one_or_none). Partial, so a soft-deleted row —
    # someone who erased their data and later signed up again — does not block
    # the new subscription. coalesce, because site_id is nullable and NULLs are
    # distinct in a unique index, which would leave legacy rows unconstrained.
    __table_args__ = (
        Index(
            "uq_newsletter_subscriber_site_email",
            text("coalesce(site_id, -1)"),
            text("lower(email)"),
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    site_id: Mapped[int | None] = mapped_column(ForeignKey("sites.id"), nullable=True, index=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    name: Mapped[str] = mapped_column(String(120), default="")
    groups: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(40), default="subscribed")
    unsubscribe_token: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)


class NewsletterCampaign(Base):
    __tablename__ = "newsletter_campaigns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    site_id: Mapped[int | None] = mapped_column(ForeignKey("sites.id"), nullable=True, index=True)
    subject: Mapped[str] = mapped_column(String(180))
    body: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(40), default="draft")
    target_groups: Mapped[list] = mapped_column(JSON, default=list)
    # "self" — only this site's subscribers (default, backwards-compatible).
    # "self+children" — this site + every child site (parent-site only). Set
    # via NewsletterCampaignUpsert.recipient_scope.
    recipient_scope: Mapped[str] = mapped_column(String(20), default="self")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    queued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Future timestamp set by /schedule. The background tick promotes any
    # status="scheduled" row with scheduled_at <= now back to "queued" so the
    # normal delivery worker picks it up. Null while in draft / queued / sent.
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    # When the queue drained. process_newsletter_queue has always assigned this,
    # but without a column behind it the value was silently dropped at commit
    # and the admin's 發送時間 column could never show anything but "—".
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)


class NewsletterDelivery(Base):
    __tablename__ = "newsletter_deliveries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    site_id: Mapped[int | None] = mapped_column(ForeignKey("sites.id"), nullable=True, index=True)
    # Nullable: test sends (Email Settings → test) have no campaign but are still
    # recorded as deliveries so they count toward count_sent_today / the daily cap.
    campaign_id: Mapped[int | None] = mapped_column(ForeignKey("newsletter_campaigns.id"), nullable=True, index=True)
    subscriber_id: Mapped[int | None] = mapped_column(ForeignKey("newsletter_subscribers.id"), nullable=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    # pending → sending → sent / failed / skipped. "sending" is the claim: it is
    # written and committed before any mail goes out, so a second processor
    # cannot pick the same row up and send it twice.
    status: Mapped[str] = mapped_column(String(40), default="pending", index=True)
    error: Mapped[str] = mapped_column(Text, default="")
    # When the row was claimed. A process that dies mid-send leaves "sending"
    # behind; this is what lets a later run tell an abandoned claim from one
    # that is genuinely in flight.
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

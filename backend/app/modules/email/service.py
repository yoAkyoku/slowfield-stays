import asyncio
import logging
import re
from contextlib import contextmanager
from contextvars import ContextVar
from email import policy as email_policy
from email.headerregistry import HeaderRegistry, UnstructuredHeader
from email.message import EmailMessage
from html import escape, unescape
from urllib.parse import quote, urljoin
import smtplib

from datetime import UTC, datetime, timedelta

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings as app_settings
from app.modules.email.models import EmailSettings, NewsletterCampaign, NewsletterDelivery, NewsletterSubscriber
from app.modules.sites.models import Site

logger = logging.getLogger(__name__)


async def get_email_settings(session: AsyncSession, site_id: int | None) -> EmailSettings:
    # A missing site_id used to mean "any row", which resolved to the lowest id
    # in the whole table — whichever tenant configured email first. Every site
    # admin can edit their own smtp_host, so that tenant's admin was one row away
    # from receiving other tenants' password-reset links on a relay they control.
    # There is no global SMTP configuration to fall back on, so refuse to guess.
    if site_id is None:
        raise ValueError("get_email_settings requires a site_id")
    query = select(EmailSettings).where(EmailSettings.site_id == site_id)
    result = await session.execute(query.order_by(EmailSettings.id).limit(1))
    settings = result.scalar_one_or_none()
    if settings:
        return settings
    settings = EmailSettings(site_id=site_id)
    session.add(settings)
    await session.flush()
    return settings


def _html_to_text(html_body: str) -> str:
    """Best-effort plain-text fallback for an HTML email body.

    Converts <br> and block-level closes to newlines, strips remaining tags,
    and unescapes entities. Good enough for the multipart text/plain part so
    clients without HTML rendering still get readable content.

    Links keep their target — ``<a href="X">Label</a>`` becomes ``Label (X)``.
    Dropping the href along with the tag meant the text/plain alternative of a
    bulk mailing carried no unsubscribe link at all, only the words next to it,
    which is precisely the part a plain-text reader needs to be able to act on.

    ``<script>`` / ``<style>`` blocks are removed wholesale rather than having
    their tags stripped: leaving the contents behind dumped raw CSS or JS into
    the readable part of the message.
    """
    html_body = strip_clipboard_fragment_markers(html_body)
    text = re.sub(r"(?is)<\s*(script|style)\b[^>]*>.*?</\s*\1\s*>", "", html_body)
    text = re.sub(r"(?i)<\s*br\s*/?\s*>", "\n", text)
    text = re.sub(r"(?i)</\s*(p|div|li|tr|td|th|h[1-6]|blockquote)\s*>", "\n", text)
    text = re.sub(
        r"(?is)<\s*a\b[^>]*\bhref\s*=\s*[\"']([^\"']*)[\"'][^>]*>(.*?)</\s*a\s*>",
        r"\2 (\1)",
        text,
    )
    text = re.sub(r"<[^>]+>", "", text)
    text = unescape(text)
    # Trailing spaces before a newline are an artefact of the tag stripping.
    text = re.sub(r"[ \t]+\n", "\n", text)
    # Collapse runs of 3+ newlines down to a paragraph break.
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


_EMAIL_IMAGE_SRC_RE = re.compile(
    r"(?P<prefix><img\b[^>]*\bsrc\s*=\s*)(?P<quote>[\"'])(?P<src>[^\"']*)(?P=quote)",
    re.IGNORECASE,
)
_EMAIL_IMG_TAG_RE = re.compile(r"<img\b(?P<attrs>[^>]*?)(?P<close>\s*/?)>", re.IGNORECASE)
_HTML_STYLE_ATTR_RE = re.compile(r"(?P<prefix>\sstyle\s*=\s*)(?P<quote>[\"'])(?P<style>.*?)(?P=quote)", re.IGNORECASE)

# HTML copied from a browser may contain these selection-boundary comments.
# They are not content and, after the frontend's old allow-list escaped them,
# were delivered as the literal text ``<!--EndFragment-->``. Keep the cleanup
# here as well so campaigns created before the frontend fix are corrected when
# they are rendered or sent.
_CLIPBOARD_FRAGMENT_COMMENT_RE = re.compile(
    r"<!--\s*(?:Start|End)Fragment\s*-->|&lt;!--\s*(?:Start|End)Fragment\s*--(?:&gt;|>)",
    re.IGNORECASE,
)
_CLIPBOARD_FRAGMENT_TEXT_RE = re.compile(
    r"(^|\n)[ \t]*(?:Start|End)Fragment[ \t]*(?=\n|$)",
    re.IGNORECASE | re.MULTILINE,
)


def strip_clipboard_fragment_markers(html_body: str | None) -> str:
    """Remove browser clipboard boundary markers without changing authored HTML."""
    if html_body is None:
        return ""
    return _CLIPBOARD_FRAGMENT_TEXT_RE.sub(
        r"\1",
        _CLIPBOARD_FRAGMENT_COMMENT_RE.sub("", str(html_body)),
    )


def _absolutize_email_image_urls(html_body: str, base_url: str) -> str:
    """Make site-relative image sources usable outside the web preview.

    The editor intentionally stores ``/storage/...`` paths so the browser and
    the public site can resolve them against the current origin. An email has
    no origin, however, so those same paths render as broken images in most
    clients. Only single-slash site paths are rewritten; absolute URLs and
    protocol-relative URLs are left untouched.
    """
    html_body = strip_clipboard_fragment_markers(html_body)
    origin = base_url.rstrip("/") + "/"

    def replace(match: re.Match[str]) -> str:
        src = match.group("src").strip()
        if not src.startswith("/") or src.startswith("//"):
            return match.group(0)
        absolute = urljoin(origin, src.lstrip("/"))
        return f'{match.group("prefix")}{match.group("quote")}{absolute}{match.group("quote")}'

    return _EMAIL_IMAGE_SRC_RE.sub(replace, html_body)


def _responsive_newsletter_images(html_body: str) -> str:
    """Keep authored images inside the email column on every mail client."""

    def replace(match: re.Match[str]) -> str:
        attrs = match.group("attrs")
        # `loading="lazy"` is useful on the public page, but it is a browser
        # hint that several mail clients ignore inconsistently. A newsletter
        # should request its authored media as soon as the message is opened.
        attrs = re.sub(r"\s+loading\s*=\s*([\"'])lazy\1", "", attrs, flags=re.IGNORECASE)
        has_width_attr = bool(re.search(r"\bwidth\s*=\s*['\"]\s*\d{1,4}\s*['\"]", attrs, re.IGNORECASE))
        style = _HTML_STYLE_ATTR_RE.search(attrs)
        additions = ["display: block", "max-width: 100%", "height: auto"]
        # A numeric width attribute is useful to Outlook, so keep it and only
        # add a responsive max-width. Images without one should fill the email
        # column instead of using their source file's natural pixel width.
        if not has_width_attr and not (style and re.search(r"\bwidth\s*:", style.group("style"), re.IGNORECASE)):
            additions.insert(1, "width: 100%")
        if style:
            existing = style.group("style").strip().rstrip(";")
            merged = "; ".join(part for part in [existing, *additions] if part)
            attrs = attrs[:style.start()] + f'{style.group("prefix")}{style.group("quote")}{merged}{style.group("quote")}' + attrs[style.end():]
        else:
            style_value = "; ".join(additions)
            attrs = f'{attrs} style="{style_value}"'
        return f"<img{attrs}{match.group('close')}>"

    return _EMAIL_IMG_TAG_RE.sub(replace, html_body)


def _newsletter_email_document(html_body: str) -> str:
    """Render a small, fluid email canvas instead of a full-width fragment."""
    return (
        '<!doctype html><html><body style="margin:0;padding:0;background:#f4efe6;">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
        'style="width:100%;background:#f4efe6;">'
        '<tr><td align="center" style="padding:24px 12px;">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
        'style="width:100%;max-width:640px;background:#ffffff;">'
        '<tr><td style="padding:28px 24px;color:#3d3d3d;font-family:Arial, Helvetica, sans-serif;'
        'font-size:16px;line-height:1.7;">'
        f"{html_body}"
        '</td></tr></table></td></tr></table></body></html>'
    )


def _prepare_newsletter_email_body(html_body: str, base_url: str) -> str:
    """Clean legacy clipboard output and make media usable in a real email."""
    clean = _absolutize_email_image_urls(html_body, base_url)
    return _newsletter_email_document(_responsive_newsletter_images(clean))


# Extra RFC 5322 headers for the message ``_send_email_sync`` is about to build.
#
# This is ambient rather than an argument on purpose. ``_send_email_sync`` is
# the single seam the whole test suite substitutes to keep SMTP out of the
# tests, and its five-argument shape is depended on by test doubles outside
# this module's ownership; widening it would be the cleaner API but is not a
# change this module can make on its own. A ContextVar is safe here because
# ``asyncio.to_thread`` copies the calling context into the worker thread, so
# each in-flight message sees only its own headers even with several sends
# running concurrently.
_extra_headers: ContextVar[tuple[tuple[str, str], ...]] = ContextVar(
    "email_extra_headers", default=()
)


class _VerbatimHeader(UnstructuredHeader):
    """A header written out exactly as given, on a single line.

    ``EmailMessage`` builds on ``email.policy.default``, which treats a header
    it does not recognise as unstructured prose and folds it to 78 columns. A
    URI has no whitespace to fold at, so the folder falls back to RFC 2047 and

        List-Unsubscribe: <https://villa.example/api/v1/newsletter/unsub…>

    goes out as ``List-Unsubscribe: =?utf-8?q?=3Chttps=3A//villa=2E…?=`` —
    not a URI, illegal in a structured header, and parsed by nobody. The header
    would then be present and useless, which is worse than absent: absent, at
    least, is a state that can be noticed. Anything over roughly 60 characters
    triggers it, which every real unsubscribe URL is.

    RFC 5322 permits 998 octets on a line, so emitting these unfolded is well
    within spec.
    """

    def fold(self, *, policy) -> str:
        return f"{self.name}: {self}{policy.linesep}"


_HEADER_REGISTRY = HeaderRegistry()
for _verbatim in ("List-Unsubscribe", "List-Unsubscribe-Post"):
    _HEADER_REGISTRY.map_to_type(_verbatim, _VerbatimHeader)

#: `email.policy.default` with the two list headers exempted from folding.
#: Everything else — Subject and From encoding in particular — is untouched.
MESSAGE_POLICY = email_policy.default.clone(header_factory=_HEADER_REGISTRY)


def _clean_header_value(value: str) -> str:
    """A header value with anything that could forge a new header removed.

    ``EmailMessage`` already raises on an embedded CR/LF, so this is not the
    only line of defence — but raising turns a bad ``Site.domain`` (free text
    an admin types) into a failed delivery rather than a mail with one header
    missing, so the value is scrubbed before it gets that far.
    """
    return "".join(ch for ch in (value or "") if ch not in "\r\n").strip()


@contextmanager
def outbound_headers(headers: dict[str, str] | None):
    """Attach `headers` to whatever ``_send_email_sync`` builds inside the block."""
    cleaned = tuple(
        (name.strip(), _clean_header_value(value))
        for name, value in (headers or {}).items()
        if name and "\r" not in name and "\n" not in name and _clean_header_value(value)
    )
    token = _extra_headers.set(cleaned)
    try:
        yield
    finally:
        _extra_headers.reset(token)


def _send_email_sync(
    settings: EmailSettings, to_email: str, subject: str, body: str, html: bool = False
) -> bool:
    """Blocking SMTP send — run via ``asyncio.to_thread`` to avoid blocking the event loop."""
    if not settings.is_enabled or not settings.smtp_host or not settings.from_email:
        return False

    message = EmailMessage(policy=MESSAGE_POLICY)
    message["Subject"] = subject
    message["From"] = f"{settings.from_name} <{settings.from_email}>" if settings.from_name else settings.from_email
    message["To"] = to_email
    # Reply-To: when set, the recipient's mail client routes replies here
    # instead of back to From:. RFC 2822 allows multiple comma-separated
    # addresses — all of them get pre-filled on Reply.
    # `or ""` as well as the getattr default: the column is NOT NULL in the
    # database, but an EmailSettings built in memory and not yet flushed carries
    # None, and `None.strip()` would take the whole send down.
    reply_to = _clean_header_value(getattr(settings, "reply_to", "") or "")
    if reply_to:
        message["Reply-To"] = reply_to
    # List-Unsubscribe / List-Unsubscribe-Post arrive here (see outbound_headers).
    for name, value in _extra_headers.get():
        del message[name]  # no-op when absent; keeps a repeat from duplicating
        message[name] = value
    if html:
        body = strip_clipboard_fragment_markers(body)
        # multipart/alternative: text/plain fallback + text/html. Clients pick
        # the richest part they can render, so newsletters show formatted HTML
        # instead of literal <br> tags.
        message.set_content(_html_to_text(body))
        message.add_alternative(body, subtype="html")
    else:
        message.set_content(body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as client:
        if settings.use_tls:
            client.starttls()
        if settings.smtp_username and settings.smtp_password:
            from app.core.crypto import decrypt_value
            client.login(settings.smtp_username, decrypt_value(settings.smtp_password))
        client.send_message(message)
    return True


def send_email(settings: EmailSettings, to_email: str, subject: str, body: str, html: bool = False) -> bool:
    """Sync wrapper kept for backward compatibility."""
    return _send_email_sync(settings, to_email, subject, body, html)


async def send_email_async(
    settings: EmailSettings,
    to_email: str,
    subject: str,
    body: str,
    html: bool = False,
    extra_headers: dict[str, str] | None = None,
) -> bool:
    """Non-blocking SMTP send for use inside async handlers.

    ``extra_headers`` is how the newsletter path attaches List-Unsubscribe; it
    is scoped to this call only.
    """
    with outbound_headers(extra_headers):
        return await asyncio.to_thread(_send_email_sync, settings, to_email, subject, body, html)


# ---------------------------------------------------------------------------
# Unified send — SMTP, configured per site in Admin > Email Settings
# ---------------------------------------------------------------------------

async def send_system_email(
    session: AsyncSession, site_id: int, to_email: str, subject: str, body: str
) -> bool:
    """Send a system/transactional email over `site_id`'s configured SMTP.

    `site_id` is required and not inferred: the caller has to know which site's
    relay is the right one to hand this message to, because every site admin can
    point their own relay wherever they like.

    Everything goes out over SMTP, which is what makes the provider a setting
    rather than a deployment: Resend is what this runs on today, and moving to
    SES, Postmark or a mailbox provider is a host/port/credential change in the
    admin, with no code or redeploy involved.

    A second transport (a Cloudflare Worker) used to sit in front of this and
    take priority whenever an env var happened to be set. It was never adopted,
    it bypassed the per-site settings entirely — so a villa's own From address
    and reply-to were silently ignored on the paths that used it — and it was
    the only outbound HTTP call in the backend. Removed rather than left as a
    switch nobody meant to flip.
    """
    settings = await get_email_settings(session, site_id)
    return await send_email_async(settings, to_email, subject, body)


async def send_password_reset_email(
    session: AsyncSession, site_id: int, to_email: str, reset_url: str
) -> bool:
    body = (
        "Hello,\n\n"
        "Use the link below to reset your Slowfield Stays CMS password. "
        "This link expires in 30 minutes.\n\n"
        f"{reset_url}\n\n"
        "If you did not request this, you can ignore this email."
    )
    return await send_system_email(session, site_id, to_email, "Reset your CMS password", body)


# ---------------------------------------------------------------------------
# Unsubscribe links
# ---------------------------------------------------------------------------

#: Labels for the visible footer link, keyed by the site's own locale.
UNSUBSCRIBE_LABELS = {"zh": "取消訂閱", "en": "Unsubscribe"}
#: Used whenever the sending site's locale cannot be established. There is no
#: per-subscriber locale anywhere in the schema (see _unsubscribe_label), so a
#: message we cannot attribute to a language keeps saying both.
BILINGUAL_UNSUBSCRIBE_LABEL = "Unsubscribe / 取消訂閱"

_HOSTNAME_RE = re.compile(r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$")
#: Suffixes that are never a public brand domain, so a link built from one
#: would be worse than the configured frontend URL.
_NON_PUBLIC_TLDS = frozenset({"localhost", "local", "internal", "invalid", "test", "example"})


def site_public_base_url(site: Site | None) -> str | None:
    """``https://<the site's own domain>``, or None when it has no usable one.

    ``Site.domain`` is free text an admin types, and the child sites in this
    deployment mostly have none at all (they are served as a path under the
    parent). Anything that is not a plain public hostname — an IP literal, a
    bare name, ``*.localhost`` — is refused rather than turned into a link
    nobody can open; the caller falls back to ``frontend_url``.
    """
    domain = (getattr(site, "domain", None) or "").strip().lower().rstrip(".")
    if not domain or not _HOSTNAME_RE.match(domain):
        return None
    tld = domain.rsplit(".", 1)[-1]
    # A numeric last label means an IPv4 literal, not a hostname.
    if not tld.isalpha() or len(tld) < 2 or tld in _NON_PUBLIC_TLDS:
        return None
    return f"https://{domain}"


def _unsubscribe_label(site: Site | None) -> str:
    """The footer link text, in the language the site publishes in.

    `NewsletterSubscriber` records no locale, and nothing else on the row
    implies one (`groups` is a free-form tag list the signup form fills with
    "public"). The site's `default_locale` is the closest honest source: it is
    the language the campaign body itself was written in, because a campaign
    has exactly one body and it is authored in that site's admin. It is *not*
    the recipient's own preference, so where it is missing or unrecognised the
    footer stays bilingual rather than guessing.
    """
    locale = (getattr(site, "default_locale", None) or "").strip().lower()
    return UNSUBSCRIBE_LABELS.get(locale, BILINGUAL_UNSUBSCRIBE_LABEL)


async def resolve_unsubscribe_base_url(session: AsyncSession, site_id: int | None) -> str:
    """The origin a subscriber of `site_id` should see on their unsubscribe link.

    `frontend_url` is one global setting, so every child site's subscribers used
    to be sent to the parent's domain. Functionally that still unsubscribes them
    (the token is globally unique) but it reads as a link from a different brand
    than the mail, which is exactly the shape of a phishing link.
    """
    site = await session.get(Site, site_id) if site_id is not None else None
    return site_public_base_url(site) or app_settings.frontend_url.rstrip("/")


def unsubscribe_page_url(base_url: str, token: str) -> str:
    """The human confirmation page — a GET here renders, it never unsubscribes."""
    return f"{base_url.rstrip('/')}/newsletter/unsubscribe?token={quote(token, safe='')}"


def one_click_unsubscribe_url(base_url: str, token: str) -> str:
    """The RFC 8058 endpoint named by List-Unsubscribe / List-Unsubscribe-Post.

    Same origin as the page above: the reverse proxy hands `/api/*` to this
    backend and everything else to the frontend, on whichever host the request
    arrived at (see the repository's Caddyfile), so one domain serves both.
    """
    prefix = app_settings.api_v1_prefix.strip()
    if not prefix.startswith("/"):
        prefix = f"/{prefix}"
    return (
        f"{base_url.rstrip('/')}{prefix.rstrip('/')}"
        f"/newsletter/unsubscribe/one-click?token={quote(token, safe='')}"
    )


def unsubscribe_headers(one_click_url: str) -> dict[str, str]:
    """The pair Gmail and Yahoo have required of bulk senders since Feb 2024.

    `List-Unsubscribe-Post` is a promise that a POST to that URI unsubscribes
    without any further confirmation, so it is only ever emitted alongside a URI
    that really answers POST — `POST /newsletter/unsubscribe/one-click`.
    Advertising one-click and then 405-ing the provider is worse than sending
    neither header, because the failure is invisible to us and counts against
    the sending domain.
    """
    return {
        "List-Unsubscribe": f"<{one_click_url}>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    }


async def count_sent_today(session: AsyncSession, site_id: int) -> int:
    """Count successful deliveries since UTC midnight for this site.

    Used by process_newsletter_queue() to enforce daily_cap and by the admin
    payload to show "today's sent count" in the email-settings panel.
    """
    today_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    result = await session.execute(
        select(func.count(NewsletterDelivery.id)).where(
            NewsletterDelivery.site_id == site_id,
            NewsletterDelivery.status == "sent",
            NewsletterDelivery.sent_at >= today_start,
        )
    )
    return int(result.scalar() or 0)


# A delivery claimed for sending but never finished — the process died between
# the claim and the result. Anything older than this is fair game again.
STALE_CLAIM_MINUTES = 15


async def process_newsletter_queue(session: AsyncSession, site_id: int, limit: int = 25) -> dict[str, int]:
    """Send the pending queue for one site.

    Deliveries are CLAIMED before any mail goes out, in a transaction of their
    own. Three callers can run this at once — the 60-second scheduler tick, the
    admin "process now" button, and the per-campaign process route — and the
    previous version selected `pending` rows, sent every one of them, and only
    wrote their status at the very end. Two overlapping runs therefore read the
    same rows and both sent them: real subscribers received the same newsletter
    twice, and the window was the whole batch of SMTP round trips, seconds wide.

    `FOR UPDATE ... SKIP LOCKED` means a second run takes the next unclaimed
    rows instead of blocking or duplicating, so concurrent processing stays
    useful rather than merely safe.
    """
    settings = await get_email_settings(session, site_id)

    # Recover claims abandoned by a process that died mid-send. Without this a
    # crash strands those rows in "sending" and nothing ever picks them up.
    stale_before = datetime.now(UTC) - timedelta(minutes=STALE_CLAIM_MINUTES)
    stale = (
        await session.execute(
            select(NewsletterDelivery).where(
                NewsletterDelivery.site_id == site_id,
                NewsletterDelivery.status == "sending",
                NewsletterDelivery.claimed_at.is_(None) | (NewsletterDelivery.claimed_at < stale_before),
            )
        )
    ).scalars().all()
    for row in stale:
        row.status = "pending"
        row.claimed_at = None
    if stale:
        logger.warning(
            "Reclaimed %d newsletter deliveries left in 'sending' for site %s", len(stale), site_id
        )
        await session.commit()

    deliveries = (
        await session.execute(
            select(NewsletterDelivery)
            .where(
                NewsletterDelivery.site_id == site_id,
                NewsletterDelivery.status == "pending",
                # A different queued campaign can trigger a site-wide sweep.
                # Keep scheduled deliveries unclaimed until promotion at due time.
                NewsletterDelivery.campaign_id.is_(None) | ~NewsletterDelivery.campaign_id.in_(
                    select(NewsletterCampaign.id).where(NewsletterCampaign.status == "scheduled")
                ),
            )
            .order_by(NewsletterDelivery.id)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
    ).scalars().all()
    # Claim them and release the lock before the first send: holding a row lock
    # across an SMTP conversation would tie up the transaction for the length of
    # the batch.
    claimed_at = datetime.now(UTC)
    for delivery in deliveries:
        delivery.status = "sending"
        delivery.claimed_at = claimed_at
    await session.commit()
    # Daily cap: how many we've successfully sent today (UTC). We only
    # consult this when daily_cap > 0; 0 means "unlimited" (Resend Pro, SES).
    # daily_cap can be NULL in the DB / unset on the object; treat as 0 (unlimited).
    cap = (settings.daily_cap or 0) if settings else 0
    sent_today = await count_sent_today(session, site_id) if cap > 0 else 0
    cap_hit = False
    sent = failed = skipped = 0
    for delivery in deliveries:
        if cap > 0 and sent_today >= cap:
            # Hand back every row this batch claimed and did not send, so they
            # are pending again rather than sitting in "sending" until the stale
            # sweep 15 minutes later.
            for unsent in deliveries[deliveries.index(delivery):]:
                if unsent.status == "sending":
                    unsent.status = "pending"
                    unsent.claimed_at = None
            cap_hit = True
            break
        subscriber = await session.get(NewsletterSubscriber, delivery.subscriber_id) if delivery.subscriber_id else None
        if subscriber is not None and subscriber.deleted_at is not None:
            delivery.status = "skipped"
            delivery.claimed_at = None
            delivery.error = "Subscriber is deleted"
            skipped += 1
            continue
        if subscriber is not None and subscriber.status != "subscribed":
            delivery.status = "skipped"
            delivery.claimed_at = None
            delivery.error = "Subscriber is unsubscribed"
            skipped += 1
            continue
        campaign = await session.get(NewsletterCampaign, delivery.campaign_id)
        if campaign is None:
            delivery.status = "failed"
            delivery.claimed_at = None
            delivery.error = "Campaign not found"
            failed += 1
            continue
        if campaign.deleted_at is not None:
            delivery.status = "skipped"
            delivery.claimed_at = None
            delivery.error = "Campaign is deleted"
            skipped += 1
            continue
        token = (getattr(subscriber, "unsubscribe_token", "") or "").strip() if subscriber else ""
        if not token:
            # No token means no unsubscribe link and no List-Unsubscribe header,
            # i.e. bulk mail a recipient has no way to stop — which is the one
            # thing a mailing must never be. Reachable when the subscriber row
            # was purged: `purge_subscriber` clears `subscriber_id` on the
            # delivery and leaves the row behind as the send log. Skip rather
            # than send something unstoppable to someone already erased.
            delivery.status = "skipped"
            delivery.claimed_at = None
            delivery.error = "No unsubscribe token for this recipient"
            skipped += 1
            continue
        # The subscriber's OWN site decides the domain and the language of the
        # link, not the site whose queue is draining: a parent-site campaign
        # with recipient_scope="self+children" writes its delivery rows under
        # the parent's site_id, so `site_id` here is the sender, while the list
        # being left is the child's.
        subscriber_site = (
            await session.get(Site, subscriber.site_id) if subscriber.site_id is not None else None
        )
        base_url = site_public_base_url(subscriber_site) or app_settings.frontend_url.rstrip("/")
        headers = unsubscribe_headers(one_click_unsubscribe_url(base_url, token))
        # Campaign bodies are authored as HTML (the editor inserts <br> etc.),
        # so send them as HTML with an HTML unsubscribe footer.
        body = _prepare_newsletter_email_body(
            f'{campaign.body}'
            f'<p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #e5dfd4;">'
            f'<a href="{escape(unsubscribe_page_url(base_url, token), quote=True)}">'
            f"{escape(_unsubscribe_label(subscriber_site))}</a></p>",
            base_url,
        )
        # Re-read the day's total immediately before sending, so the ceiling
        # accounts for what the OTHER worker has committed since this batch
        # started. Production runs two uvicorn workers, each with its own loop;
        # both used to read the count once per batch and then count locally, so
        # together they could overshoot `daily_cap` by a whole batch — which is
        # how a provider's hard daily limit gets crossed.
        if cap > 0:
            sent_today = await count_sent_today(session, site_id)
            if sent_today >= cap:
                for unsent in deliveries[deliveries.index(delivery):]:
                    if unsent.status == "sending":
                        unsent.status = "pending"
                        unsent.claimed_at = None
                cap_hit = True
                break
        try:
            if await send_email_async(
                settings, delivery.email, campaign.subject, body, html=True, extra_headers=headers
            ):
                delivery.status = "sent"
                delivery.claimed_at = None
                delivery.sent_at = datetime.now(UTC)
                sent += 1
                sent_today += 1
            else:
                delivery.status = "failed"
                delivery.claimed_at = None
                delivery.error = "Email settings are disabled or incomplete"
                failed += 1
        except Exception as exc:
            delivery.status = "failed"
            delivery.claimed_at = None
            delivery.error = str(exc)
            failed += 1
        # Commit this row's outcome NOW, not with the rest of the batch.
        #
        # The mail has already left. Holding the status in memory until the loop
        # ends means a process that dies mid-batch leaves every row it already
        # delivered sitting in "sending" — and the stale sweep at the top of this
        # function hands those back to "pending", so the next run mails the same
        # people a second time. With a page of 25 that is up to 24 duplicates
        # per crash, to real subscribers. One commit per send costs far less than
        # the SMTP round trip that precedes it.
        await session.commit()
    # Promote fully-drained campaigns to "sent". Without this the campaign status
    # stays "queued" forever even after every delivery has gone out, which is
    # misleading in the admin list.
    #
    # Decided by what is LEFT in the queue, not by what this batch happened to
    # send. The previous rule — promote only the campaigns this batch sent for,
    # and only when the batch drained fewer rows than the page limit — left a
    # campaign stuck in "queued" for good whenever its delivery count was an
    # exact multiple of `limit`: the last full batch sends everything but is
    # `== limit`, so it does not promote, and the next tick finds nothing to
    # send, so there is no campaign to promote either. Reading the queue also
    # makes this self-healing for campaigns already stranded that way, and makes
    # the `cap_hit` guard unnecessary — rows handed back by the cap are
    # `pending` again, so they count as outstanding.
    #
    # A campaign with no successful send stays "queued" so retry-failed remains
    # usable rather than it falsely showing as sent. One consequence is kept as
    # it was: a campaign whose every recipient was skipped also stays "queued",
    # with nothing left to retry.
    drained = (
        await session.execute(
            select(
                NewsletterDelivery.campaign_id,
                func.sum(
                    case((NewsletterDelivery.status.in_(("pending", "sending")), 1), else_=0)
                ).label("outstanding"),
                func.sum(case((NewsletterDelivery.status == "sent", 1), else_=0)).label("delivered"),
            )
            .where(NewsletterDelivery.site_id == site_id)
            .group_by(NewsletterDelivery.campaign_id)
        )
    ).all()
    for campaign_id, outstanding, delivered in drained:
        if outstanding or not delivered:
            continue
        campaign = await session.get(NewsletterCampaign, campaign_id)
        if campaign is not None and campaign.status == "queued":
            campaign.status = "sent"
            campaign.sent_at = datetime.now(UTC)
    await session.commit()
    return {
        "sent": sent,
        "failed": failed,
        "skipped": skipped,
        "cap_hit": cap_hit,
        "sent_today": sent_today,
        "daily_cap": cap,
    }


async def promote_due_scheduled_campaigns(session: AsyncSession) -> list[int]:
    """Flip every campaign whose scheduled_at has passed back to ``queued``.

    The delivery rows were already materialised at /queue time, so promoting
    is just a status flip — process_newsletter_queue() will then pick up
    the pending deliveries on the next site-scoped run.

    Returns the list of site_ids that had at least one campaign promoted, so
    the caller can fan process_newsletter_queue() out to just those sites.
    """
    now = datetime.now(UTC)
    rows = (
        await session.execute(
            select(NewsletterCampaign).where(
                NewsletterCampaign.status == "scheduled",
                NewsletterCampaign.scheduled_at.is_not(None),
                NewsletterCampaign.scheduled_at <= now,
                NewsletterCampaign.deleted_at.is_(None),
            )
        )
    ).scalars().all()
    site_ids: set[int] = set()
    for campaign in rows:
        campaign.status = "queued"
        if campaign.site_id is not None:
            site_ids.add(campaign.site_id)
    if rows:
        await session.commit()
    return sorted(site_ids)


async def sites_with_unsent_deliveries(session: AsyncSession) -> list[int]:
    """Every site that still has newsletter mail waiting to go out.

    `sending` counts as waiting: those are rows a process claimed and did not
    finish, and process_newsletter_queue's stale sweep is what hands them back.
    A site whose only unsent rows are stale claims still has to be visited or
    nothing ever reclaims them.
    """
    rows = (
        await session.execute(
            select(NewsletterDelivery.site_id)
            .where(NewsletterDelivery.status.in_(("pending", "sending")))
            .group_by(NewsletterDelivery.site_id)
        )
    ).all()
    return sorted({row[0] for row in rows if row[0] is not None})


async def tick_scheduled_newsletters(session_factory) -> dict[str, int]:
    """One full sweep: promote due campaigns, then drain the queues.

    `session_factory` is the app SessionLocal. We open a fresh session here
    rather than reusing a request-scoped one because the background loop
    has no request.

    The sweep visits every site with mail waiting, NOT just the sites that had a
    campaign promoted on this tick. Fanning out to only the promoted sites meant
    a scheduled campaign sent one page — 25 recipients — and then stopped: the
    tick that promoted it drained one batch, and every tick afterwards promoted
    nothing, so it had no site to visit and the rest of the list was never
    mailed. `promote_due_scheduled_campaigns` even documents the missing half,
    that the queue will be picked up "on the next site-scoped run"; there was no
    next run to do it.

    OPERATIONAL NOTE: this also means a campaign queued by hand drains on its
    own, instead of waiting for someone to press 立即處理. That is what a queue
    should do, but it changes when mail leaves — so before this reaches
    production, check for campaigns already sitting in `queued` with pending
    deliveries. Those start sending within a minute of deploy.
    """
    promoted_sites: list[int] = []
    draining_sites: list[int] = []
    async with session_factory() as session:
        promoted_sites = await promote_due_scheduled_campaigns(session)
        draining_sites = await sites_with_unsent_deliveries(session)
    sent = failed = skipped = 0
    capped_sites: list[int] = []
    for site_id in sorted(set(promoted_sites) | set(draining_sites)):
        async with session_factory() as session:
            result = await process_newsletter_queue(session, site_id)
            sent += result["sent"]
            failed += result["failed"]
            skipped += result["skipped"]
            if result.get("cap_hit"):
                capped_sites.append(site_id)
    if capped_sites:
        logger.info("Newsletter daily-cap hit for sites: %s", capped_sites)
    return {
        "promoted": len(promoted_sites),
        "drained": len(set(promoted_sites) | set(draining_sites)),
        "sent": sent,
        "failed": failed,
        "skipped": skipped,
        "capped_sites": capped_sites,
    }


async def retry_failed_newsletter_deliveries(session: AsyncSession, site_id: int) -> dict[str, int]:
    deliveries = (
        await session.execute(
            select(NewsletterDelivery)
            .where(NewsletterDelivery.site_id == site_id, NewsletterDelivery.status == "failed")
            .order_by(NewsletterDelivery.id)
        )
    ).scalars().all()
    campaigns: dict[int, NewsletterCampaign | None] = {}
    for delivery in deliveries:
        delivery.status = "pending"
        delivery.error = ""
        delivery.sent_at = None
        if delivery.campaign_id is not None:
            if delivery.campaign_id not in campaigns:
                campaigns[delivery.campaign_id] = await session.get(NewsletterCampaign, delivery.campaign_id)
            campaign = campaigns[delivery.campaign_id]
            if campaign is not None and campaign.site_id == site_id and campaign.deleted_at is None and campaign.status == "sent":
                campaign.status = "queued"
                campaign.sent_at = None
    await session.commit()
    return {"retried": len(deliveries)}

"""
Simple in-memory rate limiter for auth endpoints.

Not a replacement for a production WAF / reverse-proxy rate limiter, but
provides a first line of defence against brute-force attacks on login and
password-reset endpoints.
"""

import time
from collections import defaultdict
from threading import Lock

from fastapi import HTTPException, Request, status


def client_ip(request: Request) -> str | None:
    """The visitor's address, as opposed to the proxy's.

    This app is served behind Cloudflare and nginx, so `request.client.host` is
    the last hop — in production that is the reverse proxy, and every visitor
    looks like the same machine. The rate limiter knew this and read
    `CF-Connecting-IP`; the login audit did not, and recorded the proxy's
    address on every row, which is precisely the field you reach for after a
    suspicious sign-in. One resolver now, so the two cannot drift again.

    The header is trustworthy because CADDY SETS IT, not because it arrived.
    An earlier version of this docstring claimed "only headers set by our own
    edge are trusted" while the code read whatever turned up — and the origin
    answers :443 directly (`auto_https off` with mounted origin certificates),
    so anyone who found the origin address could send a different value on every
    request: every limiter below bypassed, and any address they liked stamped
    into the audit trail of a sign-in.

    The Caddyfile now declares Cloudflare's published ranges as
    `servers > trusted_proxies` and each backend route carries
    `header_up CF-Connecting-IP {client_ip}`. `header_up` overwrites, so what
    the caller sent under this name is discarded: through Cloudflare the value
    is the real visitor, and straight to the origin it is the caller's own
    address, which means an attacker forging one now only rate-limits himself.

    That makes this function's answer only as good as the edge in front of it.
    Read directly — no Caddy, a different proxy, `uvicorn` in development — it
    is back to trusting the caller, which is correct for development and would
    be wrong to rely on anywhere else.

    `X-Forwarded-For` is read solely as its first entry and only when
    Cloudflare's header is absent; behind the config above that never happens,
    and the same caveat applies to it when it does.
    """
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip:
        return cf_ip.strip()
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    return request.client.host if request.client else None


class RateLimiter:
    """Sliding-window counter keyed by client IP.

    In-process and in-memory: each uvicorn worker counts on its own, so the real
    ceiling is `max_requests × workers`. Production runs `--workers 2` (see
    backend/Dockerfile), so **every limit here is effectively double what it
    says** — the login limiter allows 20 attempts a minute, not 10.

    That is a speed bump, not a control. It is deliberately left as one: the
    limits exist to blunt casual abuse of the public forms, and the real defence
    is Cloudflare in front. Anything that must actually hold — a hard cap on
    sign-in attempts, say — needs a shared store (Redis, or a database counter)
    rather than a number in each worker's memory.
    """

    def __init__(self, max_requests: int = 10, window_seconds: int = 60) -> None:
        self.max_requests = max_requests
        self.window = window_seconds
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def _client_key(self, request: Request) -> str:
        return client_ip(request) or "unknown"

    def check(self, request: Request) -> None:
        key = self._client_key(request)
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            # Prune old entries
            cutoff = now - self.window
            hits = [t for t in hits if t > cutoff]
            hits.append(now)
            self._hits[key] = hits
            # Periodically purge stale keys to prevent unbounded growth
            if len(self._hits) > 1000:
                stale = [k for k, v in self._hits.items() if k != key and all(t <= cutoff for t in v)]
                for k in stale:
                    del self._hits[k]
            if len(hits) > self.max_requests:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests. Please try again later.",
                )


# Pre-configured limiters
login_limiter = RateLimiter(max_requests=10, window_seconds=60)
password_reset_limiter = RateLimiter(max_requests=5, window_seconds=60)
public_form_limiter = RateLimiter(max_requests=10, window_seconds=60)
subscribe_limiter = RateLimiter(max_requests=5, window_seconds=60)
# Booking form is the most spam-attractive (free, leads to human follow-up),
# so it gets a tighter ceiling: 3 requests per 5 minutes per IP.
booking_form_limiter = RateLimiter(max_requests=3, window_seconds=300)
# Inquiry form: 5 requests per 5 minutes per IP.
inquiry_form_limiter = RateLimiter(max_requests=5, window_seconds=300)
# Unsubscribe was the one public POST with no ceiling. The token is a 32-byte
# URL-safe random, so guessing one is not the worry; an unthrottled endpoint
# that writes to the database on every hit is. Generous, because a real person
# clicking an unsubscribe link twice must never be told to come back later.
unsubscribe_limiter = RateLimiter(max_requests=20, window_seconds=60)

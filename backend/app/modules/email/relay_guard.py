"""Where a site's SMTP relay is allowed to be.

``smtp_host`` is free text set by anyone holding ``site_users:write`` — which
the site-scoped ``admin`` role has — and the "send a test email" button then
opens a TCP connection to it from the backend. Without a check that is an
outbound connection to any address a semi-trusted tenant names, including the
private network the backend sits in and the cloud metadata endpoint. The reply
is deliberately not echoed back, but a 10-second timeout still separates
"connected" from "refused" from "unreachable", which is all a port scan needs.

So the relay has to be a public mail host: a resolvable name that is not
loopback, private, link-local, or otherwise reserved, on a port mail actually
uses. Development is exempt — a local MailHog on 127.0.0.1:1025 is the normal
way to work on this.
"""

from __future__ import annotations

import ipaddress
import socket

from app.core.config import settings

#: Ports a mail submission agent listens on. 465 is implicit TLS, 587 is
#: submission, 25 is server-to-server, 2525 is the common alternate.
ALLOWED_SMTP_PORTS = frozenset({25, 465, 587, 2525})


class RelayNotAllowed(ValueError):
    """The configured relay is not somewhere this server may connect to."""


def _is_public_address(raw: str) -> bool:
    try:
        address = ipaddress.ip_address(raw)
    except ValueError:
        return False
    return not (
        address.is_private
        or address.is_loopback
        or address.is_link_local
        or address.is_reserved
        or address.is_multicast
        or address.is_unspecified
    )


def check_relay(host: str, port: int) -> None:
    """Raise ``RelayNotAllowed`` if this host/port pair must not be dialled.

    Resolution happens here so a name pointing at 127.0.0.1 or 169.254.169.254
    is rejected as firmly as the literal address would be. A name that does not
    resolve is refused too: it cannot be a working relay, and letting it through
    would leave the check to the connection attempt this exists to prevent.
    """
    host = (host or "").strip()
    if not host:
        raise RelayNotAllowed("SMTP host is empty")

    # The development exemption comes first, port included: MailHog listens on
    # 1025 and Mailpit on 1025 too, so checking the port above this line would
    # have blocked the normal way of working on email locally.
    if settings.app_env != "production":
        return

    if port not in ALLOWED_SMTP_PORTS:
        allowed = ", ".join(str(p) for p in sorted(ALLOWED_SMTP_PORTS))
        raise RelayNotAllowed(f"SMTP port {port} is not a mail port (allowed: {allowed})")

    try:
        resolved = {info[4][0] for info in socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)}
    except socket.gaierror as exc:
        raise RelayNotAllowed(f"SMTP host '{host}' does not resolve") from exc

    # EVERY address it resolves to has to be public: a name with one public and
    # one private A record would otherwise be a way in.
    private = sorted(addr for addr in resolved if not _is_public_address(addr))
    if private:
        raise RelayNotAllowed(
            f"SMTP host '{host}' resolves to a non-public address ({', '.join(private)})"
        )

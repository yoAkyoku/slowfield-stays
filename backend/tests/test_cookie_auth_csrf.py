from starlette.requests import Request
import pytest
from fastapi import HTTPException

from app.modules.auth.routes import _credential_from_request


def request(method="POST", *, origin=None, host="www.slowfield.example", cookie="cookie-token"):
    headers = [(b"host", host.encode())]
    if origin:
        headers.append((b"origin", origin.encode()))
    if cookie:
        headers.append((b"cookie", f"admin-token={cookie}".encode()))
    return Request({"type": "http", "method": method, "scheme": "https", "path": "/api/v1/admin/media", "headers": headers})


def test_bearer_auth_remains_the_first_choice():
    assert _credential_from_request("Bearer header-token", request(origin="https://evil.test")) == "header-token"


def test_same_origin_cookie_can_authorize_a_direct_upload():
    assert _credential_from_request(None, request(origin="https://www.slowfield.example")) == "cookie-token"


@pytest.mark.parametrize("origin", [None, "https://evil.test"])
def test_cookie_authenticated_writes_require_same_origin(origin):
    with pytest.raises(HTTPException) as raised:
        _credential_from_request(None, request(origin=origin))
    assert raised.value.status_code == 403

"""The header and footer button colours must survive the trip to the database.

The site settings form gained two colour pairs — 立即預約 in the header and 訂閱
in the footer — because the single shared 按鈕 colour repainted every ordinary
button on the page as well.

A colour is only useful if it arrives. The payload model, the create path and
the update path each name their fields explicitly, so a field added to the form
and not to all three is accepted by the browser, posted, and silently dropped.
That is the failure this covers: the admin saves, the form comes back showing
the colour, and the site never changes.
"""

from app.modules.admin.routes import SiteCreate


def _payload(**overrides) -> SiteCreate:
    base = dict(
        name="慢域旅遊",
        slug="slowfield",
        primary_color="#2f4638",
        accent_color="#b78b58",
    )
    base.update(overrides)
    return SiteCreate(**base)


def test_the_new_button_colours_are_accepted_by_the_payload() -> None:
    payload = _payload(
        nav_button_bg="#123456",
        nav_button_text="#ffffff",
        footer_button_bg="#654321",
        footer_button_text="#000000",
    )
    assert payload.nav_button_bg == "#123456"
    assert payload.nav_button_text == "#ffffff"
    assert payload.footer_button_bg == "#654321"
    assert payload.footer_button_text == "#000000"


def test_they_default_to_empty_rather_than_to_a_colour() -> None:
    # Empty means "not set", which is what lets the page keep its own default.
    # A default colour here would make every site carry one it never chose —
    # exactly how the old colour swatch filled navBg with the primary colour.
    payload = _payload()
    assert payload.nav_button_bg == ""
    assert payload.nav_button_text == ""
    assert payload.footer_button_bg == ""
    assert payload.footer_button_text == ""


def test_both_write_paths_carry_them_into_theme_config() -> None:
    # Create and update build theme_config separately; a key added to one and
    # not the other is dropped depending on how the site was saved.
    import inspect

    from app.modules.admin import routes

    source = inspect.getsource(routes)
    for key in ("navButtonBg", "navButtonText", "footerButtonBg", "footerButtonText"):
        assert source.count(f'"{key}": payload.') == 2, (
            f"{key} reaches theme_config on only one of the create/update paths"
        )

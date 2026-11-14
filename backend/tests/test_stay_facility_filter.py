"""The 服務設施 search filter.

Regression cover for a filter that silently returned nothing. The search bar
offers canonical values (戲水池, KTV…) while a villa's `amenities` is the copy
the client writes for the villa page ("14 米中庭泳池 · Courtyard Pool"). Matching
one against the other found nothing, for every option, without any error — so
the only symptom was an empty result page.
"""

from app.modules.stays.routes import matches_any_facility
from app.modules.stays.schemas import StayRead


def _stay(*, amenities: list[str], facilities: list[str]) -> StayRead:
    return StayRead(
        id=1,
        slug="hejing",
        name="禾境",
        destination="宜蘭",
        region="冬山",
        summary="",
        story="",
        hero_image_url="",
        base_price=0,
        max_guests=8,
        tags=[],
        amenities=amenities,
        facilities=facilities,
        room_types=[],
        images=[],
        seo={},
    )


def test_ticked_facility_matches() -> None:
    stay = _stay(amenities=["14 米中庭泳池 · Courtyard Pool"], facilities=["戲水池"])

    assert matches_any_facility(stay, ["戲水池"]) is True


def test_display_copy_still_matches_as_substring() -> None:
    """A villa with no ticked facilities stays findable through its own copy."""
    stay = _stay(amenities=["戲院級 KTV · KTV"], facilities=[])

    assert matches_any_facility(stay, ["ktv"]) is True


def test_prose_copy_alone_does_not_match_a_different_facility() -> None:
    """The case that was broken in production: poetic copy, no ticked value."""
    stay = _stay(amenities=["14 米中庭泳池 · Courtyard Pool"], facilities=[])

    assert matches_any_facility(stay, ["戲水池"]) is False


def test_multi_select_is_or_not_and() -> None:
    stay = _stay(amenities=[], facilities=["KTV"])

    assert matches_any_facility(stay, ["戲水池", "ktv"]) is True


def test_no_facilities_and_no_matching_copy() -> None:
    stay = _stay(amenities=["管家服務"], facilities=[])

    assert matches_any_facility(stay, ["戲水池"]) is False

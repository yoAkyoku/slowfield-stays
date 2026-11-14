from pydantic import BaseModel


class RoomTypeRead(BaseModel):
    name: str
    description: str
    price: int
    capacity: int


class StayImageRead(BaseModel):
    image_url: str
    alt_text: str
    sort_order: int


class StayRead(BaseModel):
    id: int
    slug: str
    name: str
    destination: str
    region: str
    summary: str
    story: str
    hero_image_url: str
    booking_url: str = ""
    base_price: int
    max_guests: int
    sort_order: int = 0
    tags: list[str]
    amenities: list[str]
    facilities: list[str] = []
    experiences: list[str] = []
    room_types: list[RoomTypeRead]
    images: list[StayImageRead]
    seo: dict
    detail_config: dict = {}
    faq: list[dict] = []
    house_rules: list[str] = []
    location_config: dict = {}
    social_links: dict = {}
    related_content_ids: list[int] = []
    translations: dict = {}


class StaySearchParams(BaseModel):
    destination: str | None = None
    guests: int | None = None
    tag: str | None = None


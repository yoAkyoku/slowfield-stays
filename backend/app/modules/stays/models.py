from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Stay(Base):
    __tablename__ = "stays"
    __table_args__ = (UniqueConstraint("site_id", "slug", name="uq_stays_site_slug"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    site_id: Mapped[int | None] = mapped_column(ForeignKey("sites.id"), nullable=True, index=True)
    slug: Mapped[str] = mapped_column(String(160), index=True)
    name: Mapped[str] = mapped_column(String(180))
    destination: Mapped[str] = mapped_column(String(120))
    region: Mapped[str] = mapped_column(String(120))
    summary: Mapped[str] = mapped_column(Text)
    story: Mapped[str] = mapped_column(Text, default="")
    hero_image_url: Mapped[str] = mapped_column(String(500))
    booking_url: Mapped[str] = mapped_column(String(500), default="")
    base_price: Mapped[int] = mapped_column(Integer)
    max_guests: Mapped[int] = mapped_column(Integer)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(40), default="draft")
    seo: Mapped[dict] = mapped_column(JSON, default=dict)
    detail_config: Mapped[dict] = mapped_column(JSON, default=dict)
    faq: Mapped[list] = mapped_column(JSON, default=list)
    house_rules: Mapped[list] = mapped_column(JSON, default=list)
    location_config: Mapped[dict] = mapped_column(JSON, default=dict)
    social_links: Mapped[dict] = mapped_column(JSON, default=dict)
    tags: Mapped[list] = mapped_column(JSON, default=list)
    # Canonical facility values ticked from the site's search list. Separate
    # from `amenities`, which is display copy the client writes freely ("14 米
    # 中庭泳池") — one field could not be both a searchable vocabulary and
    # marketing prose, and trying made the facility filter match nothing.
    facilities: Mapped[list] = mapped_column(JSON, default=list)
    # Canonical 慢域體驗 values assigned from the site's managed search list.
    # Kept separate from tags so editorial labels do not silently become
    # booking filters (or disappear when a tag is renamed).
    experiences: Mapped[list] = mapped_column(JSON, default=list)
    related_content_ids: Mapped[list] = mapped_column(JSON, default=list)
    translations: Mapped[dict] = mapped_column(JSON, default=dict)
    published_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)

    amenities: Mapped[list["Amenity"]] = relationship(cascade="all, delete-orphan")
    room_types: Mapped[list["RoomType"]] = relationship(cascade="all, delete-orphan")
    images: Mapped[list["StayImage"]] = relationship(cascade="all, delete-orphan")


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True)


class Amenity(Base):
    __tablename__ = "amenities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    stay_id: Mapped[int] = mapped_column(ForeignKey("stays.id"))
    name: Mapped[str] = mapped_column(String(120))


class RoomType(Base):
    __tablename__ = "room_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    stay_id: Mapped[int] = mapped_column(ForeignKey("stays.id"))
    name: Mapped[str] = mapped_column(String(140))
    description: Mapped[str] = mapped_column(Text, default="")
    price: Mapped[int] = mapped_column(Integer)
    capacity: Mapped[int] = mapped_column(Integer)


class StayImage(Base):
    __tablename__ = "stay_images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    stay_id: Mapped[int] = mapped_column(ForeignKey("stays.id"))
    image_url: Mapped[str] = mapped_column(String(500))
    alt_text: Mapped[str] = mapped_column(String(180), default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

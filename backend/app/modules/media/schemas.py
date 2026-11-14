from datetime import datetime

from pydantic import BaseModel, Field


class MediaAssetRead(BaseModel):
    id: int
    url: str
    alt_text: str
    mime_type: str
    storage_key: str
    display_name: str
    poster_url: str
    created_at: datetime


class MediaAssetRename(BaseModel):
    display_name: str = Field(min_length=1, max_length=260)


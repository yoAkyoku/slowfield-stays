"""Rename exact topic tokens in one site's articles and selection settings."""
from copy import deepcopy
import re
from sqlalchemy import select
from app.modules.cms.models import Page, ContentTag


async def rename_tag_references(session, site, old, new):
    aliases = {str(value).strip().casefold() for value in old.values() if value}
    # Shared legacy names cannot identify which tag the article meant.
    others = (await session.execute(select(ContentTag).where(ContentTag.site_id == site.id))).scalars().all()
    shared = {str(value).strip().casefold() for tag in others if tag.slug != old.get("slug")
              for value in (tag.slug, tag.name_zh, tag.name_en) if value}
    aliases -= shared

    def rewrite(raw, locale):
        values = raw if isinstance(raw, list) else re.split(r"[,，、\n]", raw) if isinstance(raw, str) else []
        if not any(str(value).strip().casefold() in aliases for value in values):
            return raw
        def token(value):
            text = str(value).strip()
            if text.casefold() not in aliases:
                return text
            if text == old.get("slug"):
                return new["slug"]
            return new.get(locale) or new["zh"]
        updated = list(dict.fromkeys(token(value) for value in values if str(value).strip()))
        return updated if isinstance(raw, list) else ", ".join(updated)

    pages = (await session.execute(select(Page).where(Page.site_id == site.id))).scalars().all()
    for page in pages:
        page.tags = rewrite(page.tags, site.default_locale)
        translations = deepcopy(page.translations or {})
        for locale, fields in translations.items():
            if isinstance(fields, dict):
                for key in ("tags", "card_tags"):
                    if key in fields:
                        fields[key] = rewrite(fields[key], locale)
        if translations != page.translations:
            page.translations = translations

    def walk(value, locale="zh"):
        if isinstance(value, list):
            return [walk(item, locale) for item in value]
        if not isinstance(value, dict):
            return value
        result = deepcopy(value)
        for key, item in value.items():
            if key in ("filter_tags", "filter_tag"):
                result[key] = rewrite(item, locale)
            elif key == "sub_tabs" and isinstance(item, list):
                tabs = deepcopy(item)
                for tab in tabs:
                    if not isinstance(tab, dict):
                        continue
                    for field in ("tag", "label"):
                        if field in tab:
                            raw = tab[field]
                            tab[field] = {lang: rewrite(text, lang) for lang, text in raw.items()} if isinstance(raw, dict) else rewrite(raw, locale)
                result[key] = tabs
            elif key == "picked_tags" and value.get("filter_by") != "category" and not value.get("extra_sources"):
                result[key] = rewrite(item, locale)
            else:
                result[key] = walk(item, key if key in ("zh", "en") else locale)
        return result
    settings = walk(site.settings or {}, site.default_locale)
    if settings != site.settings:
        site.settings = settings

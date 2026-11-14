"""Independent editorial categories, with a compatibility fallback for legacy listings."""
from copy import deepcopy
import re

DEFAULT_NAMES = {"brand":"品牌介紹", "stays":"精選住宿", "curation":"慢域選品", "blog":"部落格", "dining":"餐飲服務", "activity":"精選活動", "experience":"慢域體驗", "journal":"旅遊專欄", "service":"服務項目", "news":"慢域消息", "contact":"聯繫我們", "media":"媒體報導", "pr":"PR 聯絡", "career":"人才招募", "franchise":"民宿加盟"}

LEGACY_KEYS = {"brand", "stays", "curation", "blog", "dining", "activity", "experience", "journal", "service", "news", "contact", "media", "pr", "career", "franchise"}


def _page_sources(key: str, cfg: dict) -> list[str]:
    """Return article sources using the same fallback as the public category page."""
    configured = cfg.get("article_categories")
    if isinstance(configured, list):
        raw_sources = configured
    elif cfg.get("show_cms_list") is False:
        return []
    else:
        extras = cfg.get("extra_content_types")
        raw_sources = [cfg.get("content_type") or key, *(extras if isinstance(extras, list) else [])]
    return list(dict.fromkeys(value.strip() for value in raw_sources if isinstance(value, str) and value.strip()))


def category_registry(settings: dict | None, root: bool = True) -> dict:
    """Resolve stored categories plus legacy categories referenced by listing pages.

    Inferred entries exist only in this response value; reading site settings does
    not persist any changes. Existing registry values keep their labels/status.
    """
    settings = settings or {}
    stored = settings.get("article_categories")
    result = deepcopy(stored) if isinstance(stored, dict) else {}
    raw_pages = settings.get("pages")
    pages = raw_pages if isinstance(raw_pages, dict) else {}
    for page_key, cfg in pages.items():
        if not isinstance(cfg, dict) or page_key == "homepage" or cfg.get("deleted"):
            continue
        sources = _page_sources(page_key, cfg)
        if not sources:
            continue
        configured = isinstance(cfg.get("article_categories"), list)
        explicit_listing = cfg.get("page_type") == "cms_list"
        if page_key in {"contact", "stays", "privacy"}:
            continue
        if not (configured or explicit_listing or root):
            continue
        for content_type in sources:
            if content_type in result:
                continue
            if not configured and not explicit_listing and content_type not in LEGACY_KEYS:
                continue
            if not re.fullmatch(r"[a-z][a-z0-9_-]{0,39}", content_type):
                continue
            category_page = pages.get(content_type)
            label = category_page.get("label") if isinstance(category_page, dict) else None
            if not label and content_type == (cfg.get("content_type") or page_key):
                label = cfg.get("label")
            if not label:
                label = {"zh": DEFAULT_NAMES.get(content_type, content_type), "en": content_type}
            if isinstance(label, str):
                label = {"zh": label, "en": label}
            sort_source = category_page if isinstance(category_page, dict) else cfg
            result[content_type] = {
                "label": label,
                "status": "active",
                "sort_order": sort_source.get("sort_order", 99),
            }
    return result


def preserve_registry(stored: dict | None, incoming: dict | None, root: bool = True) -> dict:
    result = deepcopy(incoming or {})
    # General page/settings saves must never implicitly add, rename or delete categories.
    result["article_categories"] = category_registry(stored, root)
    return result

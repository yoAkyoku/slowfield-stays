import type { Page } from "./api";
import type { Locale } from "./i18n";

/** Resolve the admin's per-locale sub_tabs config ({label:{zh,en}, tag:{zh,en}})
 *  into the flat {label, tag} the filter row consumes. Returns undefined when
 *  nothing is configured, so the row falls back to every live tag. Lives here,
 *  not in the "use client" ContentFacets, so server components can call it. */
export function resolveSubTabs(
  raw: unknown,
  locale: Locale,
): Array<{ label: string; tag: string }> | undefined {
  if (!Array.isArray(raw)) return undefined;
  const other: Locale = locale === "zh" ? "en" : "zh";
  const pick = (v: unknown): string => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const o = v as Record<string, string>;
      return (o[locale] || o[other] || "").trim();
    }
    return typeof v === "string" ? v.trim() : "";
  };
  const list = (raw as unknown[])
    // Coerce each element: legacy/hand-edited sub_tabs can hold a null or a bare
    // string, and this runs in a server component — a throw here would take down
    // the whole category page, not just the tab row.
    .map((raw) => {
      const st = (raw ?? {}) as Record<string, unknown>;
      return { tag: pick(st.tag), label: pick(st.label) || pick(st.tag) };
    })
    .filter((st) => st.tag);
  return list.length ? list : undefined;
}

export const CONTENT_TYPE_TO_CATEGORY: Record<string, string> = {
  brand: "brand",
  dining: "dining",
  activity: "activities",
  journal: "journal",
  media: "media-coverage",
  pr: "pr",
  career: "careers",
  franchise: "franchise",
  page: "page",
  experience: "experience",
  privacy: "privacy",
  news: "news",
  service: "services",
  /* 慢域選品. The page key existed in the page manager but never here, so a
     curation entry fell through to the "page" default and its links pointed at
     /page/{slug} instead of /curation/{slug}. Invisible while the section was
     empty; wrong for every entry the moment one is published. */
  curation: "curation"
};

/** The inverse, derived rather than written out again: the two were maintained
    by hand on both sides of the API, four tables that had to agree. */
export const CATEGORY_TO_CONTENT_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(CONTENT_TYPE_TO_CATEGORY).map(([type, category]) => [category, type])
);

export function contentCategoryFromType(contentType?: string | null) {
  return CONTENT_TYPE_TO_CATEGORY[contentType ?? "page"] ?? "page";
}

/**
 * @param staySlug Set on a villa (child) site. The bare `/news/…` route belongs
 *   to the parent — the two share a domain, so a villa's own entry resolved
 *   against the parent and 404'd, and anything that did resolve rendered in the
 *   parent's chrome. Under `/stays/{slug}/…` the villa keeps its own header,
 *   footer and content.
 */
export function contentIndexHref(contentType?: string | null, staySlug?: string) {
  const category = contentCategoryFromType(contentType);
  return staySlug ? `/stays/${staySlug}/${category}` : `/${category}`;
}

export function buildContentHref(
  page: Pick<Page, "id" | "slug"> & { content_type?: string | null; _staySlug?: string },
  staySlug?: string,
) {
  const category = contentCategoryFromType(page.content_type);
  const identifier = page.slug || String(page.id);
  // An entry aggregated onto the parent from a child site carries its own slug,
  // so it links to that child's page rather than a parent URL that does not exist.
  const slug = page._staySlug ?? staySlug;
  return slug ? `/stays/${slug}/${category}/${identifier}` : `/${category}/${identifier}`;
}

/** Resolve the article categories rendered by a site page.
 *  Explicit arrays, including [], are authoritative. For older page settings,
 *  the public renderer falls back to content_type/page key until explicitly off.
 */
export function listingCategoriesForPage(pageKey: string, config: Record<string, unknown>): string[] {
  if (["homepage", "contact", "stays", "privacy"].includes(pageKey) || config.deleted === true || config.show_cms_list === false) return [];
  const configured = config.article_categories;
  const extra = Array.isArray(config.extra_content_types) ? config.extra_content_types : [];
  const sources = Array.isArray(configured)
    ? configured
    : [config.content_type || pageKey, ...extra];
  return Array.from(new Set(sources
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)));
}

/** Find a public listing configured for a category without changing article URLs. */
export function listingIndexHref(site: {settings?: Record<string, unknown> | null}, contentType?: string | null, staySlug?: string) {
 const pages=(site.settings?.pages ?? {}) as Record<string,Record<string,unknown>>;
 const match=Object.entries(pages).find(([key,cfg]) => listingCategoriesForPage(key,cfg).includes(String(contentType ?? "")));
 return match ? (staySlug ? `/stays/${staySlug}/${match[0]}` : `/${match[0]}`) : contentIndexHref(contentType,staySlug);
}
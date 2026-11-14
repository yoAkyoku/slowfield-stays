import type { AdminSite } from "./adminApi";
import { ROOT_PAGES, pageLabel, pageSort } from "../../modules/contentTypes";

export type SiteContentType = { key: string; pageKey?: string; label: { zh: string; en: string } };

const ROOT_CONTENT_TYPES = new Set(ROOT_PAGES.map((page) => page.key));
const ROOT_LABELS = new Map(ROOT_PAGES.map((page) => [page.key, { zh: page.zh, en: page.en }]));

function isRootSite(site: AdminSite) {
  return site.parent_site_id == null;
}

function contentTypeFor(key: string, cfg: Record<string, unknown>) {
  return typeof cfg.content_type === "string" && cfg.content_type.trim() ? cfg.content_type.trim() : key;
}

/**
 * A site page is a CMS category only when it is a list page. The parent site
 * predates `page_type`, so its known canonical content types remain eligible
 * when that field is absent. Child/property sites must opt in explicitly;
 * this keeps block pages and property slugs out of the shared article picker.
 */
function isManagedCategory(site: AdminSite, key: string, cfg: Record<string, unknown>, contentType: string) {
  if (key === "homepage" || cfg.deleted === true) return false;
  if (cfg.page_type === "blocks") return false;
  if (cfg.page_type === "cms_list") {
    return ROOT_CONTENT_TYPES.has(contentType);
  }
  // Legacy pages with blocks already have a layout; only explicit CMS lists can also use blocks.
  if (Array.isArray(cfg.blocks)) return false;
  return isRootSite(site) && ROOT_CONTENT_TYPES.has(contentType);
}

/**
 * Derive the CMS category list from a site's settings.pages.
 * Pages with page_type "cms_list" become categories the editor can target.
 * Falls back to the page key itself if no label is configured.
 */
export function siteContentTypesFromConfig(site: AdminSite | undefined | null): SiteContentType[] {
  if (!site) return [];
  const registry = (site.settings as Record<string, unknown> | undefined)?.article_categories;
  if (registry && typeof registry === "object" && !Array.isArray(registry)) {
    const pages = (site.settings?.pages ?? {}) as Record<string, Record<string, unknown>>;
    return Object.entries(registry as Record<string, {label?: {zh?: string; en?: string}; status?: string; sort_order?: number}>)
      .filter(([, cfg]) => cfg.status !== "archived")
      .sort((a,b) => (a[1].sort_order ?? 99) - (b[1].sort_order ?? 99))
      .map(([key,cfg]) => ({key, pageKey: Object.entries(pages).find(([,page]) => !page.deleted && (page.content_type === key || (Array.isArray(page.extra_content_types) && page.extra_content_types.includes(key))))?.[0], label: {zh: cfg.label?.zh || key, en: cfg.label?.en || cfg.label?.zh || key}}));
  }

  const pages = ((site.settings as Record<string, unknown> | undefined)?.pages ?? {}) as Record<string, Record<string, unknown>>;
  const entries = new Map<string, { ct: SiteContentType; sort: number }>();
  for (const [key, cfg] of Object.entries(pages)) {
    if (!cfg) continue;
    const ct = contentTypeFor(key, cfg);
    if (!isManagedCategory(site, key, cfg, ct)) continue;

    const configured = pageLabel(key, cfg.label, "zh");
    const configuredEn = pageLabel(key, cfg.label, "en");
    const fallback = ROOT_LABELS.get(ct);
    const entry = {
      ct: {
        key: ct,
        pageKey: key,
        label: {
          zh: configured === key ? fallback?.zh ?? "未命名分類" : configured,
          en: configuredEn === key ? fallback?.en ?? "Unlabelled category" : configuredEn,
        },
      },
      sort: pageSort(key, cfg),
    };
    const existing = entries.get(ct);
    if (!existing || entry.sort < existing.sort) entries.set(ct, entry);
  }
  return Array.from(entries.values())
    .sort((a, b) => a.sort - b.sort || a.ct.key.localeCompare(b.ct.key))
    .map((entry) => entry.ct);
}

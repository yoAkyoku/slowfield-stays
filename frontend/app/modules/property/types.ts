import type { Locale } from "../i18n";

export type NavItem = {
  key: string;
  label: { en: string; zh: string } | string;
  enabled: boolean;
};

export type BookingConfig = {
  phone?: string;
  line?: string;
  cta_label?: { en: string; zh: string } | string;
  cta_href?: string;
};

export type PropertyBlock = {
  id: string;
  type: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
};

export type PropertyPageConfig = {
  /** Display label (bilingual or plain string) */
  label?: string | { en: string; zh: string };
  /** Page type: "blocks" renders block content, "cms_list" renders CMS pages */
  page_type?: "blocks" | "cms_list";
  /** CMS content_type filter (only for page_type="cms_list", e.g. "news", "journal") */
  content_type?: string;
  /** Extra content_types folded into this list, so one page can carry several
   *  categories (e.g. news + media). Mirrors a stays block's extra_sources. */
  extra_content_types?: string[];
  /** Block content for block-based pages */
  blocks?: PropertyBlock[];
  /** SEO metadata */
  seo?: Record<string, unknown>;
  /** Sort order for page listing */
  sort_order?: number;
  /** Page visibility — false hides from nav and 404s the route */
  visible?: boolean;
  /** Hide this page from the header nav (route still works) */
  nav_hidden?: boolean;
  /** Hide this page from the footer nav (route still works) */
  footer_hidden?: boolean;
  /** Tombstone for a deleted default page. Treated the same as visible:false but conceptually different (user-initiated removal). */
  deleted?: boolean;
  /** Page-level hero image URL */
  hero_image?: string;
  /** Page-level hero title (bilingual) */
  hero_title?: Record<string, string>;
  /** Page-level hero subtitle (bilingual) */
  hero_subtitle?: Record<string, string>;
  /** Hero title color (hex) */
  hero_title_color?: string;
  /** Hero subtitle color (hex) */
  hero_subtitle_color?: string;
  /** Hero height preset: "small" | "medium" | "large" | "full" */
  hero_height?: string;
  /** Hero mask colour (hex). Sanitised at render — it lands in a style attribute. */
  hero_mask_color?: string;
  /** Hero mask strength, 0-100. Empty string means never configured, which is
   *  not the same as an explicit 0. */
  hero_mask_opacity?: number | string;
  /** 大標／小標／CTA alignment. Offered by the page editor for every managed
   *  page; the villa hero had no reader for it, so it saved and did nothing. */
  hero_align?: string;
  /** Nav link mode: "page" (default, routes to /stays/{slug}/{key}) or "anchor"
   *  (scrolls to a homepage block via #tag). */
  link_mode?: "page" | "anchor";
  /** When link_mode === "anchor", the homepage block tag to scroll to (the block's
   *  config.anchor set in the homepage editor). */
  anchor?: string;
};

/** Default pages for a new property site (template) */
export const DEFAULT_PROPERTY_PAGES: Record<string, PropertyPageConfig> = {
  news:       { label: { en: "News",       zh: "最新活動" }, page_type: "cms_list", content_type: "news",    sort_order: 0 },
  about:      { label: { en: "About",      zh: "關於品牌" }, page_type: "blocks",                           sort_order: 1 },
  space:      { label: { en: "Space",      zh: "空間設計" }, page_type: "blocks",                           sort_order: 2 },
  experience: { label: { en: "Experience", zh: "體驗設施" }, page_type: "blocks",                           sort_order: 3 },
  pricing:    { label: { en: "Pricing",    zh: "收費須知" }, page_type: "blocks",                           sort_order: 4 },
  contact:    { label: { en: "Contact",    zh: "交通聯繫" }, page_type: "blocks",                           sort_order: 5 },
  faq:        { label: { en: "FAQ",        zh: "入住須知" }, page_type: "blocks",                           sort_order: 6 },
  articles:   { label: { en: "Articles",   zh: "旅誌" },    page_type: "cms_list", content_type: "journal", sort_order: 7 },
};

/** A page config is "live" when it isn't tombstoned and not explicitly hidden. */
export function isLivePage(cfg: PropertyPageConfig | undefined | null): boolean {
  if (!cfg) return true; // unknown key — defer to caller (route 404 / nav skip)
  if (cfg.deleted === true) return false;
  if (cfg.visible === false) return false;
  return true;
}

/** Keys that are structurally reserved and must never render as a nav sub-page:
 *  "homepage" is the site root (slug "/"), used only as a display row in the admin
 *  page manager — if it leaks into settings.pages it would link to a dead /homepage. */
const RESERVED_PAGE_KEYS = new Set(["homepage"]);

/** A page is not tombstoned (soft-deleted). */
function isNotDeleted(cfg: PropertyPageConfig | undefined | null): boolean {
  if (!cfg) return true;
  return cfg.deleted !== true;
}

/** Build header nav from pages config — sorted by sort_order, drops tombstones and nav_hidden entries. */
export function buildNavFromPages(pages: Record<string, PropertyPageConfig>): NavItem[] {
  return Object.entries(pages)
    .filter(([key, cfg]) => !RESERVED_PAGE_KEYS.has(key) && isNotDeleted(cfg) && cfg?.nav_hidden !== true)
    .sort(([, a], [, b]) => (a?.sort_order ?? 99) - (b?.sort_order ?? 99))
    .map(([key, cfg]) => ({
      key,
      label: cfg?.label ?? key,
      enabled: true,
    }));
}

/**
 * The villa sub-pages a sitemap should list, in nav order.
 *
 * The sitemap used to carry its own hardcoded copy of the eight default page
 * keys, which is wrong in both directions once a villa is edited: a page the
 * client added was never submitted, and a default page they deleted was
 * submitted as a URL that 404s. No new rule here, just the three the site
 * already applies: a tombstone or visible:false means the page is gone
 * (isLivePage, the same test the routes use), and nav_hidden means the site
 * itself never links to it, so it does not belong in a list of the site's
 * addresses either.
 */
export function sitemapPageKeys(pages: Record<string, PropertyPageConfig>): string[] {
  return Object.entries(pages)
    .filter(([key, cfg]) => !RESERVED_PAGE_KEYS.has(key) && isLivePage(cfg) && cfg?.nav_hidden !== true)
    .sort(([, a], [, b]) => (a?.sort_order ?? 99) - (b?.sort_order ?? 99))
    .map(([key]) => key);
}

/** Build footer nav — drops tombstones and footer_hidden entries. */
export function buildFooterNavFromPages(pages: Record<string, PropertyPageConfig>): NavItem[] {
  return Object.entries(pages)
    .filter(([key, cfg]) => !RESERVED_PAGE_KEYS.has(key) && isNotDeleted(cfg) && cfg?.footer_hidden !== true)
    .sort(([, a], [, b]) => (a?.sort_order ?? 99) - (b?.sort_order ?? 99))
    .map(([key, cfg]) => ({
      key,
      label: cfg?.label ?? key,
      enabled: true,
    }));
}

/** The footer menu: the pages with FOOTER on, in sort order.
 *
 *  Falls back to the header nav when no page opts in. Every villa is in that
 *  state today — the footer had been rendering the header nav and ignoring the
 *  flag entirely, so nobody ever had a reason to turn one on, and honouring it
 *  literally would empty the footer on sites that look fine. The fallback keeps
 *  the menu, and the toggle starts working the moment a single page opts in. */
export function buildFooterNav(
  nav: NavItem[],
  pages: Record<string, PropertyPageConfig>,
): NavItem[] {
  const opted = buildFooterNavFromPages(pages);
  return opted.length ? opted : nav;
}

/** Check if a page is visible (respects both NavItem.enabled and page-level flags). */
export function isPageVisible(
  pageKey: string,
  nav: NavItem[],
  pages: Record<string, PropertyPageConfig>,
): boolean {
  const navItem = nav.find((item) => item.key === pageKey);
  if (navItem && !navItem.enabled) return false;
  return isLivePage(pages[pageKey]);
}

/** Default nav derived from default pages */
export const DEFAULT_PROPERTY_NAV: NavItem[] = buildNavFromPages(DEFAULT_PROPERTY_PAGES);

/** Resolve page label for display */
export function pageLabel(
  pageKey: string,
  pages: Record<string, PropertyPageConfig>,
  locale: Locale,
): string {
  const cfg = pages[pageKey];
  const fallback = DEFAULT_PROPERTY_PAGES[pageKey]?.label;
  const defaultName = typeof fallback === "string" ? fallback : fallback?.[locale];
  if (!cfg?.label) return defaultName || pageKey;
  if (typeof cfg.label === "string") return cfg.label || defaultName || pageKey;
  const other: Locale = locale === "zh" ? "en" : "zh";
  return cfg.label[locale] || cfg.label[other] || defaultName || pageKey;
}

/**
 * The nav label in this locale, borrowing the other language before it gives up.
 *
 * `label.en ?? key` meant an English visitor to a villa whose labels were only
 * ever filled in Chinese got a nav of bare URL slugs — `stays / about /
 * experience` — which is worse than the Chinese would have been, and looks like
 * the page is broken rather than untranslated.
 */
export function navLabel(item: NavItem, locale: Locale): string {
  if (typeof item.label === "string") return item.label;
  const other: Locale = locale === "zh" ? "en" : "zh";
  return item.label[locale] || item.label[other] || item.key;
}

export function bookingLabel(booking: BookingConfig, locale: Locale): string {
  const fallback = locale === "zh" ? "立即預約" : "Book Now";
  if (!booking.cta_label) return fallback;
  if (typeof booking.cta_label === "string") return booking.cta_label;
  // Same borrow as navLabel, and the same reason. The old default was "Book
  // Now" in both languages, so a zh-only label also lost the Chinese default.
  const other: Locale = locale === "zh" ? "en" : "zh";
  return booking.cta_label[locale] || booking.cta_label[other] || fallback;
}

/** Resolve bilingual site name from settings.name_translations, falling back to site.name */
export function resolveSiteName(site: { name: string; settings?: Record<string, unknown> | null }, locale: string): string {
  const nt = site.settings?.name_translations as Record<string, string> | undefined;
  return nt?.[locale] || site.name;
}

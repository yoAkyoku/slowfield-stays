import { labelLadder } from "./tr";
/**
 * The group site's main navigation: which pages appear, what they are called,
 * what order they sit in, and which of them are pinned to the top bar.
 *
 * This used to live inside `app/(site)/layout.tsx`, where it could only be
 * checked by reading the file. 聯絡我們 has now been asked for in the main nav
 * twice and been invisible twice — once because it fell off the right-hand end
 * of the bar, once because the progressive-hide ladder dropped it — so the
 * rules that decide its position are worth exercising directly.
 */

export interface SiteNavLink {
  key: string;
  href: string;
  label: string;
  /** Which footer column: "explore" | "stories" | "connect" */
  group: "explore" | "stories" | "connect";
  sort: number;
  /** Show in the top header bar. */
  pinned?: boolean;
  /** Admin "NAV" toggle — hide from the header and its menu. */
  navHidden?: boolean;
  /** Admin "FOOTER" toggle — hide from the footer. Independent of navHidden,
      so a page can appear in one without the other. */
  footerHidden?: boolean;
}

/* ── Page key → URL slug mapping ── */

const KEY_TO_SLUG: Record<string, string> = {
  activity:  "activities",
  service:   "services",
  career:    "careers",
  media:     "media-coverage",
};

export function pageHref(key: string): string {
  return `/${KEY_TO_SLUG[key] || key}`;
}

/* A nav item points at its own page by default, or scrolls to a homepage
   block via #tag when the page is set to 錨點 in the editor. The villa
   header has honoured this all along (PropertyHeader); the group nav built
   its href unconditionally from the key, so on the parent the setting saved
   and the link still went to the sub-page — often an empty stub. */
export function navHref(key: string, cfg: Record<string, unknown> | undefined): string {
  const mode = cfg?.link_mode;
  const anchor = typeof cfg?.anchor === "string" ? cfg.anchor.trim() : "";
  /* Same shape the villa builds, and an anchor is a fragment on our own
     page — it can never become an off-site or javascript: destination. */
  if (mode === "anchor" && anchor) return `/#${anchor}`;
  return pageHref(key);
}

/* ── Default nav group assignment ── */

const DEFAULT_GROUP: Record<string, SiteNavLink["group"]> = {
  stays:      "explore",
  dining:     "explore",
  activity:   "explore",
  news:       "explore",
  service:    "explore",
  brand:      "stories",
  experience: "stories",
  journal:    "stories",
  contact:    "connect",
  franchise:  "connect",
  pr:         "connect",
  media:      "connect",
  career:     "connect",
};

/** Default labels when page management has no label set */
export const DEFAULT_LABELS: Record<string, [string, string]> = {
  stays:      ["精選住宿", "Stays"],
  brand:      ["品牌介紹", "Brand"],
  dining:     ["餐飲服務", "Dining"],
  activity:   ["精選活動", "Activities"],
  experience: ["慢域體驗", "Experience"],
  journal:    ["旅遊專欄", "Journal"],
  news:       ["慢域消息", "News"],
  service:    ["服務項目", "Services"],
  /* 聯絡我們, not 聯繫我們. The client named this link twice, both times as
     聯絡我們, and the parent site only reads that way because someone typed it
     into page management by hand — every other site fell back to the other
     wording. The bundled default is what a new site starts with, so it is the
     one that has to match. */
  contact:    ["聯絡我們", "Contact"],
  franchise:  ["民宿加盟", "Franchise"],
  pr:         ["PR 聯絡", "PR"],
  media:      ["媒體報導", "Media"],
  career:     ["人才招募", "Careers"],
  privacy:    ["隱私政策", "Privacy"],
};

/** The order a page takes when page management has not set `sort_order`. */
export const FALLBACK_SORT = 50;

/* 聯絡我們 belongs at the end of the bar — 客戶: 主選單中「旅遊專欄」右側增加
   「聯絡我們」. Every page shares one fallback sort, so ties were broken
   alphabetically, and "contact" sorts before "journal": on any site whose page
   management had not been reordered by hand the link landed near the front of
   the nav instead of after 旅遊專欄. The parent looked right only because its
   pages carry explicit sort_orders. A page's own sort_order still wins. */
export const DEFAULT_SORT: Record<string, number> = {
  contact: 90,
};

/** Default pinned keys (shown in top header bar).
 *  contact is pinned by default (客戶: 旅遊專欄右側還要再加一行聯絡我們) — it was
 *  reachable only from inside the menu, which is the one link a visitor comes
 *  looking for. A per-page nav_pinned setting still overrides this. */
const DEFAULT_PINNED = new Set(["stays", "activity", "journal", "contact"]);

/**
 * Build ordered SiteNavLink[] from site.settings.pages.
 * Each page can override: label, sort_order, nav_group, pinned.
 */
export function buildNavLinks(
  site: { settings?: Record<string, unknown> | null },
  locale: string,
  cmsVisibleTypes: Set<string>,
): SiteNavLink[] {
  const pagesConfig = (site.settings?.pages ?? {}) as Record<string, Record<string, unknown>>;

  // Collect all known page keys: defaults + any custom pages
  const allKeys = new Set([...Object.keys(DEFAULT_LABELS), ...Object.keys(pagesConfig)]);
  // Exclude pages that have dedicated rendering or shouldn't be in nav
  allKeys.delete("privacy");
  allKeys.delete("homepage");

  const links: SiteNavLink[] = [];

  for (const key of Array.from(allKeys)) {
    const cfg = pagesConfig[key] as Record<string, unknown> | undefined;

    // nav_hidden / footer_hidden are two independent admin toggles, so they are
    // carried on the link rather than filtered here: dropping a page for
    // nav_hidden also removed it from the footer, which is why pages with NAV
    // off but FOOTER on never appeared there.
    // A page otherwise shows if it's a published CMS page or not visible:false.
    // (Legacy data has visible:false on every page, so published status is what
    // surfaces them; the toggles let admins hide any of them.)
    if (cfg?.deleted === true) continue;
    if (cfg?.nav_hidden === true && cfg?.footer_hidden === true) continue;
    if (cfg?.visible === false && !cmsVisibleTypes.has(key)) continue;

    // Resolve label
    const cfgLabel = cfg?.label;
    const def = DEFAULT_LABELS[key];
    const bundled = def ? (locale === "zh" ? def[0] : def[1]) : "";
    const label = labelLadder(cfgLabel, locale === "en" ? "en" : "zh", bundled, key);

    // Resolve group
    const cfgGroup = cfg?.nav_group;
    const group: SiteNavLink["group"] = (
      cfgGroup === "explore" || cfgGroup === "stories" || cfgGroup === "connect"
    ) ? cfgGroup : (DEFAULT_GROUP[key] || "explore");

    // Resolve sort order
    const sort = typeof cfg?.sort_order === "number"
      ? cfg.sort_order
      : (DEFAULT_SORT[key] ?? FALLBACK_SORT);

    // Resolve pinned
    const pinned = typeof cfg?.nav_pinned === "boolean" ? cfg.nav_pinned : DEFAULT_PINNED.has(key);

    links.push({
      key, href: navHref(key, cfg), label, group, sort, pinned,
      navHidden: cfg?.nav_hidden === true,
      footerHidden: cfg?.footer_hidden === true,
    });
  }

  // Sort by sort_order, then alphabetically
  links.sort((a, b) => a.sort - b.sort || a.key.localeCompare(b.key));

  return links;
}

/** How many links the top bar holds before the rest live in the menu only. */
export const PINNED_LIMIT = 7;

/**
 * The links the top bar shows.
 *
 * Taking the first `PINNED_LIMIT` was a silent trap for the one link this nav
 * exists to expose: 聯絡我們 sorts last, the parent already pins exactly seven
 * sections, and pinning an eighth would have pushed it back off the bar with
 * nothing to show that it had gone. It keeps its place at the end instead, and
 * the link before it is the one that gives way — the same rule the
 * progressive-hide ladder in globals.css follows as the header narrows.
 */
export function pinnedNavLinks(navVisible: SiteNavLink[], limit = PINNED_LIMIT): SiteNavLink[] {
  const pinned = navVisible.filter((n) => n.pinned);
  // Nothing pinned at all: fall back to the first few links.
  if (pinned.length === 0) return navVisible.slice(0, 5);
  if (pinned.length <= limit) return pinned;

  const kept = pinned.slice(0, limit);
  if (kept.some((n) => n.key === "contact")) return kept;

  const contact = pinned.find((n) => n.key === "contact");
  if (!contact) return kept;
  // Drop the last of the others rather than the link people come looking for.
  return [...kept.slice(0, limit - 1), contact];
}

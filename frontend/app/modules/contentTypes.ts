import { labelLadder } from "./tr";
/**
 * The site's CMS categories: what each one is called, and what order they sit in.
 *
 * A category was named in four places at once — `settings.pages[key].label` (what
 * the client types into 頁面管理), `ROOT_PAGES` here, `siteNav.DEFAULT_LABELS`,
 * and the `content` table in i18n.ts — and only the first three ever agreed.
 * The public renderer read the fourth, so 最新消息 (renamed by the client) still
 * printed as 慢域消息 on the front page, and 慢域選品 — a category i18n.ts has
 * never heard of — printed as the bare key "curation" on a Chinese page.
 *
 * The order had the same shape of problem. 頁面管理 lets the client drag the
 * categories into an order and stores it as `sort_order`; the header, the footer
 * and the CMS category dropdown all follow it. The block editor's 資料來源 picker
 * and the collection block's own chip row did not: one listed them in whatever
 * order the keys happen to sit in the database, the other in whichever category
 * happened to own the newest entry. Measured on the live site, 慢域選品 was 4th
 * in 頁面管理 and 13th in the picker.
 *
 * So one module answers both questions, for the admin and the public site alike:
 * `contentTypeCatalogue` reads the site's own page management and nothing else
 * decides a category's name or its position.
 */

/** A category's [zh, en] name before the client renames it, and — by position —
 *  the order a site starts out with. Moved here from blockForms so the public
 *  renderer can read it without pulling the whole admin form bundle onto the
 *  homepage; blockForms re-exports it, so its importers are unchanged. */
export const ROOT_PAGES: Array<{ key: string; zh: string; en: string }> = [
  { key: "brand",      zh: "品牌介紹", en: "Brand" },
  { key: "stays",      zh: "精選住宿", en: "Stays" },
  { key: "curation",   zh: "慢域選品", en: "Curation" },
  { key: "blog",       zh: "部落格",   en: "Blog" },
  { key: "dining",     zh: "餐飲服務", en: "Dining" },
  { key: "activity",   zh: "精選活動", en: "Activities" },
  { key: "experience", zh: "慢域體驗", en: "Experience" },
  { key: "journal",    zh: "旅遊專欄", en: "Journal" },
  { key: "service",    zh: "服務項目", en: "Services" },
  { key: "news",       zh: "慢域消息", en: "News" },
  { key: "contact",    zh: "聯繫我們", en: "Contact" },
  { key: "media",      zh: "媒體報導", en: "Media" },
  { key: "pr",         zh: "PR 聯絡",  en: "PR" },
  { key: "career",     zh: "人才招募", en: "Careers" },
  { key: "franchise",  zh: "民宿加盟", en: "Franchise" },
];

export const ROOT_PAGE_DEFAULTS: Record<string, [string, string]> = Object.fromEntries(
  ROOT_PAGES.map((p) => [p.key, [p.zh, p.en] as [string, string]])
);

/** The same list as the page manager wants it: sort order is position here. */
export const ROOT_SITE_DEFAULT_PAGES: Record<
  string,
  { label: { zh: string; en: string }; sort_order: number }
> = Object.fromEntries(
  ROOT_PAGES.map((p, i) => [p.key, { label: { zh: p.zh, en: p.en }, sort_order: i }])
);

/** Where a page with no `sort_order` of its own goes: last, after everything the
 *  client has actually placed. Mirrors 頁面管理's own `?? 99`. */
export const UNPLACED_SORT = 99;

/**
 * A page's position, resolved exactly the way 頁面管理 resolves it: the page's
 * own `sort_order`, else its bundled position, else last.
 */
export function pageSort(key: string, cfg: Record<string, unknown> | undefined): number {
  if (typeof cfg?.sort_order === "number") return cfg.sort_order;
  const bundled = ROOT_SITE_DEFAULT_PAGES[key];
  return bundled ? bundled.sort_order : UNPLACED_SORT;
}

/**
 * A page's name in one locale.
 *
 * The ladder is buildNavLinks', and it is a ladder for a reason: 頁面管理 writes
 * an object the moment either language field is touched, so a category renamed in
 * Chinese with the English left blank must not put the Chinese name on the English
 * page while its bundled English name is sitting right there. The other language is
 * the last resort, for a custom key that has no bundled name at all.
 */
export function pageLabel(
  key: string,
  cfgLabel: unknown,
  locale: string,
): string {
  const def = ROOT_PAGE_DEFAULTS[key];
  const bundled = def ? (locale === "zh" ? def[0] : def[1]) : "";
  return labelLadder(cfgLabel, locale === "en" ? "en" : "zh", bundled, key);
}

export type ContentTypeEntry = {
  /** The `settings.pages` key. */
  key: string;
  /** What a CMS entry's `content_type` says — usually the key, but a page may
   *  redirect it (a villa's `articles` page backs the `journal` content type). */
  type: string;
  label: string;
  sort: number;
};

/**
 * Every category this site has, named and ordered as 頁面管理 has them.
 *
 * Deleted (tombstoned) pages and the homepage are left out — neither is a
 * category anything can be collected from. Ties are broken by key so the order
 * is the same on every render and in every process; 頁面管理 hands out duplicate
 * `sort_order`s freely (the live parent site has three pairs of them).
 */
export function contentTypeEntries(
  site: { settings?: Record<string, unknown> | null } | null | undefined,
  locale: string,
  /** Tombstoned pages too. Off for anything that offers a category to pick;
   *  on for naming one, because a block can still be drawing a category whose
   *  page has since been deleted — see contentTypeCatalogue. */
  includeDeleted = false,
): ContentTypeEntry[] {
  const registry = site?.settings?.article_categories;
  if (registry && typeof registry === "object" && !Array.isArray(registry)) {
    return Object.entries(registry as Record<string, {label?: unknown; status?: string; sort_order?: number}>)
      .filter(([, cfg]) => includeDeleted || cfg.status !== "archived")
      .map(([key, cfg]) => ({key, type: key, label: pageLabel(key, cfg.label, locale), sort: cfg.sort_order ?? 99}))
      .sort((a,b) => a.sort - b.sort || a.key.localeCompare(b.key));
  }
  const pages = ((site?.settings ?? {}) as Record<string, unknown>).pages;
  const config = (pages ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const out: ContentTypeEntry[] = [];
  for (const [key, cfg] of Object.entries(config)) {
    if (key === "homepage") continue;
    if (!includeDeleted && cfg?.deleted === true) continue;
    out.push({
      key,
      type: typeof cfg?.content_type === "string" ? cfg.content_type : key,
      label: pageLabel(key, cfg?.label, locale),
      sort: pageSort(key, cfg),
    });
  }
  out.sort((a, b) => a.sort - b.sort || a.key.localeCompare(b.key));
  return out;
}

/**
 * The same list as a lookup, reachable by either a page key or the content type
 * it backs — a collection block stores content types, the page editor stores
 * keys, and on nearly every page the two are the same string.
 *
 * Tombstoned pages are in here, behind the live ones. Deleting a category in
 * 頁面管理 does not delete its entries and does not touch the blocks that name
 * it as a source, so a block can go on drawing a category whose page is gone —
 * 禾境's homepage is doing exactly that with 媒體報導. Leaving the
 * tombstone out did not stop the chip appearing; it only stopped it being
 * called 「In the Press」, the last name the client gave it, and sent it back to
 * the bundled table this module exists to stop reading.
 */
export function contentTypeCatalogue(
  site: { settings?: Record<string, unknown> | null } | null | undefined,
  locale: string,
): Map<string, ContentTypeEntry> {
  const byType = new Map<string, ContentTypeEntry>();
  /* Live pages first, in two passes rather than one: a tombstone that sorts
     earlier than the live page backing the same content type would otherwise
     name it, and a deleted page's name is the one thing here that is certainly
     out of date. */
  for (const pass of [contentTypeEntries(site, locale), contentTypeEntries(site, locale, true)]) {
    for (const entry of pass) {
      if (!byType.has(entry.type)) byType.set(entry.type, entry);
      if (entry.key !== entry.type && !byType.has(entry.key)) byType.set(entry.key, entry);
    }
  }
  return byType;
}

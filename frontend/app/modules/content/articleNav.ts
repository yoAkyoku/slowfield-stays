import type { Page } from "../api";
import type { Locale } from "../i18n";
import { buildContentHref } from "../contentRoutes";
import { tagsT, trs } from "../tr";
import { siteDateKey } from "../datetime";

export type ArticleLink = { href: string; title: string };
export type RelatedArticle = { href: string; title: string; image: string; category: string; date: string };

function dateVal(p: Page): number {
  const t = p.published_at ? Date.parse(p.published_at) : NaN;
  return Number.isNaN(t) ? 0 : t;
}

/** YYYY.MM.DD — the quiet numeric stamp used across the article layout.
 *
 *  The calendar day in Taipei. It read the day in the server's own zone, which
 *  in the container is UTC, so an article published before 08:00 Taipei time
 *  was dated the day before. */
export function formatArticleDate(iso?: string | null): string {
  if (!iso) return "";
  return siteDateKey(iso).replaceAll("-", ".");
}

/**
 * Previous / next / related for an article, from the list of entries in its
 * category.
 *
 * The arrows walk `list` in the order it arrives, which is the order the index
 * page shows: the API sorts pages by `sort_order, id DESC`. This used to
 * re-sort by `published_at` first, on the assumption that the index was
 * newest-first too. It is not — `sort_order` is the editor's manual ordering
 * and ignores dates entirely — so on any category whose manual order ran
 * against its publish dates the arrows pointed the wrong way round: from the
 * 2nd entry, 上一篇 reached the 3rd and 下一篇 the 1st (客戶: 跟 CMS 頁面的排序
 * 相反了). Walking the given order makes 上一篇 the card above and 下一篇 the
 * card below, whatever rule produced that order.
 *
 * Related prefers entries that share a tag with the current one and falls back
 * to the rest of the category when there are not enough — the client's "先從 tag
 * 再到分類，怕資料不夠".
 */
export function articleNav(
  list: Page[],
  current: Page,
  locale: Locale,
  staySlug: string | undefined,
  categoryLabel: string,
  limit = 3,
): { prev: ArticleLink | null; next: ArticleLink | null; related: RelatedArticle[] } {
  const ordered = list;
  const idx = ordered.findIndex((p) => p.id === current.id);
  const toLink = (p: Page | undefined): ArticleLink | null =>
    p ? { href: buildContentHref(p, p._staySlug ?? staySlug), title: trs(p, "title", locale) } : null;

  const prev = idx > 0 ? toLink(ordered[idx - 1]) : null;
  const next = idx >= 0 && idx < ordered.length - 1 ? toLink(ordered[idx + 1]) : null;

  const curTags = new Set(tagsT(current, locale).map((t) => t.trim()).filter(Boolean));
  const related: RelatedArticle[] = ordered
    .filter((p) => p.id !== current.id)
    .map((p) => ({ p, shared: tagsT(p, locale).some((t) => curTags.has(t.trim())) }))
    .sort((a, b) => Number(b.shared) - Number(a.shared) || dateVal(b.p) - dateVal(a.p))
    .slice(0, limit)
    .map(({ p }) => ({
      href: buildContentHref(p, p._staySlug ?? staySlug),
      title: trs(p, "title", locale),
      image: p.cover_image_url || "",
      category: categoryLabel,
      date: formatArticleDate(p.published_at),
    }));

  return { prev, next, related };
}

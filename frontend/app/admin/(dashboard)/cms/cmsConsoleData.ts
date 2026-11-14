import { articleCategories } from "../../modules/articlePlacement";
import type { AdminPage } from "../../modules/adminApi";
import type { Banner } from "../../../modules/api";

export type CmsTabKey = "overview" | "pages" | "banners" | "issues";
export type CmsVisibility = "active" | "deleted" | "all";

/**
 * `missing_title` / `missing_description` were `missing_seo_title` and
 * `missing_seo_description`, and were renamed with the rule below: they no
 * longer report an empty seo_title / seo_description field, because that field
 * is an override and leaving it blank is the normal case. See `pageIssues`.
 */
export type CmsPageIssueKey =
  | "missing_body"
  | "missing_cover"
  | "missing_title"
  | "missing_description";

export type CmsBannerIssueKey = "missing_image";
export type CmsIssueKey = CmsPageIssueKey | CmsBannerIssueKey;

export type CmsPageRow = AdminPage & { computedIssues: CmsPageIssueKey[] };
export type CmsBannerRow = Banner & { computedIssues: CmsBannerIssueKey[] };

export type CmsIssueRow =
  | {
      kind: "page";
      id: number;
      title: string;
      status: string;
      deleted_at?: string | null;
      content_type?: string;
      href: string;
      issues: CmsPageIssueKey[];
    }
  | {
      kind: "banner";
      id: number;
      title: string;
      status: string;
      deleted_at?: string | null;
      href: string;
      issues: CmsBannerIssueKey[];
    };

function hasText(value?: string | null) {
  return Boolean(value && value.trim().length > 0);
}

function seoValue(page: AdminPage, key: string) {
  const value = page.seo?.[key];
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Text stored for `field` in any language.
 *
 * The public routes read these through `trs`, whose order is the reader's
 * translation → the page's own column → the other locale. A value in any one of
 * the three is therefore a value on every language version of the page, which
 * is the granularity this console works at: it lists a page once, not once per
 * locale.
 */
function hasAnyLocale(page: AdminPage, field: "title" | "summary" | "body"): boolean {
  if (hasText(page[field])) return true;
  return Object.values(page.translations ?? {}).some((fields) => hasText(fields?.[field]));
}

/**
 * An SEO override stored for `key`, wherever `cmsEntrySeo` would find one:
 * translations[locale].seo_title / seo_description first, the flat `seo` object
 * second. Reading only the flat object would call a page that has an English
 * meta description and no Chinese one "missing".
 */
function hasSeoOverride(page: AdminPage, key: "title" | "description"): boolean {
  if (hasText(seoValue(page, key))) return true;
  return Object.values(page.translations ?? {}).some((fields) => hasText(fields?.[`seo_${key}`]));
}

export function normalizeTab(value?: string): CmsTabKey {
  if (value === "pages" || value === "banners" || value === "issues") return value;
  return "overview";
}

export function normalizeVisibility(value?: string): CmsVisibility {
  if (value === "deleted" || value === "all") return value;
  return "active";
}

/**
 * What this page is actually missing, judged by what the public routes serve.
 *
 * The two SEO checks used to read the `seo_title` / `seo_description` columns
 * directly, so every page that had not overridden them was reported as broken:
 * 24 issues out of 24 published pages, all of them false, with the two real
 * checks (缺少圖片, 缺少內容) sitting at 0 underneath. A panel that is entirely
 * false positives is a panel nobody opens, and this one was also telling the
 * client to write two dozen pages of copy the site does not need.
 *
 * Those columns are OVERRIDES. `app/(site)/[category]/[identifier]/page.tsx`
 * and `app/(site)/page/[identifier]/page.tsx` both build their metadata as
 *
 *     title:       seo.title || trs(page, "title", locale)
 *     description: seo.description || trs(page, "summary", locale)
 *                                  || excerpt(trs(page, "body", locale))
 *
 * so a page with a title and a summary serves correct metadata with both
 * columns empty — 羅莊櫻花步道 and 宜蘭兩天一夜 do exactly that today.
 *
 * The checks now follow those chains and report the case that is genuinely
 * wrong: nothing resolves at all. For the description that is not hypothetical.
 * `excerpt` reads `body`, the prose column, and NOT `body_blocks` — so a page
 * built entirely from blocks with no summary has no description of its own and
 * inherits the site-wide default, which is the duplicate-description warning
 * `excerpt`'s own comment was written about.
 *
 * Kept as issues rather than shown as a softer class of suggestion because this
 * panel has exactly one class: a badge and a count, rendered the same way by
 * CmsIssuesPanel, CmsPagesTable, CmsOverviewPanel and CmsBannersTable. A second
 * class would be new UI in four components for advice the page editor already
 * gives better, in place — its SeoPreview renders the resolved title and
 * description, fallbacks included, beside the fields themselves.
 */
export function pageIssues(page: AdminPage): CmsPageIssueKey[] {
  const issues: CmsPageIssueKey[] = [];
  if (!hasText(page.body) && !(page.body_blocks && page.body_blocks.length > 0)) issues.push("missing_body");
  if (!hasText(page.cover_image_url)) issues.push("missing_cover");
  if (!hasSeoOverride(page, "title") && !hasAnyLocale(page, "title")) issues.push("missing_title");
  if (
    !hasSeoOverride(page, "description") &&
    !hasAnyLocale(page, "summary") &&
    !hasAnyLocale(page, "body")
  ) {
    issues.push("missing_description");
  }
  return issues;
}

export function bannerIssues(banner: Banner): CmsBannerIssueKey[] {
  return hasText(banner.image_url) ? [] : ["missing_image"];
}

function searchBlob(values: Array<string | string[] | null | undefined>) {
  return values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function countCmsIssueStats(
  pageIssuesByPage: ReadonlyArray<ReadonlyArray<CmsPageIssueKey>>,
  bannerIssuesByBanner: ReadonlyArray<ReadonlyArray<CmsBannerIssueKey>>
) {
  const pageIssueCount = (key: CmsPageIssueKey) => pageIssuesByPage.filter((issues) => issues.includes(key)).length;
  return {
    missing_image:
      pageIssueCount("missing_cover") +
      bannerIssuesByBanner.filter((issues) => issues.includes("missing_image")).length,
    missing_body: pageIssueCount("missing_body"),
    missing_title: pageIssueCount("missing_title"),
    missing_description: pageIssueCount("missing_description")
  };
}
export function filterPages(rows: CmsPageRow[], status?: string, category?: string, q?: string) {
  const keyword = q?.trim().toLowerCase() ?? "";
  return rows.filter((page) => {
    if (status && page.status !== status) return false;
    if (category && !articleCategories(page).includes(category)) return false;
    if (!keyword) return true;
    const haystack = searchBlob([page.title, page.slug, page.summary, page.tags]);
    return haystack.includes(keyword);
  });
}

export function filterBanners(rows: CmsBannerRow[], status?: string, q?: string) {
  const keyword = q?.trim().toLowerCase() ?? "";
  return rows.filter((banner) => {
    if (status && banner.status !== status) return false;
    if (!keyword) return true;
    const haystack = searchBlob([banner.title, banner.subtitle, banner.cta_label]);
    return haystack.includes(keyword);
  });
}

export function buildIssueRows(pageRows: CmsPageRow[], bannerRows: CmsBannerRow[]): CmsIssueRow[] {
  const pages = pageRows
    .filter((page) => page.computedIssues.length > 0)
    .map<CmsIssueRow>((page) => ({
      kind: "page",
      id: page.id,
      title: page.title,
      status: page.status,
      deleted_at: page.deleted_at,
      content_type: page.content_type,
      href: `/admin/cms/pages/${page.id}/edit`,
      issues: page.computedIssues
    }));

  const banners = bannerRows
    .filter((banner) => banner.computedIssues.length > 0)
    .map<CmsIssueRow>((banner) => ({
      kind: "banner",
      id: banner.id,
      title: banner.title,
      status: banner.status,
      deleted_at: banner.deleted_at,
      href: `/admin/cms/banners/${banner.id}/edit`,
      issues: banner.computedIssues
    }));

  return [...pages, ...banners];
}

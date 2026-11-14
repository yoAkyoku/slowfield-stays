import { notFound } from "next/navigation";
import { getPages, getCurrentSite } from "../../modules/api";
import { getLocale, publicUiText } from "../../modules/i18n";
import { buildMetadata, pageSettingsSeo } from "../../modules/seo";
import { isServableThroughSiteOverride } from "../../modules/siteVisibility";
import { isAdminPreview } from "../../modules/adminPreview";
import CategoryPage from "../../modules/content/CategoryPage";

/**
 * Dynamic route for ALL category/content pages.
 *
 * Resolution order:
 *   1. Exact match: slug exists as a key in site.settings.pages  (e.g. /brand → pages.brand)
 *   2. Legacy alias: slug maps to a known content_type            (e.g. /activities → activity)
 *   3. 404
 *
 * Special pages (stays, contact, privacy) keep their own hardcoded route folders
 * because they have custom rendering logic beyond CategoryPage.
 */

/** Legacy URL slug → content_type for pages that had hardcoded folders */
const SLUG_ALIASES: Record<string, string> = {
  activities:      "activity",
  services:        "service",
  careers:         "career",
  "media-coverage": "media",
};

/** A page removed in 頁面管理 is tombstoned (deleted: true) rather than dropped,
 *  so the bundled defaults do not bring it back. Its URL has to 404 too: the
 *  nav and sitemap already skip it, and the legacy i18n fallback below would
 *  otherwise still render the section for anyone holding the old link. */
function isDeletedPage(slug: string, pagesConfig: Record<string, Record<string, unknown>>): boolean {
  const key = pagesConfig[slug] ? slug : (SLUG_ALIASES[slug] ?? slug);
  return pagesConfig[key]?.deleted === true;
}

function resolveContentType(
  slug: string,
  pagesConfig: Record<string, Record<string, unknown>>,
): string | null {
  // 1. Direct match in page management
  if (pagesConfig[slug]) return slug;
  // 2. Legacy alias
  const aliased = SLUG_ALIASES[slug];
  if (aliased && pagesConfig[aliased]) return aliased;
  // 3. Not found
  return null;
}

export async function generateMetadata(props: { params: Promise<{ category: string }> }) {
  const params = await props.params;
  const locale = await getLocale();
  const site = await getCurrentSite();
  // Route metadata runs outside the layout's ?site= gate; a draft villa reached
  // through the override must not leak its content here either.
  if (!isServableThroughSiteOverride(site) && !(await isAdminPreview())) {
    return buildMetadata({ title: publicUiText(locale).notFound, noIndex: true, path: `/${params.category}` });
  }
  const pagesConfig = (site.settings?.pages ?? {}) as Record<string, Record<string, unknown>>;
  if (isDeletedPage(params.category, pagesConfig)) {
    return buildMetadata({ title: publicUiText(locale).notFound, noIndex: true, path: `/${params.category}`, site });
  }
  const contentType = resolveContentType(params.category, pagesConfig);

  if (!contentType) {
    // Still try i18n fallback for known content types without page config
    const ui = publicUiText(locale);
    const copy = (ui.content[params.category as keyof typeof ui.content]
      ?? ui.content[SLUG_ALIASES[params.category] as keyof typeof ui.content]) as unknown as Record<string, string> | undefined;
    if (copy) {
      /* This branch handles a category with no entry in settings.pages — which
         is most of them — so it is the one that actually runs. It had no share
         image at all, so every category page shared to LINE or Facebook came
         through with no preview. */
      const alias = SLUG_ALIASES[params.category] ?? params.category;
      const first = (await getPages(alias))[0];
      return buildMetadata({
        title: copy.title,
        description: copy.intro,
        image: first?.cover_image_url || undefined,
        path: `/${params.category}`,
        site,
      });
    }
    return buildMetadata({ title: ui.notFound, noIndex: true, path: `/${params.category}`, site });
  }

  const pageConfig = pagesConfig[contentType];
  const label = pageConfig?.label as Record<string, string> | undefined;
  // Try page label, then i18n, then slug
  const ui = publicUiText(locale);
  const i18nCopy = ui.content[contentType as keyof typeof ui.content] as unknown as Record<string, string> | undefined;
  const fallbackTitle = label?.[locale] || i18nCopy?.title || contentType;
  /* The admin's per-page SEO fields win; failing that the section's own intro
     copy is the description, because the site-wide default that used to land
     here made every category page describe itself the same way. */
  const override = pageSettingsSeo(site, contentType, locale);
  return buildMetadata({
    title: override.title || fallbackTitle,
    description: override.description || i18nCopy?.intro,
    // A section hidden from the nav is a coming-soon stub the site has taken
    // down; keep it out of search too (客戶: 隱藏空殼頁).
    noIndex: override.noIndex || pageConfig?.nav_hidden === true,
    // As on /stays: the section's own hero rather than no preview image at all.
    // Page hero, then the newest entry's cover — the same order the index
    // itself shows, so a shared link previews what the reader would see.
    image: override.image
      || (pageConfig?.hero_image as string | undefined)
      || (await getPages(contentType))[0]?.cover_image_url
      || undefined,
    canonical: override.canonical,
    path: `/${params.category}`,
    site
  });
}

export default async function DynamicCategoryPage(props: { params: Promise<{ category: string }> }) {
  const params = await props.params;
  const site = await getCurrentSite();
  const pagesConfig = (site.settings?.pages ?? {}) as Record<string, Record<string, unknown>>;
  if (isDeletedPage(params.category, pagesConfig)) notFound();
  const contentType = resolveContentType(params.category, pagesConfig);

  // Even without page config, allow rendering if it's a known content type (legacy)
  if (!contentType) {
    const alias = SLUG_ALIASES[params.category];
    const fallbackType = alias || params.category;
    // Check if it's a recognized i18n content type
    const ui = publicUiText(await getLocale());
    if (ui.content[fallbackType as keyof typeof ui.content]) {
      return <CategoryPage contentType={fallbackType} />;
    }
    notFound();
  }

  return <CategoryPage contentType={contentType} />;
}

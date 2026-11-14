// Standalone parent stay detail page.
//
// /stays/{slug} is rewritten by middleware to the child site (/property/{slug})
// when the slug belongs to a child site, so a parent stay sharing that slug can
// never show its own detail there. This /stays/detail/{slug} route is not
// rewritten, so it renders the full parent stay detail (rooms, story, map) and —
// because the slug still matches the child site — the page's built-in
// "visit property website" link points to the child's official site.
//
// The page component is re-used from /stays/[slug]; only the metadata differs so
// the canonical URL points at THIS route (not /stays/{slug}, which serves the
// child site).
import { getCurrentSite, getPropertySites, getStay } from "../../../../modules/api";
import { getLocale, publicUiText } from "../../../../modules/i18n";
import { trs } from "../../../../modules/tr";
import { buildMetadata, excerpt, seoTextForLocale } from "../../../../modules/seo";

export { /* @next-codemod-error `default` export is re-exported. Check if this component uses `params` or `searchParams`*/
default } from "../../[slug]/page";

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const locale = await getLocale();
  const [site, stay, propertySites] = await Promise.all([
    getCurrentSite(),
    getStay(params.slug),
    getPropertySites(),
  ]);
  if (!stay) {
    return buildMetadata({ title: publicUiText(locale).notFound, noIndex: true, path: `/stays/detail/${params.slug}`, site });
  }
  // When a live villa site exists for this slug, /stays/{slug} is the page the
  // whole site links to and the URL the villa promotes; this detail route is the
  // parent's fallback for the same stay. Self-canonicalising here split ranking
  // signals between two URLs for one villa — the same reason /property/{slug}
  // canonicalises to /stays/{slug}. getPropertySites lists only live (active,
  // non-template) child sites, so a draft villa correctly keeps a self canonical.
  const hasLiveVilla = propertySites.some((s) => s.slug === stay.slug);
  const localizedName = seoTextForLocale(trs(stay, "name", locale), locale, locale === "zh" ? "住宿" : "Stay");
  const localizedSummary = seoTextForLocale(trs(stay, "summary", locale), locale);
  const localizedStory = seoTextForLocale(excerpt(trs(stay, "story", locale)), locale);
  return buildMetadata({
    title: seoTextForLocale(stay.seo?.title, locale) || localizedName,
    description: seoTextForLocale(stay.seo?.description, locale) || localizedSummary || localizedStory,
    image: stay.seo?.og_image || stay.hero_image_url,
    canonical: hasLiveVilla ? `/stays/${stay.slug}` : undefined,
    path: `/stays/detail/${stay.slug}`,
    site
  });
}

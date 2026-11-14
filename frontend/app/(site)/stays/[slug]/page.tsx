import { notFound } from "next/navigation";
import { getCurrentSite, getStay } from "../../../modules/api";
import { getLocale, publicUiText } from "../../../modules/i18n";
import { trs } from "../../../modules/tr";
import { buildMetadata, excerpt, seoTextForLocale } from "../../../modules/seo";
import StayDetailView from "../../../modules/stays/StayDetailView";

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const locale = await getLocale();
  const [site, stay] = await Promise.all([getCurrentSite(), getStay(params.slug)]);
  if (!stay) {
    return buildMetadata({ title: publicUiText(locale).notFound, noIndex: true, path: `/stays/${params.slug}`, site });
  }
  const localizedName = seoTextForLocale(trs(stay, "name", locale), locale, locale === "zh" ? "住宿" : "Stay");
  const localizedSummary = seoTextForLocale(trs(stay, "summary", locale), locale);
  const localizedStory = seoTextForLocale(excerpt(trs(stay, "story", locale)), locale);
  return buildMetadata({
    title: seoTextForLocale(stay.seo?.title, locale) || localizedName,
    // A villa with neither an SEO description nor a summary fell through to the
    // site-wide default and described itself the same way every other villa did.
    description: seoTextForLocale(stay.seo?.description, locale) || localizedSummary || localizedStory,
    image: stay.seo?.og_image || stay.hero_image_url,
    canonical: stay.seo?.canonical,
    path: `/stays/${stay.slug}`,
    site
  });
}

export default async function StayDetailPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  // Note: property (child) sites are handled by middleware rewrite
  // to /property/[slug] — this page only serves regular stays.
  const stay = await getStay(params.slug);
  if (!stay) notFound();

  return <StayDetailView stay={stay} />;
}

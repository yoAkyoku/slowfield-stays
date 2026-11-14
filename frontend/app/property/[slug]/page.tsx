import { lodgingJsonLd } from "../../modules/seo";
import JsonLd from "../../modules/JsonLd";
import { notFound } from "next/navigation";
import { getBannersForSite, getPropertySite } from "../../modules/api";
import { getLocale, publicUiText } from "../../modules/i18n";
import { trs } from "../../modules/tr";
import { buildMetadata, seoTextForLocale } from "../../modules/seo";
import PropertyPageRenderer from "../../modules/property/PropertyPageRenderer";
import { resolveSiteName, type PropertyBlock } from "../../modules/property/types";

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const locale = await getLocale();
  const [site, banners] = await Promise.all([
    getPropertySite(params.slug),
    getBannersForSite(params.slug),
  ]);
  // Returning {} left the 404 wearing the root layout's title, so an unknown
  // villa slug was a page called "Slowfield Stays" that crawlers could index.
  if (!site) return buildMetadata({ title: publicUiText(locale).notFound, noIndex: true });
  const siteName = resolveSiteName(site, locale);
  const hp = (site.settings?.homepage ?? {}) as Record<string, unknown>;
  const hpSeo = (hp.seo ?? {}) as Record<string, unknown>;
  /* Same chain the group homepage uses: the villa's own hero is the closest
     thing it has to a share image and to a sentence about itself, and every
     villa homepage otherwise shared one description from seo_defaults. */
  const [banner] = banners;
  /* And the same STRICT read of homepage.seo the group homepage does. cfgT
     borrows the other locale when a field is empty, and the English half of an
     SEO field is the half that gets left blank — so an English villa homepage
     was titled in Chinese instead of falling through to the villa's own name.
     One reader for every route, in seo.ts, so this cannot drift back. */
  /* SEO 設置 → Meta 標題 (seo_defaults.title) sits between the villa's own
     homepage SEO title and its bare name. It had no reader anywhere before, so
     a villa whose settings page carried 「禾境｜宜蘭冬山輕奢泳池民宿」
     was still titled just 「禾境」 in every search result. */
  return buildMetadata({
    title: seoTextForLocale(hpSeo.title, locale) || seoTextForLocale(site.seo_defaults?.title, locale) || siteName,
    description:
      seoTextForLocale(hpSeo.description, locale)
      || (banner ? trs(banner, "subtitle", locale) : "")
      || seoTextForLocale(site.seo_defaults?.description, locale),
    image: banner?.image_url,
    path: `/stays/${params.slug}`,
    site: { ...site, name: siteName },
  });
}

export default async function PropertyHomePage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const [site, banners] = await Promise.all([
    getPropertySite(params.slug),
    getBannersForSite(params.slug),
  ]);
  if (!site) notFound();

  const locale = await getLocale();
  const siteName = resolveSiteName(site, locale);
  const hp = (site.settings?.homepage ?? {}) as Record<string, unknown>;
  const blocks = (Array.isArray(hp.blocks) ? hp.blocks : []) as PropertyBlock[];

  /* The parent's stay-detail route emitted this and the villa's own front page
     — the URL a villa actually promotes — emitted nothing. */
  const contact = (site.contact_config ?? {}) as Record<string, string>;
  return (
    <main>
      <JsonLd
        data={lodgingJsonLd({
          name: siteName,
          url: `/stays/${params.slug}`,
          description: seoTextForLocale(site.seo_defaults?.description, locale),
          image: banners[0]?.image_url,
          address: typeof site.settings?.contact_address === "string" ? site.settings.contact_address : undefined,
          phone: typeof site.settings?.contact_phone === "string" ? site.settings.contact_phone : contact.phone,
          site,
        })}
      />
      {/* A villa whose homepage has no hero block had no <h1> at all: the hero
          block is what carried one, and it is optional. The site name is the
          page's heading either way. Hidden, not drawn — the visible design is
          whatever blocks the editor arranged; this is the document outline.
          The empty state below has its own visible one. */}
      {blocks.length > 0 && !blocks.some((b) => b.type === "hero_banner" && b.enabled !== false) && (
        <h1 className="sr-only">{siteName}</h1>
      )}
      {blocks.length > 0 ? (
        <PropertyPageRenderer blocks={blocks} locale={locale} banners={banners} siteSlug={params.slug} siteLine={site.contact_config?.line} />
      ) : (
        <section className="property-empty-page section">
          <h1>{siteName}</h1>
          <p>{locale === "zh" ? "歡迎光臨，內容即將上線。" : "Welcome — content coming soon."}</p>
        </section>
      )}
    </main>
  );
}

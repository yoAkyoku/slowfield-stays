import { notFound } from "next/navigation";
import { resolveSiteName } from "../modules/property/types";
import { getAnnouncements, getBanners, getCurrentSite } from "../modules/api";
import { getLocale, publicUiText, t } from "../modules/i18n";
import JsonLd from "../modules/JsonLd";
import HomeHeroCarousel from "../modules/home/HomeHeroCarousel";
import HomeReveal from "../modules/home/HomeReveal";
import HomeAnnouncementPopup from "../modules/home/HomeAnnouncementPopup";
import HomepageBlocks, { DEFAULT_BLOCKS, type HomepageBlock } from "../modules/home/HomepageBlocks";
import { buildMetadata, seoTextForLocale, siteOrganizationJsonLd, siteWebsiteJsonLd } from "../modules/seo";
import { isServableThroughSiteOverride } from "../modules/siteVisibility";
import { isAdminPreview } from "../modules/adminPreview";
import { trs } from "../modules/tr";

/** Resolve bilingual site name from settings, falling back to site.name */
export async function generateMetadata() {
  const locale = await getLocale();
  const [site, banners] = await Promise.all([getCurrentSite(), getBanners()]);

  // generateMetadata runs independently of the layout's visibility gate, so a
  // draft villa reached through ?site= still produced a 404 body carrying the
  // draft's real title / OG / JSON-LD. Mirror the layout gate (see
  // (site)/layout.tsx) and say nothing about the draft.
  if (!isServableThroughSiteOverride(site) && !(await isAdminPreview())) {
    return buildMetadata({ title: publicUiText(locale).notFound, noIndex: true, path: "/" });
  }

  const [banner] = banners;
  const bannerSubtitle = banner ? trs(banner, "subtitle", locale) : "";

  // Homepage-specific SEO, falling back to the localised dictionary copy.
  // The seo.title is stored bilingually but its English half is often blank, and
  // cfgT would then borrow the Chinese half — leaving the English homepage with a
  // Chinese <title>. Read the EXACT locale here (no cross-locale borrow) so an
  // empty English value falls through to copy.home.*, which the body already uses.
  const hp = (site.settings?.homepage ?? {}) as Record<string, unknown>;
  const hpSeo = (hp.seo ?? {}) as Record<string, unknown>;
  const strictHp = (key: string): string => seoTextForLocale(hpSeo[key], locale);
  const siteName = resolveSiteName(site, locale);
  const copy = t(locale);

  /* SEO 設置 → Meta 標題. `seo_defaults.description` has always been the
     site-wide fallback description; its twin had no reader anywhere in the app,
     so the field above it saved and every <title> on the site ignored it. The
     homepage is the page a site-wide meta title describes, and it goes after
     the homepage's OWN seo.title so a site that set both keeps the more
     specific one. */
  return buildMetadata({
    title: strictHp("title") || seoTextForLocale(site.seo_defaults?.title, locale) || copy.home.heroTitle || siteName,
    description:
      strictHp("description")
      || seoTextForLocale(site.seo_defaults?.description, locale)
      || copy.home.heroSubtitle
      || bannerSubtitle,
    image: banner?.image_url,
    path: "/",
    site: { ...site, name: siteName },
  });
}

export default async function HomePage() {
  const site = await getCurrentSite();
  // The layout 404s a draft reached through ?site=, but this page still ran and
  // streamed the draft's block config into the RSC payload — a scraper could read
  // the unpublished site's name and booking flow from source. Stop before we
  // resolve any of its content.
  if (!isServableThroughSiteOverride(site) && !(await isAdminPreview())) notFound();
  const [banners, announcements] = await Promise.all([
    getBanners(),
    getAnnouncements(),
  ]);
  const locale = await getLocale();
  const copy = t(locale);
  const siteName = resolveSiteName(site, locale);

  // Read homepage settings — support both new blocks system and legacy flat config
  const hp = (site.settings?.homepage ?? {}) as {
    blocks?: unknown[];
    gallery_images?: string[];
    gallery_title?: string;
    gallery_eyebrow?: string;
    pathway_images?: string[];
    feature_image?: string;
    feature_title?: string;
    feature_body?: string;
    feature_cta_label?: string;
    feature_cta_href?: string;
  };

  let blocks: HomepageBlock[];
  if (Array.isArray(hp.blocks) && hp.blocks.length > 0) {
    blocks = hp.blocks as HomepageBlock[];
  } else {
    // Migrate legacy flat config into default blocks
    blocks = DEFAULT_BLOCKS.map((b) => {
      if (b.type === "gallery") {
        return { ...b, config: { images: hp.gallery_images ?? [], title: hp.gallery_title, eyebrow: hp.gallery_eyebrow } };
      }
      if (b.type === "pathways") {
        return { ...b, config: { images: hp.pathway_images ?? [] } };
      }
      if (b.type === "editorial") {
        return { ...b, config: { image: hp.feature_image ?? "", title: hp.feature_title, body: hp.feature_body, cta_label: hp.feature_cta_label, cta_href: hp.feature_cta_href } };
      }
      return b;
    });
  }

  // Any hero block at all, enabled or not: with `enabled !== false` here,
  // switching the block off simply handed the page back to the built-in hero
  // and looked identical, so the toggle appeared broken.
  const hasHeroBlock = blocks.some((b) => b.type === "hero_banner");

  // The hero search used to be hard-coded here, between the hero and the
  // block list, so it could not be reordered, hidden, or restyled like
  // everything else. A site that has never opened the block editor still has
  // none in its saved blocks, so one is synthesised right after the hero —
  // same pattern as hasHeroBlock above — rather than the block simply
  // vanishing until an admin adds it back by hand.
  /* Group site only. A child site reached on its own domain (or through
     ?site=) renders this same route, and it was being given a stay-search
     bar it cannot remove — the villa palette deliberately withholds the
     block (GROUP_HOMEPAGE_ONLY), and the admin tells the operator in as
     many words that a child site has no search bar. It also searched that
     one villa's own catalogue, so it returned itself. */
  if (site.parent_site_id == null && !blocks.some((b) => b.type === "search")) {
    const heroIdx = blocks.findIndex((b) => b.type === "hero_banner");
    const insertAt = heroIdx === -1 ? 0 : heroIdx + 1;
    blocks = [...blocks.slice(0, insertAt), { id: "search-bar", type: "search", enabled: true, config: {} }, ...blocks.slice(insertAt)];
  }

  return (
    <main className="site-home">
      <JsonLd data={siteOrganizationJsonLd({ ...site, name: siteName })} />
      <JsonLd data={siteWebsiteJsonLd({ ...site, name: siteName })} />
      <HomeAnnouncementPopup announcements={announcements} readMoreLabel={publicUiText(locale).readMore} locale={locale} />
      {/* The hero is fixed here rather than being a block, which is why the
          homepage editor showed no hero to edit while a villa's did. A
          hero_banner block now takes over when one is added, so the hero can be
          edited, reordered and styled like everything else — and a site that
          has not added one keeps exactly what it had. */}
      {!hasHeroBlock && (
        <HomeHeroCarousel
          banners={banners}
          eyebrow={copy.home.eyebrow}
          fallbackTitle={copy.home.heroTitle}
          fallbackSubtitle={copy.home.heroSubtitle}
          locale={locale}
        />
      )}

      <HomepageBlocks
        blocks={blocks}
        locale={locale}
        banners={banners}
        siteSlug={site.slug}
        heroFallbacks={{
          eyebrow: copy.home.eyebrow,
          title: copy.home.heroTitle,
          subtitle: copy.home.heroSubtitle,
        }}
      />

      {/* The fallback newsletter section that used to appear here is gone: the
          footer now carries a signup on every page, so a homepage with no
          newsletter block would have shown two. Removing a newsletter block in
          the admin also had no visible effect while this stood in for it. */}
      <HomeReveal />
    </main>
  );
}

import JsonLd from "../../modules/JsonLd";
import { getCurrentSite, getPropertySites, getStays } from "../../modules/api";
import { cssUrl } from "../../modules/safeCss";
import { safeCssColor } from "../../modules/fontPresets";
import { getLocale, t, publicUiText } from "../../modules/i18n";
import StaysLoadMore from "../../modules/stays/StaysLoadMore";
import { buildMetadata, itemListJsonLd, pageSettingsSeo, seoTextForLocale } from "../../modules/seo";
import { isServableThroughSiteOverride } from "../../modules/siteVisibility";
import { isAdminPreview } from "../../modules/adminPreview";
import { pickT, trs } from "../../modules/tr";
import { HERO_HEIGHT_MAP } from "../../modules/content/PageHero";
import PropertyPageRenderer from "../../modules/property/PropertyPageRenderer";
import type { PropertyBlock } from "../../modules/property/types";

export async function generateMetadata() {
  const locale = await getLocale();
  const copy = t(locale);
  const site = await getCurrentSite();
  // Route metadata runs outside the layout's ?site= gate; a draft villa reached
  // through the override must not leak its name/description here either.
  if (!isServableThroughSiteOverride(site) && !(await isAdminPreview())) {
    return buildMetadata({ title: publicUiText(locale).notFound, noIndex: true, path: "/stays" });
  }
  /* 精選住宿 is one of the pages the admin's per-page SEO editor writes, so its
     fields come first. The catalogue's own intro is the fallback rather than the
     site-wide description, which described the whole brand and read identically
     to the homepage's. */
  const override = pageSettingsSeo(site, "stays", locale);
  /* The same chain the page itself uses for its hero, so the share preview is
     the picture a reader actually sees. `getStays` is memoised per request, so
     this costs nothing beyond what the page already fetches. */
  const stays = await getStays("");
  /* 頁面編輯's own image first, which is the order the page body uses. Without
     it the share card showed a different picture from the one on the page the
     moment an editor set a hero image there. */
  const ogPageCfg = ((site.settings?.pages as Record<string, Record<string, unknown>> | undefined)?.stays
    ?? {}) as Record<string, unknown>;
  const heroImage =
    (ogPageCfg.hero_image as string | undefined)
    || (site.settings?.hero_stays as string | undefined)
    || stays[0]?.hero_image_url
    || undefined;
  return buildMetadata({
    title: override.title || copy.stays.headline,
    description: override.description || copy.stays.intro,
    /* A listing shared to LINE or Facebook had no thumbnail unless a site-wide
       default happened to be set. The page's own hero is the picture a reader
       associates with it, so it is the sensible last resort. */
    image: override.image || heroImage,
    noIndex: override.noIndex,
    canonical: override.canonical,
    path: "/stays",
    site
  });
}

export default async function StaysPage(
  props: {
    searchParams: Promise<{ destination?: string; guests?: string; tag?: string; region?: string; amenity?: string | string[]; experience?: string | string[] }>;
  }
) {
  const searchParams = await props.searchParams;
  // Facilities can be multi-select → amenity may arrive as a repeated param.
  const amenityList = Array.isArray(searchParams.amenity)
    ? searchParams.amenity.filter(Boolean)
    : (searchParams.amenity ? [searchParams.amenity] : []);
  const experienceList = Array.isArray(searchParams.experience)
    ? searchParams.experience.filter(Boolean)
    : (searchParams.experience ? [searchParams.experience] : []);
  const params = new URLSearchParams();
  if (searchParams.destination) params.set("destination", searchParams.destination);
  if (searchParams.region) params.set("region", searchParams.region);
  if (searchParams.guests) params.set("guests", searchParams.guests);
  if (searchParams.tag) params.set("tag", searchParams.tag);
  for (const a of amenityList) params.append("amenity", a);
  for (const experience of experienceList) params.append("experience", experience);
  /* The second, unfiltered getStays() is gone with the hand-rolled search bar.
     It fetched the WHOLE catalogue on every request purely to build the region
     and facility dropdowns, and the bar that read them is a `search` block now
     that builds its own — so the page was paying for a full listing fetch and
     three derived arrays nobody rendered. */
  const [stays, site, propertySites] = await Promise.all([
    getStays(params.size ? `?${params.toString()}` : ""),
    getCurrentSite(),
    getPropertySites()
  ]);
  // Stays whose slug matches a child site redirect to that site at /stays/{slug};
  // route their cards to /stays/detail/{slug} to show the parent detail page.
  const propertySlugs = propertySites.map((s) => s.slug);
  const locale = await getLocale();
  const copy = t(locale);
  const ui = publicUiText(locale);

  /* The page's own entry in 頁面管理 — the hero height lives here, and the
     hero image the editor set there should win over the legacy
     settings.hero_stays key. */
  const pageCfg = ((site.settings?.pages as Record<string, Record<string, unknown>> | undefined)?.stays
    ?? {}) as Record<string, unknown>;
  /* Seeded, exactly as the homepage seeds its own — and this is why it has to
     be. The search bar used to be rendered here in the JSX; moving it into a
     `search` block (客戶: 我需要這個區塊在頁面編輯中添加至精品Villa，移除默認的
     搜尋列) made it editable and, on its own, made it VANISH: no site has a
     `settings.pages.stays.blocks` array, so the list was empty, the renderer was
     skipped entirely, and the bar disappeared on the first deploy. A comment
     claiming the seed existed is not a seed. */
  const stored = (Array.isArray(pageCfg.blocks) ? pageCfg.blocks : []) as PropertyBlock[];
  const blocks: PropertyBlock[] = stored.some((b) => b.type === "search")
    ? stored
    : [{ id: "search-bar", type: "search", enabled: true, config: {} } as PropertyBlock, ...stored];

  const heroImage =
    (pageCfg.hero_image as string | undefined) ||
    (site.settings?.hero_stays as string | undefined) ||
    stays[0]?.hero_image_url ||
    "/stays-hero.jpg";

  /* A listing page with no structured data is a page of links a crawler has to
     guess at. ItemList names what each one is and where it goes. */
  const listJsonLd = itemListJsonLd(
    stays.map((stay) => ({
      name: seoTextForLocale(trs(stay, "name", locale), locale),
      // Mirror the card links (and villaHref in tests/villaLinks.test.mts): a
      // stay with a live villa site of its own points at that site, everything
      // else at the parent detail page. Hardcoding /stays/detail/ here pointed
      // crawlers at a URL the site never links to for live villas.
      url: propertySlugs.includes(stay.slug) ? `/stays/${stay.slug}` : `/stays/detail/${stay.slug}`,
      image: stay.hero_image_url,
    })),
    copy.stays.headline,
    site,
  );

  /* The rest of 頁面編輯 → Hero, which this page rendered by hand and therefore
     ignored: only the picture and the height were read here, while the same
     editor saved 標題／副標／兩個顏色／對齊／遮罩 and none of them changed
     anything. Read the same way PageHero reads them — a key that exists wins
     over the bundled copy, so a title an editor deliberately cleared stays
     cleared rather than snapping back to the dictionary. */
  const heroTitle = "hero_title" in pageCfg ? pickT(pageCfg.hero_title, locale) : copy.stays.headline;
  const heroSubtitle =
    "hero_subtitle" in pageCfg ? pickT(pageCfg.hero_subtitle, locale) : copy.stays.intro;
  const heroTitleColor = safeCssColor(pageCfg.hero_title_color);
  const heroSubtitleColor = safeCssColor(pageCfg.hero_subtitle_color);
  const heroAlign = ["left", "center", "right"].includes(String(pageCfg.hero_align ?? ""))
    ? String(pageCfg.hero_align)
    : "";
  const heroMaskColor = safeCssColor(pageCfg.hero_mask_color);
  const rawHeroMask = pageCfg.hero_mask_opacity;
  const heroMaskPct =
    rawHeroMask === "" || rawHeroMask === null || rawHeroMask === undefined || Number.isNaN(Number(rawHeroMask))
      ? null
      : Math.min(100, Math.max(0, Math.round(Number(rawHeroMask))));
  const hasHeroMask = Boolean(heroImage) && Boolean(heroMaskColor) && heroMaskPct !== null && heroMaskPct > 0;

  return (
    <main className="stays-index">
      {listJsonLd && <JsonLd data={listJsonLd} />}
      <section
        className={`stays-index-hero${hasHeroMask ? " has-hero-mask" : ""}`}
        style={{
          backgroundImage: cssUrl(heroImage),
          /* 頁面 Hero 高度 reaches this hero too. It carried a hardcoded 78vh,
             so the setting was accepted in the admin and then ignored here —
             a page set to 全螢幕 opened at 78vh (客戶: 住宿頁的 hero 怎麼沒有
             100vh). Sent as a variable rather than an inline min-height so the
             phone rules can still read it. */
          ...(Object.prototype.hasOwnProperty.call(HERO_HEIGHT_MAP, String(pageCfg.hero_height ?? ""))
            ? { "--hero-h": HERO_HEIGHT_MAP[String(pageCfg.hero_height)] }
            : {}),
          ...(hasHeroMask
            ? { "--hero-mask": heroMaskColor, "--hero-mask-opacity": String(heroMaskPct! / 100) }
            : {}),
        } as React.CSSProperties}
      >
        <div className="stays-index-hero-inner">
          {/* The CLASS as well as the inline value, which is what PageHero does
              and what the stylesheet actually acts on: the copy column sits in a
              centred flex column and its paragraph carries `margin-inline: auto`,
              so text-align alone moved nothing and 靠左／靠右 read as inert. */}
          <div
            className={`stays-index-hero-copy${heroAlign ? ` is-align-${heroAlign}` : ""}`}
            style={heroAlign ? ({ textAlign: heroAlign } as React.CSSProperties) : undefined}
          >
            <div className="eyebrow">{copy.stays.all}</div>
            {heroTitle && <h1 style={heroTitleColor ? { color: heroTitleColor } : undefined}>{heroTitle}</h1>}
            {heroSubtitle && (
              <p style={heroSubtitleColor ? { color: heroSubtitleColor } : undefined}>{heroSubtitle}</p>
            )}
          </div>
        </div>
      </section>

      {/* The blocks 頁面編輯 holds for this page. The search bar used to be
          hardcoded right here, which meant it could not be moved, restyled or
          hidden like every other block on the site (客戶: 我需要這個區塊在頁面
          編輯中添加至精品Villa，移除默認的搜尋列). It is a `search` block now,
          seeded into this page's config so nothing disappears on deploy.
          searchInitial carries the current query string into it, so the bar
          still shows the filter the listing below is using. */}
      {blocks.length > 0 && (
        <PropertyPageRenderer
          blocks={blocks}
          locale={locale}
          siteSlug={site.slug}
          siteLine={site.contact_config?.line}
          searchInitial={{
            region: searchParams.region,
            destination: searchParams.destination,
            amenities: amenityList,
            guests: searchParams.guests,
            tag: searchParams.tag,
            experiences: experienceList,
          }}
        />
      )}

      <div className="stays-index-body">
        {stays.length ? (
          <StaysLoadMore
            stays={stays}
            detailsLabel={copy.stays.details}
            initialCount={9}
            loadMoreLabel={ui.loadMore}
            noMoreLabel={ui.noMore}
            locale={locale}
            propertySlugs={propertySlugs}
          />
        ) : (
          <section className="content-empty">
            <p>{copy.stays.empty}</p>
          </section>
        )}
      </div>
    </main>
  );
}

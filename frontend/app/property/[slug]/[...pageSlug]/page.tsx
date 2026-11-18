import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { getPages, getPropertySite, resolvePage } from "../../../modules/api";
import { getLocale, publicUiText, type Locale } from "../../../modules/i18n";
import { cfgT, trs } from "../../../modules/tr";
import { cssUrl } from "../../../modules/safeCss";
import { safeCssColor } from "../../../modules/fontPresets";
import { buildMetadata, pageSettingsSeo, seoTextForLocale, siteUrl } from "../../../modules/seo";
import { pageEntryMetadata } from "../../../modules/content/entryRoute";
import JsonLd from "../../../modules/JsonLd";
import ContentFacets from "../../../modules/content/ContentFacets";
import ArticleDetail from "../../../modules/content/ArticleDetail";
import { CATEGORY_TO_CONTENT_TYPE, resolveSubTabs } from "../../../modules/contentRoutes";
import PropertyPageRenderer from "../../../modules/property/PropertyPageRenderer";
import {
  resolveSiteName,
  pageLabel as resolvePageLabel,
  type PropertyBlock,
  type PropertyPageConfig,
} from "../../../modules/property/types";

/* ── Helpers ── */

function getPages_config(site: { settings?: Record<string, unknown> | null }): Record<string, PropertyPageConfig> {
  // Child sites have no static defaults; only explicitly-saved pages render.
  const s = site.settings ?? {};
  return ((s.pages ?? {}) as Record<string, PropertyPageConfig>);
}

/**
 * An entry the villa lists but does not own.
 *
 * `related_stay_ids` lets a parent-site post appear on a villa's listing, and
 * the card links at the villa's own URL — but resolving that URL looked only in
 * the villa's own site, so every shared entry listed fine and 404'd on click.
 * The lookup runs against the same list the listing is built from, so only
 * something already shared with this villa can resolve here.
 */
async function resolveSharedPage(contentType: string, identifier: string, staySlug: string) {
  const shared = await getPages(contentType, staySlug, undefined, staySlug);
  return shared.find((page) => page.slug === identifier || String(page.id) === identifier) ?? null;
}

/* ── Metadata ── */

export async function generateMetadata(props: { params: Promise<{ slug: string; pageSlug: string[] }> }) {
  const params = await props.params;
  const locale = await getLocale();
  const site = await getPropertySite(params.slug);
  // Returning {} left the 404 wearing the root layout's title, so an unknown
  // villa page was a page called "Slowfield Stays" that crawlers could index.
  if (!site) return buildMetadata({ title: publicUiText(locale).notFound, noIndex: true });

  const siteName = resolveSiteName(site, locale);
  const pageKey = params.pageSlug[0];
  const pages = getPages_config(site);
  const pageCfg = pages[pageKey];

  // CMS detail reached by URL category (e.g. /stays/{slug}/dining/{article} or
  // .../media-coverage/{article}) — no page key in settings, resolved via the
  // content-type category exactly the way the page component does below. Without
  // this branch it fell through to the block/list metadata below, which
  // canonicalised to the PARENT list and titled every article with the raw route
  // slug ("media-coverage"). Give it a self canonical and its own headline so the
  // metadata agrees with the Article JSON-LD the page already emits.
  if (!pageCfg && params.pageSlug.length >= 2 && CATEGORY_TO_CONTENT_TYPE[pageKey]) {
    const cmsPage =
      (await resolvePage(pageKey, params.pageSlug[1], params.slug)) ??
      (await resolveSharedPage(CATEGORY_TO_CONTENT_TYPE[pageKey], params.pageSlug[1], params.slug));
    if (cmsPage) {
      return pageEntryMetadata(cmsPage, locale, {
        path: `/stays/${params.slug}/${params.pageSlug.join("/")}`,
        site: { ...site, name: siteName },
        fallback: { zh: "文章", en: "Article" },
      });
    }
  }

  // CMS detail page (e.g. /stays/shamanya/articles/my-article)
  if (params.pageSlug.length >= 2 && pageCfg?.page_type === "cms_list") {
    const identifier = params.pageSlug[1];
    const contentType = pageCfg.content_type ?? "journal";
    const cmsPage = (await resolvePage(contentType, identifier, params.slug))
      ?? (await resolvePage("news", identifier, params.slug))
      ?? (await resolveSharedPage(contentType, identifier, params.slug));
    if (!cmsPage) return buildMetadata({ title: publicUiText(locale).notFound, noIndex: true });
    return pageEntryMetadata(cmsPage, locale, {
      path: `/stays/${params.slug}/${params.pageSlug.join("/")}`,
      site: { ...site, name: siteName },
      fallback: { zh: "文章", en: "Article" },
    });
  }

  // Block page or CMS list page
  const pageSeo = (pageCfg?.seo ?? {}) as Record<string, unknown>;
  const defaultLabel = resolvePageLabel(pageKey, pages, locale);
  /* The page's own hero subtitle before seo_defaults: a villa has six or seven
     sub-pages and they were all handing Google the same one-line site
     description, which is the duplicate-description warning in Search Console. */
  const heroSubtitle = cfgT(pageCfg as Record<string, unknown> | undefined, "hero_subtitle", locale);
  const heroImage = typeof pageCfg?.hero_image === "string" ? pageCfg.hero_image : undefined;
  /* The page editor offers 分享圖片 and 不要編入搜尋引擎索引 on villa pages too,
     but only the parent route read them: a villa page marked noindex was still
     handed to crawlers, and its share image was ignored in favour of the hero.
     Same helper the parent uses, so the two routes cannot drift again. */
  const settingsSeo = pageSettingsSeo(site, pageKey, locale);
  /* Strictly this locale, the way the group homepage reads its own seo block.
     cfgT borrows the other language when a field is empty, and the English half
     of an SEO field is the half editors leave blank — so an English villa
     sub-page was titled in Chinese rather than falling through to the page's own
     label. heroSubtitle below keeps cfgT deliberately: it is the copy printed in
     the hero, and the description has to match what the page says. */
  return buildMetadata({
    title: seoTextForLocale(pageSeo.title, locale) || `${seoTextForLocale(defaultLabel, locale, locale === "zh" ? "頁面" : "Page")} | ${siteName}`,
    description: seoTextForLocale(pageSeo.description, locale)
      || seoTextForLocale(heroSubtitle, locale)
      || seoTextForLocale(site.seo_defaults?.description, locale),
    image: settingsSeo.image || heroImage,
    noIndex: settingsSeo.noIndex,
    canonical: settingsSeo.canonical,
    path: `/stays/${params.slug}/${pageKey}`,
    site: { ...site, name: siteName },
  });
}

/* ── Page Component ── */

export default async function PropertyDynamicPage(
  props: {
    params: Promise<{ slug: string; pageSlug: string[] }>;
  }
) {
  const params = await props.params;
  const site = await getPropertySite(params.slug);
  if (!site) notFound();

  const locale = await getLocale();
  const pageKey = params.pageSlug[0];
  const pages = getPages_config(site);
  const pageCfg = pages[pageKey];

  // ── CMS detail reached by URL category ──
  // Content links are built from the entry's content_type, which gives a URL
  // category ("media-coverage", "news"), not the villa's page key ("media").
  // A card had no way to know the key, so it linked at the category and this
  // route 404'd on a page it could perfectly well render.
  if (!pageCfg && params.pageSlug.length >= 2 && CATEGORY_TO_CONTENT_TYPE[pageKey]) {
    const cmsPage = (await resolvePage(pageKey, params.pageSlug[1], params.slug))
      ?? (await resolveSharedPage(CATEGORY_TO_CONTENT_TYPE[pageKey], params.pageSlug[1], params.slug));
    if (!cmsPage) notFound();
    const listKey = Object.keys(pages).find(
      (k) => pages[k]?.page_type === "cms_list" && pages[k]?.content_type === cmsPage.content_type,
    ) ?? pageKey;
    const siblings = await getPages(cmsPage.content_type, params.slug, undefined, params.slug);
    return <CmsDetailView cmsPage={cmsPage} locale={locale} slug={params.slug} pageKey={listKey} pages={pages} siblings={siblings} siteDomain={site.domain} />;
  }

  // 404 when the key isn't in settings or has been tombstoned
  if (!pageCfg) notFound();
  if (pageCfg.deleted === true) notFound();

  // ── CMS detail page (e.g. /stays/shamanya/articles/my-article) ──
  if (params.pageSlug.length >= 2 && pageCfg.page_type === "cms_list") {
    const identifier = params.pageSlug[1];
    const contentType = pageCfg.content_type ?? "journal";
    // The villa's own slug, or the parent's entry is found instead of the
    // villa's — one domain serves both.
    const cmsPage = (await resolvePage(contentType, identifier, params.slug))
      ?? (await resolvePage("news", identifier, params.slug))
      ?? (await resolveSharedPage(contentType, identifier, params.slug));
    if (!cmsPage) notFound();
    const siblings = await getPages(cmsPage.content_type, params.slug, undefined, params.slug);
    return <CmsDetailView cmsPage={cmsPage} locale={locale} slug={params.slug} pageKey={pageKey} pages={pages} siblings={siblings} siteDomain={site.domain} />;
  }

  // ── CMS list page ──
  if (pageCfg.page_type === "cms_list") {
    const contentType = pageCfg.content_type ?? "news";
    // Categories folded into this list, mirroring the homepage block's
    // extra_sources. Without it the "看更多" link from a merged block landed on
    // a list showing only its primary category — the villa's press coverage was
    // on the homepage but nowhere else, and its own index had been retired.
    const extraTypes = (Array.isArray(pageCfg.extra_content_types) ? pageCfg.extra_content_types : [])
      .map((type) => String(type).trim())
      .filter((type) => type && type !== contentType);
    // The villa's slug goes with the request so the API also returns the
    // parent's brand-wide posts that name this villa — the mechanism behind
    // 品牌活動, and the only way a group-level service (外燴, 食材代購) written
    // once on the parent can appear on every villa that offers it.
    const lists = await Promise.all([contentType, ...extraTypes].map((type) => getPages(type, params.slug, undefined, params.slug)));
    const cmsPages = Array.from(new Map(lists.flat().map(page => [page.id, page])).values()).sort((a, b) => b.id - a.id);

    return <CmsListView cmsPages={cmsPages} locale={locale} slug={params.slug} pageKey={pageKey} pages={pages} />;
  }

  // ── Block-based page (default) ──
  const blocks = (pageCfg.blocks ?? []) as PropertyBlock[];
  const label = resolvePageLabel(pageKey, pages, locale);

  // Page-level hero from settings (hero_image, hero_title, hero_subtitle, hero_title_color, hero_subtitle_color, hero_height)
  const heroImage = typeof pageCfg.hero_image === "string" ? pageCfg.hero_image : "";
  const heroTitleObj = pageCfg.hero_title as Record<string, string> | undefined;
  const heroSubtitleObj = pageCfg.hero_subtitle as Record<string, string> | undefined;
  const heroTitle = heroTitleObj?.[locale] || heroTitleObj?.zh || heroTitleObj?.en || "";
  const heroSubtitle = heroSubtitleObj?.[locale] || heroSubtitleObj?.zh || heroSubtitleObj?.en || "";
  const heroTitleColor = safeCssColor(pageCfg.hero_title_color);
  const heroSubtitleColor = safeCssColor(pageCfg.hero_subtitle_color);
  const heroHeight = typeof pageCfg.hero_height === "string" ? pageCfg.hero_height : "";
  /* 「Hero 對齊」is offered on every managed page, villa pages included, but
     only the parent routes read it — so on a villa the control saved and did
     nothing. Allow-listed because it lands in a class name and a style
     attribute. */
  const heroAlign = ["left", "center", "right"].includes(String(pageCfg.hero_align ?? ""))
    ? String(pageCfg.hero_align)
    : "";
  /* Hero 遮罩. The control sits in the SAME page editor villa pages use, so
     without this a villa admin could pick a colour and a strength, save, and
     see the page unchanged — the silent no-op this route already carries a note
     about for 「Hero 對齊」. Same sanitiser and the same clamp as the parent
     renderer; `0` stays distinct from unset. */
  const heroMaskColor = safeCssColor(pageCfg.hero_mask_color);
  const rawHeroMask = pageCfg.hero_mask_opacity;
  const heroMaskPct =
    rawHeroMask === "" || rawHeroMask === null || rawHeroMask === undefined || Number.isNaN(Number(rawHeroMask))
      ? null
      : Math.min(100, Math.max(0, Math.round(Number(rawHeroMask))));
  const hasHeroMask = Boolean(heroImage) && Boolean(heroMaskColor) && heroMaskPct !== null && heroMaskPct > 0;

  const hasHero = !!(heroImage || heroTitle);

  // Height is applied via a CSS class (not inline) so a mobile media query can
  // shrink the hero — the customer flagged sub-page heroes as too tall on phones.
  /* `page-hero` carries nothing but the shared alignment rules, so borrowing
     it reuses them instead of restating them for this hero. */
  const heroClass = `page-hero property-hero-banner${heroHeight ? ` property-hero-banner--h-${heroHeight}` : ""}${hasHeroMask ? " has-hero-mask" : ""}`;

  return (
    <main>
      {hasHero && (
        <section
          className={heroClass}
          style={{
            ...(heroImage ? cssUrl(heroImage) ? { backgroundImage: cssUrl(heroImage) } : {} : {}),
            ...(hasHeroMask
              ? ({ "--hero-mask": heroMaskColor, "--hero-mask-opacity": String(heroMaskPct! / 100) } as CSSProperties)
              : {}),
          }}
        >
          <div
            className={`property-hero-banner-content${heroAlign ? ` is-align-${heroAlign}` : ""}`}
            style={heroAlign ? ({ textAlign: heroAlign } as CSSProperties) : undefined}
          >
            {heroTitle && <h1 style={heroTitleColor ? { color: heroTitleColor } : undefined}>{heroTitle}</h1>}
            {heroSubtitle && <p style={heroSubtitleColor ? { color: heroSubtitleColor } : undefined}>{heroSubtitle}</p>}
          </div>
        </section>
      )}
      {/* siteSlug matters to the blocks, not just the chrome: the newsletter
          block posts to `/newsletter/subscribe?site=…` and the stays block
          filters by it. The villa homepage passed it and this route did not, so
          every signup from a villa sub-page was filed unattributed. */}
      {/* The page always has a name — it is in <title>, in the nav, and in the
          empty state below — but it only became an <h1> when the editor had
          also set a hero title. So a villa sub-page with content had no h1 at
          all while the same page with nothing on it had one: inverted, and it
          left every configured sub-page without a document heading for screen
          readers or search results. Hidden rather than drawn, because these
          pages are designed to open on their blocks; same pattern the contact
          page already uses. */}
      {/* Only alongside blocks: the empty state below renders its own visible
          <h1>{label}</h1>, and two headings would be worse than none. */}
      {!hasHero && blocks.length > 0 && <h1 className="sr-only">{label}</h1>}
      {blocks.length > 0 ? (
        <PropertyPageRenderer blocks={blocks} locale={locale} siteSlug={params.slug} siteLine={site.contact_config?.line} />
      ) : !hasHero ? (
        <section className="property-empty-page section">
          <h1>{label}</h1>
          <p>{locale === "zh" ? "內容即將上線。" : "Content coming soon."}</p>
        </section>
      ) : null}
    </main>
  );
}

/* ── CMS List View ── */

function CmsListView({
  cmsPages,
  locale,
  slug,
  pageKey,
  pages,
}: {
  cmsPages: Awaited<ReturnType<typeof getPages>>;
  locale: Locale;
  slug: string;
  pageKey: string;
  pages: Record<string, PropertyPageConfig>;
}) {
  const zh = locale === "zh";
  const label = resolvePageLabel(pageKey, pages, locale);
  const ui = publicUiText(locale);

  return (
    <main>
      <section className="property-content-list section">
        <h1>{label}</h1>
        {/* The same all-sections tree the group site's index uses: the current
            section is the root and the villa's other CMS pages sit beside it as
            links, so the sidebar doubles as quick navigation (客戶). 搜尋框可在後台
            關閉 (客戶: 看起來有點多)，沒設過的頁面照舊顯示。 */}
        <ContentFacets
          items={cmsPages}
          layout="article"
          staySlug={slug}
          locale={locale}
          subTabs={resolveSubTabs((pages[pageKey] as Record<string, unknown> | undefined)?.sub_tabs, locale)}
          showSearch={(pages[pageKey] as Record<string, unknown> | undefined)?.show_search === true}
          showTags={(pages[pageKey] as Record<string, unknown> | undefined)?.show_tag_row !== false}
          copy={{
            loadMore: ui.loadMore,
            noMore: ui.noMore,
            readMore: zh ? "閱讀更多" : "Read more",
            searchLabel: zh ? `在${label}中搜尋` : `Search ${label}`,
            searchPlaceholder: zh ? "搜尋這個頁面" : "Search this page",
            allLabel: zh ? "全部" : "All",
            clearLabel: zh ? "清除" : "Clear",
            noResults: zh ? "暫無內容。" : "No content yet.",
          }}
        />
      </section>
    </main>
  );
}

/* ── CMS Detail View ── */

function CmsDetailView({
  cmsPage,
  locale,
  slug,
  pageKey,
  pages,
  siblings,
  siteDomain,
}: {
  cmsPage: NonNullable<Awaited<ReturnType<typeof resolvePage>>>;
  locale: Locale;
  slug: string;
  pageKey: string;
  pages: Record<string, PropertyPageConfig>;
  siblings: Awaited<ReturnType<typeof getPages>>;
  siteDomain: string;
}) {
  const zh = locale === "zh";
  const pageTitle = trs(cmsPage, "title", locale);
  const pageSummary = trs(cmsPage, "summary", locale);
  const listLabel = resolvePageLabel(pageKey, pages, locale);

  return (
    <main className="content-detail-page">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: seoTextForLocale(pageTitle, locale) || undefined,
          description: seoTextForLocale(pageSummary, locale) || undefined,
          image: cmsPage.cover_image_url ? siteUrl(cmsPage.cover_image_url, { domain: siteDomain }) : undefined,
          url: siteUrl(`/stays/${slug}/${pageKey}/${cmsPage.slug || cmsPage.id}`, { domain: siteDomain }),
        }}
      />
      <ArticleDetail
        page={cmsPage}
        locale={locale}
        category={listLabel}
        backHref={`/stays/${slug}/${pageKey}`}
        siblings={siblings}
        staySlug={slug}
        copy={{
          share: zh ? "分享" : "Share",
          related: zh ? "相關文章" : "Related",
          backToList: zh ? `回到${listLabel}` : `Back to ${listLabel}`,
          prev: zh ? "上一篇" : "Previous",
          next: zh ? "下一篇" : "Next",
        }}
      />
    </main>
  );
}

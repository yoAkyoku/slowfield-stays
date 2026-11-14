import { itemListJsonLd, seoTextForLocale } from "../seo";
import JsonLd from "../JsonLd";
import type { CSSProperties } from "react";
import { getAggregatedPages, getCurrentSite, getPages } from "../api";
import { buildContentHref, listingCategoriesForPage, resolveSubTabs } from "../contentRoutes";
import { getLocale, publicUiText, type Locale } from "../i18n";
import { trs, pickT } from "../tr";
import PageHero, { hasPageHero } from "./PageHero";
import { cssUrl } from "../safeCss";
import PageBlocks, { type PageBlock } from "./PageBlocks";
import ContentFacets from "./ContentFacets";

/**
 * Shared category page component.
 *
 * Renders:
 *   1. Property blocks from site.settings.pages[contentType].blocks (if any)
 *   2. A fallback hero section (if no blocks)
 *   3. CMS article list in the "article" layout (if show_cms_list is true)
 */
export default async function CategoryPage({
  contentType,
}: {
  contentType: string;
}) {
  const locale = (await getLocale()) as Locale;
  const ui = publicUiText(locale);

  // The site has to be resolved first: on a villa site its slug is what pulls in
  // the parent's brand-wide posts ticked for this villa, so the two calls cannot
  // run in parallel any more.
  const site = await getCurrentSite();
  const staySlug = site.parent_site_id ? site.slug : undefined;
  // On the group site, 媒體報導 surfaces the coverage that lives on each villa,
  // not just the parent's own entries (客戶: 母站聚合子站那 9 篇). Every aggregated
  // card links back to the child it came from.
  const aggregateChildren = !site.parent_site_id && contentType === "media";
  // Page keys locate layouts; selected categories independently locate articles.
  const pagesConfig = (site.settings?.pages ?? {}) as Record<string, Record<string, unknown>>;
  const pageConfig = pagesConfig[contentType] ?? {};
  const sources = listingCategoriesForPage(contentType, pageConfig);
  const lists = await Promise.all(sources.map(source => aggregateChildren ? getAggregatedPages(source) : getPages(source, staySlug)));
  const pages = Array.from(new Map(lists.flat().map(page => [page.id, page])).values());

  // A content type added from the admin has no bundled copy. This used to fall
  // back to the brand page's copy, so a brand-new page introduced itself as
  // "品牌介紹" until someone set a hero title. Its own name in page management is
  // the honest fallback; the hero fields below still override it.
  const bundled = ui.content[contentType as keyof typeof ui.content] as unknown as Record<string, string> | undefined;
  const pageLabel = pickT(pageConfig.label, locale);
  const copy: Record<string, string> = bundled ?? {
    title: pageLabel,
    eyebrow: pageLabel,
    intro: "",
    empty: locale === "zh" ? "內容即將上線。" : "Content is coming soon.",
  };
  const blocks = Array.isArray(pageConfig.blocks) ? (pageConfig.blocks as PageBlock[]) : [];
  const showCmsList = pageConfig.show_cms_list !== false; // default true for category pages
  /* 客戶: 搜尋分類應該就不太需要了、看起來有點多。
     Default OFF, not on. The tags are the categorisation the client asked for,
     and showing tags + a search box together is the "too many controls" state
     they rejected — leaving it on by default meant every page that had never
     been configured shipped in exactly that state. Turn it back on per page in
     the CMS (show_search: true) where a long index genuinely needs it. */
  const showSearch = pageConfig.show_search === true;
  /* The category chip row (全部／關於我們／品牌理念…). Managed on its own switch
     rather than riding on show_search: a page can want the search box without
     the chips or the chips without the box (客戶: 需要分開管理). Default ON —
     every page that has never been configured keeps the row it renders today. */
  const showTags = pageConfig.show_tag_row !== false;
  /* 客戶: 內容要置中。The list shares the copy's measure and centres each
     card's text, so the page reads as one column instead of a wide grid sitting
     under a narrow column. `=== true`, so an index that has never been
     configured keeps the full-width grid it renders today. */
  const cardsMatchText = pageConfig.cards_match_text === true;
  // Every CMS index renders the same way as a villa index now — the "article"
  // layout with the tree on the left (客戶: 母站分類欄位/卡片要和子站一樣). The
  // old magazine/featured/grid variants and the top sub-tab row are gone; the
  // sidebar tree carries the sub-categories instead.

  /* Hero: the page editor's own fields, read by the shared PageHero. The
     legacy site.settings.hero_<type> stays the fallback image. */
  const heroFallbackImage = (site.settings?.[`hero_${contentType}`] as string | undefined) || "";
  const showConfiguredHero = hasPageHero(pageConfig, locale) || Boolean(heroFallbackImage);

  const hasBlocks = blocks.filter((b) => b.enabled !== false).length > 0;

  /* Every category index — 旅遊專欄, 最新消息, 餐飲服務 — was a page of links
     with no structured data behind it. ItemList tells a crawler what the list
     is and where each entry goes. */
  const listJsonLd = itemListJsonLd(
    pages.map((entry) => ({
      name: seoTextForLocale(trs(entry, "title", locale), locale),
      url: buildContentHref(entry, staySlug),
      image: entry.cover_image_url,
    })),
    copy.title || contentType,
    site,
  );

  return (
    <main className={`content-index content-index-${contentType}`}>
      {listJsonLd && <JsonLd data={listJsonLd} />}
      {/* Page-level hero - same component and same admin fields as 聯絡我們 */}
      {showConfiguredHero ? (
        <PageHero
          config={pageConfig}
          locale={locale}
          className="content-index-hero"
          fallbackImage={heroFallbackImage}
          fallbackTitle={copy.title}
          fallbackSubtitle={copy.intro}
        />
      ) : !hasBlocks ? (
        <section className="page-hero content-index-hero">
          <div>
            <h1>{copy.title}</h1>
            <p>{copy.intro}</p>
          </div>
        </section>
      ) : null}

      {/* Section 1: Property blocks */}
      {hasBlocks && <PageBlocks blocks={blocks} locale={locale} siteSlug={site.slug} />}

      {/* Section 2: CMS article list (optional) */}
      {showCmsList && pages.length > 0 ? (
        <section className={`category-browse-section section${cardsMatchText ? " is-cards-match-text" : ""}`}>
          <ContentFacets
            items={pages}
            layout="article"
            locale={locale}
            subTabs={resolveSubTabs(pageConfig.sub_tabs, locale)}
            showSearch={showSearch}
            showTags={showTags}
            copy={{
              loadMore: ui.loadMore,
              noMore: ui.noMore,
              readMore: locale === "zh" ? "閱讀更多" : "Read more",
              searchLabel: locale === "zh" ? `在${copy.title}中搜尋` : `Search ${copy.title}`,
              searchPlaceholder: locale === "zh" ? "搜尋這個分類" : "Search this section",
              allLabel: locale === "zh" ? "全部" : "All",
              clearLabel: locale === "zh" ? "清除" : "Clear",
              noResults: locale === "zh" ? "沒有符合的內容。" : "Nothing matches that.",
            }}
          />
        </section>
      ) : showCmsList && pages.length === 0 ? (
        <section className="content-empty">
          <p>{copy.empty}</p>
        </section>
      ) : null}
    </main>
  );
}

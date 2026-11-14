import Link from "next/link";
import ScrollRail from "../../content/ScrollRail";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { getCurrentSite, getPages, getPagesByIds, getPropertySite, getPropertySites, getStays, type Page } from "../../api";
import { contentTypeCatalogue } from "../../contentTypes";
import { buildContentHref, contentIndexHref } from "../../contentRoutes";
import type { Locale } from "../../i18n";
import { publicUiText, t } from "../../i18n";
import { cardTagsT, cfgT, clearableT, hasCardTags, localizeAmenity, trs , eyebrowT, tagsT, tagKey} from "../../tr";
import CardCover from "../../content/CardCover";
import StayCard from "../../stays/StayCard";
import StayShowcaseCard from "../../stays/StayShowcaseCard";
import NewsCategoryFilter from "./NewsCategoryFilter";
import CardTagFilter, { type TaggedCard } from "./CardTagFilter";
import ViewAllFooter from "../ViewAllFooter";
import { staysVariantsFor } from "../../blockStyle";
import { stayLocationLabel } from "../../stayLocations";
import { contentFilterTags, hasContentFilterTag } from "../../contentFilter";

export type BlockStaysConfig = {
  /** "stays" (default) pulls from the stay catalogue; anything else is a CMS content_type */
  source?: string;
  extra_sources?: string[];
  /** Public filtering is explicit and independent from source count or card copy. */
  filter_by?: "category" | "tags";
  /** New multi-select filter; `filter_tag` remains supported for old blocks. */
  filter_tags?: string[];
  filter_tag?: string;
  limit?: number;
  variant?: "grid" | "list" | "compact" | "index" | "feature" | "news";
  show_tags?: boolean;
  show_filter?: boolean;
  /** Empty keeps the automatic tag list; values narrow printed labels. For a
   * multi-source block these are source keys, so the setting survives locale
   * changes; legacy localized labels are still accepted when reading. */
  picked_tags?: string[];
  eyebrow?: string | Record<string, string>;
  headline?: string | Record<string, string>;
  /** Overrides the auto label ("查看更多住宿" / "閱讀更多旅誌" / …) — admin-editable per block. */
  view_all_label?: string | Record<string, string>;
};

/**
 * Merge the per-source result sets without rendering one article twice.
 *
 * A page can belong to more than one CMS category (`categories`) and the API
 * quite deliberately returns it for each matching source. It is still one
 * public article, though, so the multi-source collection should show one card
 * and one link. Prefer the stable id, then the canonical public href for old
 * or imported rows that do not have a usable id.
 */
export function dedupeContentPages(pages: Page[], staySlug?: string): Page[] {
  const seen = new Set<string>();
  return pages.filter((page) => {
    const href = buildContentHref(page, staySlug).toLocaleLowerCase();
    const keys = [href ? `href:${href}` : "", page.id > 0 ? `id:${page.id}` : ""].filter(Boolean);
    if (keys.some((key) => seen.has(key))) return false;
    keys.forEach((key) => seen.add(key));
    return true;
  });
}

/** The news row: a plain grid, or a rail with arrows when the block asks. */
function NewsRow({ rail, label, children }: { rail: boolean; label: string; children: React.ReactNode }) {
  if (!rail) return <div className="home-news-grid">{children}</div>;
  return (
    <ScrollRail className="home-news-grid is-rail" ariaLabel={label}>
      {children}
    </ScrollRail>
  );
}

export default async function BlockStays({
  locale,
  config,
  staySlug,
}: {
  locale: Locale;
  config?: BlockStaysConfig;
  /** Set on a villa site so brand-wide posts ticked for this villa are included. */
  staySlug?: string;
}) {
  const { home: h } = t(locale);
  const c = (config ?? {}) as Record<string, unknown>;
  const source = String(c.source ?? "stays");
  const limit = Math.max(1, Number(c.limit ?? 6));
  const isStays = source === "stays";
  /* Three of the six layouts are built in only one of the two branches below:
     精選大圖 renders a showcase from stays, 最新消息卡 and 編號列表 render from
     CMS pages. Picked against the other source, the branch that draws them is
     never reached and the request fell through to the shared tail, which put
     `home-collection--feature` / `--news` / `--index` on the row — three class
     names with no rule anywhere in globals.css. The row then looked exactly
     like 網格, so the dropdown appeared to do nothing (客戶: 檢查所有 block 的
     設置是否生效, 一個一個檢查).

     Falling back to the layout that is actually drawn is the honest render: the
     page gets a real design instead of an unstyled one. The editor no longer
     offers the combination at all, so this only catches blocks saved before
     that gate existed. */
  const requestedVariant = String(c.variant ?? "grid");
  const variant = staysVariantsFor(isStays).includes(requestedVariant) ? requestedVariant : "grid";

  const zh = locale === "zh";
  // An eyebrow the admin has cleared stays cleared. cfgT treats "" as missing
  // and hands back the fallback, so a bare cfgT call cannot express "none" —
  // only an absent key takes the default label.
  const eyebrow = eyebrowT(c, locale, h.selected);
  /* …and so does a cleared HEADLINE, for exactly the same reason. The eyebrow
     beside it has been clearable since the comment above was written; this line
     was left on cfgT, so a collection placed under a heading that is already on
     the page could not avoid printing 「為你嚴選的台灣旅宿」 over itself. Every
     stays block on the site today carries a real headline (checked: 5 of 5), so
     nothing existing changes — only "cleared" becomes expressible. */
  const headline = clearableT(c, "headline", locale, h.headline);
  // staySlug is set on a villa site — see contentIndexHref for why its content
  // links have to stay under /stays/{slug}.
  const viewAllHref = isStays ? "/stays" : contentIndexHref(source, staySlug);
  const gridClass = `grid home-collection home-collection--${variant}`;
  // 橫向滑動: lay the cards out in one scrolling row instead of wrapping, so a
  // section that keeps gaining entries stops stretching the page downward.
  // A scrolling region has to be focusable in its own right — otherwise a
  // keyboard user reaches the first cards and can never scroll to the rest.
  const railRequested = c.rail === true;
  // A rail with one or two entries has nothing to scroll — it just leaves a
  // narrow card against an empty row, which is what 精選住宿 was doing with a
  // single villa. Below three, the short-row layout wins over the setting.
  const rail = railRequested;

  // 顯示標籤 / 分類篩選 — the news variant has had category chips all along;
  // these let any other variant show the same CMS tags on its cards and, if
  // asked, put the chip row above them too. Both default off so no existing
  // block changes appearance until an editor turns them on.
  const showTags = c.show_tags === true;
  const showFilter = c.show_filter === true;
  // 要顯示的標籤 — an explicit list narrows both the chips and the card tags to
  // it, so a working tag (待補圖, a one-off) can be kept out of the public row
  // without editing the entries. Empty means every tag, which is the default.
  const pickedTags = Array.isArray(c.picked_tags)
    ? (c.picked_tags as unknown[]).map((t) => String(t).trim()).filter(Boolean)
    : [];

  // 額外分類 — categories this row pulls in beside its main one. With any set,
  // the chips become the category names rather than the entries' tags: mixing
  // the two would put 媒體報導 next to 櫻花 and mean nothing.
  const extraSources = (Array.isArray(c.extra_sources) ? (c.extra_sources as unknown[]) : [])
    .map((s) => String(s).trim())
    .filter((s) => s && s !== source);
  const byCategory = extraSources.length > 0;
  const filterByCategory = c.filter_by === "category" || (c.filter_by !== "tags" && byCategory);
  const ui = publicUiText(locale);
  /* The category's own name, as the CLIENT named it in 頁面管理 — which is where
     they rename one and where the header, the footer and the CMS dropdown read
     it from. This used to read i18n.ts's `content` table and nothing else, a
     hand-written list of eleven types that page management has never fed. Two
     things came out of that on the live site, both of them reported: 慢域選品
     is not in that table at all, so its chip printed the bare key "curation" on
     a Chinese page (客戶: 為何有些分類標籤只有英文), and 最新消息 — renamed by the
     client — kept printing the bundled 慢域消息, so the admin and the page called
     the same category different things. The table stays as a last resort for a
     content type that has no page at all. */
  /* The villa's own page management, not the group's. getCurrentSite() sends
     /site/resolve with NO site parameter, so it always answers with the group
     site — a villa page therefore sorted and named its categories by the
     PARENT's settings. Measured on hejing: news is sort_order 0 and dining
     3 on the villa, but 5 and 4 the other way round on the group, and the
     villa's chips came out 餐飲服務 before 最新消息 — the reported symptom,
     surviving the sort fix because the sort was reading the wrong site.
     staySlug is already threaded here for exactly this kind of reason
     (PropertyPageRenderer passes it); it simply was not used for this. */
  const catalogueSite = staySlug
    ? (await getPropertySite(staySlug)) ?? (await getCurrentSite())
    : await getCurrentSite();
  const catalogue = contentTypeCatalogue(catalogueSite, locale);
  const otherLocaleCatalogue = contentTypeCatalogue(catalogueSite, locale === "zh" ? "en" : "zh");
  const categoryLabel = (type?: string | null) => {
    const key = String(type ?? "page");
    const configured = catalogue.get(key)?.label;
    if (configured) return configured;
    const entry = (ui.content as Record<string, { title?: string } | undefined>)[key];
    return entry?.title || key;
  };
  /* Older multi-source blocks stored the localized category label in
     `picked_tags`. New blocks store the source key so switching the public
     locale cannot make the selected categories disappear. Match both shapes
     while reading, and compare keys/labels case-insensitively for renamed or
     hand-imported data. */
  const categoryIsPicked = (type: string) => {
    if (!pickedTags.length) return true;
    const entries = [catalogue.get(type), otherLocaleCatalogue.get(type)].filter(Boolean);
    const aliases = [
      type,
      ...entries.flatMap((entry) => [entry?.key, entry?.type, entry?.label]),
    ]
      .filter(Boolean)
      .map((value) => tagKey(value));
    return pickedTags.some((picked) => aliases.includes(tagKey(picked)));
  };
  const visibleTags = (list: string[]) =>
    pickedTags.length ? list.filter((tag) => pickedTags.some((picked) => tagKey(picked) === tagKey(tag))) : list;
  const visibleCategoryTags = (type?: string | null) => {
    const key = String(type ?? "page");
    return categoryIsPicked(key) ? [categoryLabel(key)] : [];
  };
  const pageCardTags = (page: Page) => {
    if (c.filter_by === "category" || c.filter_by === "tags") return cardTagsT(page, locale);
    if (!byCategory) return visibleTags(cardTagsT(page, locale));
    // In a merged row picked_tags contains source categories, not article
    // labels. Keep that allow-list working while letting an article's own
    // card-label selection replace the legacy category chip.
    if (!categoryIsPicked(page.content_type)) return [];
    return hasCardTags(page, locale)
      ? cardTagsT(page, locale)
      : visibleCategoryTags(page.content_type);
  };
  /* The chips, in 頁面管理's order. They were built from whichever entry the
     merge happened to reach first — the merge is newest-first across every
     category, so the chip order was really "which category owns the newest
     post" and moved on its own as entries were published (客戶: 多分類順序是按照
     選擇的來源順序). tagKey because that is what the chip row compares on. */
  const categoryOrder = filterByCategory
    ? [source, ...extraSources]
        .sort((a, b) =>
          (catalogue.get(a)?.sort ?? Number.MAX_SAFE_INTEGER) -
            (catalogue.get(b)?.sort ?? Number.MAX_SAFE_INTEGER) || a.localeCompare(b))
        .map((type) => tagKey(categoryLabel(type)))
    : undefined;

  /* The generic label says "stays"; use a fitting label per content type —
     unless the admin has set one explicitly (cfgT treats "" as unset, so a
     cleared field falls back to the same auto label rather than going blank).

     On a row that merges categories the automatic label names the one the link
     goes to. 「查看更多」 under 最新消息＋餐飲服務＋慢域選品 promised more of all
     three and delivered /news — the destination has only ever been the primary
     source's own index, and no editor control exists that could widen it (the
     villa list route folds in extra_content_types, the group's category route
     does not, and neither is exposed in 頁面管理). Naming the destination in the
     link is the honest version of the same behaviour: the reader is told where
     they are going before they click, the link is not taken away, and an admin
     who wants different words still overrides it. Needs `categoryLabel`, hence
     the position — this used to sit above the fetch. */
  const viewAllLabel = cfgT(c, "view_all_label", locale) || (
    isStays
      ? h.viewAll
      : byCategory
        ? (zh ? `查看更多${categoryLabel(source)}` : `More ${categoryLabel(source)}`)
        : source === "journal"
          ? (zh ? "閱讀更多專欄" : "Read more notes")
          : (zh ? "查看更多" : "View all")
  );
  let cards: React.ReactNode;
  // Tag lists parallel to `cards`, built only when the chip row is on — the
  // filter needs each card's tags, and the cards themselves are already
  // rendered by then.
  let taggedCards: TaggedCard[] = [];
  // How many cards the row ends up with. The grid was a fixed three columns, so
  // a catalogue of one put a third-width card against two empty thirds — see
  // the .is-n1 / .is-n2 rules, which give a short row a layout that suits it.
  let cardCount = 0;
  if (isStays) {
    const [staysAll, propertySites] = await Promise.all([getStays(), getPropertySites()]);
    // Manual mode applies here too. Without this the picker in the admin let an
    // editor tick villas, saved the ids, and the block quietly went on showing
    // the first N by sort order.
    const pickedStayIds = Array.isArray(c.picked_ids) ? (c.picked_ids as number[]).filter((n) => Number.isFinite(n)) : [];
    const stays = c.pick_mode === "manual" && pickedStayIds.length
      ? (pickedStayIds.map((id) => staysAll.find((s) => s.id === id)).filter(Boolean) as typeof staysAll)
      : staysAll.slice(0, limit);
    if (!stays.length) return null;
    if (!stays.length) return null;
    // Child-matched stays redirect to the child site at /stays/{slug}; route their
    // cards to /stays/detail/{slug} so the parent detail page shows instead.
    const propertySlugs = propertySites.map((s) => s.slug);

    // Featured villas — premium card showcase with per-card photo carousel and
    // two CTAs (民宿官網 → property page, 立即訂房 → inquiry). Scales from a single
    // hero villa to a multi-villa grid as the catalogue grows.
    if (variant === "feature" || variant === "showcase") {
      const cards = stays.map((s, idx) => {
        const imgs = [s.hero_image_url, ...(s.images ?? []).map((im) => im.image_url)].filter(Boolean);
        const isProperty = propertySlugs.includes(s.slug);
        const href = isProperty ? `/stays/${s.slug}` : `/stays/detail/${s.slug}`;
        // 立即訂房 priority: explicit booking_url → the villa's own (child) site
        // booking section (#booking) → the parent inquiry form. (Previously the
        // child fallback went to /contact, i.e. the 交通聯繫 page, not booking.)
        const bookHref = (s.booking_url && /^https?:\/\//.test(s.booking_url))
          ? s.booking_url
          : isProperty
            ? `/stays/${s.slug}#booking`
            // The contact form reads ?stay= as a numeric id (Number(stayId));
            // a slug became NaN, serialised to null, and the booking request
            // still succeeded — filed against no villa at all.
            : `/contact?stay=${s.id}`;
        return {
          slug: s.slug,
          number: String(idx + 1).padStart(2, "0"),
          name: trs(s, "name", locale),
          region: stayLocationLabel(s, locale),
          summary: trs(s, "summary", locale),
          tags: (s.amenities ?? []).slice(0, 4).map((a) => localizeAmenity(a, locale)),
          images: imgs,
          propertyHref: href,
          bookHref,
        };
      })
        /* A stay with no photos at all draws a 5:4 grey panel with no arrows,
           no dots and no auto-advance — which is what 沒有跑出照片 / 右邊沒有
           輪播 / 跑到沒有圖片就卡住了 were all describing. Nothing is stuck:
           it is a card with nothing in it. Left out of the row rather than
           drawn as a hole, so the showcase only ever shows stays that have a
           picture to show. */
        .filter((c) => c.images.length > 0);
      return (
        <section className="section home-showcase-section">
          {(eyebrow || headline) && (
            <div className="home-showcase-head home-reveal">
              {eyebrow && <span className="eyebrow">{eyebrow}</span>}
              {headline && <h2>{headline}</h2>}
            </div>
          )}
          <div className={`home-showcase-grid${cards.length === 1 ? " is-single" : ""}`}>
            {cards.map((c) => (
              <StayShowcaseCard
                key={c.slug}
                stay={c}
                locale={locale}
                introLabel={zh ? "民宿官網" : "Villa website"}
                bookLabel={zh ? "立即訂房" : "Book now"}
              />
            ))}
          </div>
          <ViewAllFooter href="/stays" label={viewAllLabel} icon={ArrowRight} reveal />
        </section>
      );
    }

    cardCount = stays.length;
    const stayNodes = stays.map((stay) => {
      const stayTags = visibleTags(tagsT(stay, locale));
      return {
        stay,
        tags: stayTags,
        node: (
          <StayCard
            key={stay.slug}
            stay={stay}
            detailsLabel={t(locale).stays.details}
            locale={locale}
/* A card must land somewhere that answers. `/stays/{slug}` is the villa's own
     site, which exists only while that site is published — so a villa listed
     here before its site goes live sent every click to a 404. The parent's
     detail page always exists, so it is the destination whenever the villa site
     is not live. (Two paths in this file disagreed about this; one routed
     live villas to their own site, the other to the detail page and everything
     else to a URL that might not exist.) */
            detailHref={propertySlugs.includes(stay.slug) ? undefined : `/stays/detail/${stay.slug}`}
            tags={showTags ? stayTags : undefined}
          />
        ),
      };
    });
    cards = stayNodes.map((s) => s.node);
    taggedCards = stayNodes.map((s) => ({ key: s.stay.slug, tags: s.tags, node: s.node }));
  } else {
    // Optional category filter. Multiple selected tags use OR semantics; the
    // shared reader still accepts legacy single-value `filter_tag` blocks.
    const filterTags = contentFilterTags(c);
    // Manual mode shows exactly what was ticked, in the order it was ticked —
    // so the category filter and the count do not apply; the choice already is
    // the filter.
    const pickedIds = Array.isArray(c.picked_ids) ? (c.picked_ids as number[]).filter((n) => Number.isFinite(n)) : [];
    const manual = c.pick_mode === "manual" && pickedIds.length > 0;

    let pages: Page[];
    if (manual) {
      const chosen = await getPagesByIds(pickedIds);
      const byId = new Map(chosen.map((page) => [page.id, page]));
      // Kept in the order they were ticked, and an id that no longer resolves
      // (unpublished, deleted) simply drops out rather than leaving a hole.
      pages = pickedIds.map((id) => byId.get(id)).filter(Boolean) as Page[];
    } else {
      // 多個分類 — one row that draws from several CMS categories at once, with
      // the categories themselves as the tabs (客戶: 內容分類要按 CMS 分類做成
      // tab，新聞報導也放裡面). A block used to be tied to exactly one category,
      // so 最新消息 and 媒體報導 could only ever be two separate rows.
      const list = extraSources.length ? [source, ...extraSources] : [source];
      const fetchedPerSource = await Promise.all(list.map((src) => getPages(src, staySlug)));
      // The count is per source (客戶: 顯示數量是每個來源的數量, 3 來源 × 15 = 45):
      // take up to `limit` newest from each category, then merge newest-first —
      // so a busy category cannot crowd a quiet one out and every source is
      // represented. A single-source block is unchanged (limit == total).
      const perSource = fetchedPerSource.map((entries) => {
        const eligible = filterTags.length
          ? entries.filter((page) => hasContentFilterTag(page.tags, filterTags) || hasContentFilterTag(tagsT(page, locale), filterTags))
          : entries;
        return [...eligible].sort((a, b) => b.id - a.id).slice(0, limit);
      });
      pages = dedupeContentPages(perSource.flat().sort((a, b) => b.id - a.id), staySlug);
    }
    if (!pages.length) return null;

    // 最新消息 — OA Hotel-style three-up news cards: cover + category + title +
    // read-more. CMS-driven. Client asked to hide the活動 date on the front (the
    // published_at is still kept/editable in the admin), so no date badge here.
    if (variant === "news") {
      return (
        <section className="section home-news-section">
          {(eyebrow || headline) && (
            <div className="home-news-head">
              {eyebrow && <div className="eyebrow">{eyebrow}</div>}
              {headline && <h2>{headline}</h2>}
            </div>
          )}
          <NewsCategoryFilter
            rail={rail}
            label={String(headline || eyebrow || "")}
            allLabel={zh ? "全部" : "All"}
            readMore={zh ? "閱讀更多" : "Read more"}
            order={categoryOrder}
            cards={pages.map((page) => ({
              id: page.id,
              href: buildContentHref(page, staySlug),
              title: trs(page, "title", locale),
              summary: trs(page, "summary", locale),
              // Category names when the row spans several categories, the
              // entries' own tags when it does not — see byCategory.
              // A multi-source row still falls back to its category chip for
              // legacy articles, but an article-level card label selection is
              // authoritative when present. Category picks remain a source
              // allow-list and do not filter the article's own labels.
              tags: pageCardTags(page),
              filterTags: filterByCategory ? Array.from(new Set([page.content_type, ...(page.categories ?? [])])).filter((type) => [source, ...extraSources].includes(type)).map((type) => categoryLabel(type)) : tagsT(page, locale),
              cover: page.cover_image_url ?? "",
            }))}
          />
          <ViewAllFooter href={viewAllHref} label={viewAllLabel} icon={ArrowUpRight} />
        </section>
      );
    }

    cardCount = pages.length;
    if (variant === "index") {
      // Magazine-style numbered index: 01 / title / short summary / thin divider.
      cards = pages.map((page, i) => {
        const title = trs(page, "title", locale);
        const summary = trs(page, "summary", locale);
        return (
          <Link href={buildContentHref(page, staySlug)} className="home-journal-row" key={page.id}>
            <span className="home-journal-num">{String(i + 1).padStart(2, "0")}</span>
            <div className="home-journal-text">
              <strong>{title}</strong>
              {summary && <p>{summary}</p>}
            </div>
            <span className="home-journal-arrow" aria-hidden="true">&#8594;</span>
          </Link>
        );
      });
    } else {
      const pageNodes = pages.map((page) => {
        const title = trs(page, "title", locale);
        const summary = trs(page, "summary", locale);
        const pageTags = pageCardTags(page);
        return {
          page,
          tags: pageTags,
          node: (
            <Link href={buildContentHref(page, staySlug)} className="home-collection-card" key={page.id}>
              <CardCover src={page.cover_image_url} alt={title} className="home-collection-card-img" />
              <div className="home-collection-card-body">
                {/* Leading the card, same place the news variant prints its
                    category (client: tags 顯示在上方). */}
                {showTags && pageTags.length > 0 && (
                  <div className="tags tags--lead">
                    {pageTags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
                  </div>
                )}
                <strong>{title}</strong>
                {summary && <p>{summary}</p>}
              </div>
            </Link>
          ),
        };
      });
      cards = pageNodes.map((p) => p.node);
      taggedCards = pageNodes.map((p) => ({
        key: String(p.page.id),
        tags: p.tags,
        filterTags: filterByCategory ? Array.from(new Set([p.page.content_type, ...(p.page.categories ?? [])])).filter((type) => [source, ...extraSources].includes(type)).map((type) => categoryLabel(type)) : tagsT(p.page, locale),
        node: p.node,
      }));
    }
  }

  return (
    <section className="section">
      {/* Not an empty box. The header carries 24px of padding and 32px of
          margin below it whether or not it holds anything, so a collection
          placed under a heading the page already has — both fields cleared —
          still pushed its cards 56px down from nothing at all
          (客戶: 住宿卡片與標題太遠). */}
      {(eyebrow || headline) && (
        <div className="section-header">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            {headline && <h2>{headline}</h2>}
          </div>
        </div>
      )}
      {(() => {
        // Under three entries the short-row layout applies even when 橫向滑動
        // is on, and the rail itself is dropped: there is nothing to scroll, so
        // the setting was only costing the row its layout.
        const shortRow = variant !== "index" && cardCount > 0 && cardCount < 3;
        // 編號列表 is a column flex list and .is-rail never sets flex-direction,
        // so the rail class left it stacked while giving every row a 240-320px
        // flex basis — read as height in a column — and no horizontal scroll.
        // The control is hidden for this variant, but a value saved before that
        // is still on the page, so it is refused here as well.
        const useRail = rail && !shortRow && variant !== "index";
        const rowClass = `${variant === "index" ? "home-journal-index" : gridClass}${
          shortRow ? ` is-n${cardCount}` : ""
        }`;
        // The chip row owns the grid when it is on, because filtering changes
        // which cards are in it. The index variant is a numbered list, not a
        // card row, so it keeps its own markup.
        if (showFilter && variant !== "index" && taggedCards.length > 0) {
          return (
            <CardTagFilter
              items={taggedCards}
              gridClassName={rowClass}
              rail={useRail}
              label={String(headline || eyebrow || viewAllLabel)}
              allLabel={zh ? "全部" : "All"}
              order={categoryOrder}
            />
          );
        }
        /* One rail, not two implementations of one.
           This branch used to put the `is-rail` CLASS on a plain div. The row
           scrolled — but the arrows are drawn by ScrollRail the COMPONENT, so a
           row reached this way had 橫向捲動 on and no arrows, while 最新消息 —
           which has a chip filter and therefore goes through CardTagFilter, and
           so through the real component — had them. Identical block settings,
           two behaviours, and what decided it was whether the block happened to
           have categories (客戶: 輪播按鈕不是勾選「橫向捲動」就會出現?).
           BlockArticles' RailOrGrid already did it this way.
           ScrollRail supplies tabIndex / role / aria-label itself, which is all
           railProps ever carried — and carried on the raw `rail` rather than on
           `useRail`, so a short row that asked for a rail got a focusable
           "region" with nothing to scroll. */
        if (useRail) {
          return (
            <ScrollRail className={`${rowClass} is-rail`} ariaLabel={String(headline || viewAllLabel)}>
              {cards}
            </ScrollRail>
          );
        }
        return <div className={rowClass}>{cards}</div>;
      })()}
      {/* Centred at the bottom, same spacing as the news and showcase blocks
          (client: 查看更多要置中在底部，上下填充參考旅宿和消息的) — it used to sit
          top-right next to the heading, which read as a different kind of link
          from the other two 精選內容 variants. */}
      <ViewAllFooter href={viewAllHref} label={viewAllLabel} icon={ArrowUpRight} />
    </section>
  );
}

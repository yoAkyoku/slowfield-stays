"use client";

import { ArrowUpRight, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buildContentHref } from "../contentRoutes";
import type { Locale } from "../i18n";
import { cardTagsT, tagKey, tagsT, trs } from "../tr";
import { ArticleCard } from "./cards";
import JournalMagazineGrid from "./JournalMagazineGrid";
import LoadMoreGrid, { type CardItem } from "./LoadMoreGrid";

/**
 * The panel of categories beside a list of entries, and the filtering it drives.
 *
 * Both indexes on this site want the same thing — sections, a count each, the
 * one you are in marked, the entries beside it — and had it written twice: once
 * for a villa's index and once for the group site's. Two copies of "count the
 * entries per section" is one place to change the rule and one place to forget,
 * with no error when they disagree, so they are one component now.
 *
 * The two jobs stay distinguishable through the data, not through a mode flag:
 *
 *   · a facet with `href` navigates      — the group site's sections are pages
 *   · a facet without one filters here   — a villa's categories are one list
 *
 * so nothing has to ask which kind of index it is rendering.
 */

export type FacetCopy = {
  loadMore: string;
  noMore: string;
  readMore: string;
  searchLabel: string;
  searchPlaceholder: string;
  allLabel: string;
  clearLabel: string;
  noResults: string;
  /** What the chip row is called, for the reader who cannot see it is a row of
   *  categories. Optional, with a locale-aware fallback below.
   *
   *  It replaces `moreTagsLabel`, which was the caption of a 「更多」 button
   *  removed when the counts and the overflow control went (客戶: 分類列不要
   *  more). The string outlived the button and was still being handed to this
   *  row as its accessible name, so a screen reader announced the category
   *  filter as "更多標籤" — a group promising more of something rather than the
   *  categories it holds. Nothing reads it now, so it is gone from the type and
   *  from both callers rather than left as a field everyone keeps filling in. */
  categoryLabel?: string;
};

export default function ContentFacets({
  items,
  subTabs,
  layout = "grid",
  staySlug,
  locale,
  copy,
  showSearch = true,
  showTags = true,
}: {
  items: CardItem[];
  /** Tags the admin curated for this page's filter row (客戶: 後台選 tag，可複選).
   *  Absent → the row falls back to every tag the entries carry. Each label is
   *  what shows; the tag is the value that filters. */
  subTabs?: Array<{ label: string; tag: string }>;
  /** "article" is the villa index's card; the rest are the group site's layouts. */
  layout?: "article" | "grid" | "magazine" | "featured";
  staySlug?: string;
  locale: Locale;
  copy: FacetCopy;
  showSearch?: boolean;
  /** The chip row above the list. Off hides the row AND stops tag filtering
   *  entirely — with no chips there is no control to undo a filter, so a page
   *  that still honoured ?tag= would show a silent subset of its entries. */
  showTags?: boolean;
}) {
  /** A tagKey, not a label. */
  const [tag, setTag] = useState("");
  const [query, setQuery] = useState("");

  // A jump from another section lands here as ?tag=…; apply it once on mount so
  // the destination opens already filtered rather than showing everything.
  useEffect(() => {
    if (!showTags) return;
    const param = new URLSearchParams(window.location.search).get("tag");
    if (param) setTag(tagKey(param));
  }, [showTags]);

  const tags = useMemo(() => {
    // Counted per tagKey: editors type tags freely, so one category reaches here
    // spelled several ways and used to be counted — and chipped — as several.
    // The first spelling seen is the label, so the reader keeps the editor's casing.
    const counts = new Map<string, { name: string; count: number }>();
    for (const item of items) {
      for (const raw of tagsT(item as Parameters<typeof tagsT>[0], locale)) {
        const key = tagKey(raw);
        if (!key) continue;
        const hit = counts.get(key);
        if (hit) hit.count += 1;
        else counts.set(key, { name: raw.trim(), count: 1 });
      }
    }
    // Pass an explicit locale to localeCompare: with the argument omitted it
    // collates using the host environment's default locale, which is Node's on
    // the server and the browser's on the client. For Chinese tag strings the
    // two disagree, so the default-open tag list rendered in a different order
    // server vs client — a hydration mismatch (React #418/#423/#425). A fixed
    // locale makes the same-count tie-break deterministic across both.
    return Array.from(counts.entries()).sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0], locale));
  }, [items, locale]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const itemTags = tagsT(item as Parameters<typeof tagsT>[0], locale);
      if (tag && !itemTags.some((t) => tagKey(t) === tag)) return false;
      if (!q) return true;
      return [
        trs(item as Parameters<typeof trs>[0], "title", locale),
        trs(item as Parameters<typeof trs>[0], "summary", locale),
        ...itemTags,
      ].join(" ").toLowerCase().includes(q);
    });
  }, [items, query, tag, locale]);

  const isFiltering = Boolean(query.trim() || tag);
  /** Live tags for the current section. */
  const currentTags = useMemo(() => tags.map(([key, t]) => ({ key, name: t.name, count: t.count })), [tags]);

  /** The chips in the filter row. The admin's curated tags when it set any (only
   *  those that actually match an entry, so a stale pick never shows an empty
   *  filter); otherwise every tag the entries carry. No counts — the row is the
   *  reference's plain label strip (客戶: 分類列不顯示數量). */
  const tagChips = useMemo(() => {
    // Match the curated picks against the entries by tagKey: the admin's "Local"
    // and an entry's "local" are the same category, and comparing the raw strings
    // dropped the chip as stale (客戶: 後台選了 tag，前台卻沒出現).
    const present = new Set(currentTags.map((t) => t.key));
    if (subTabs?.length) {
      return subTabs
        .filter((st) => present.has(tagKey(st.tag)))
        .map((st) => ({ label: st.label, tag: tagKey(st.tag) }));
    }
    return currentTags.map((t) => ({ label: t.name, tag: t.key }));
  }, [subTabs, currentTags]);

  return (
    <div className="facets-cat">
      {/* No big section bar here (客戶: 不需要大分類) — the sections live in the
          site nav; this panel is just the tag filter for the current list. */}
      {/* Curated tag filter row — the admin's chosen tags, centred, filtering in
          place. No "more" button and no counts (客戶: 分類列不要 more、tag 置中、
          不顯示數量); the picking happens in the admin, not here. */}
      {/* The row is named for what it is. It used to borrow `moreTagsLabel`
          — the caption of a 「更多」 button that was removed when the counts and
          the overflow control went — so a screen reader announced this filter
          strip as "更多標籤" / "More tags", a group promising more of something
          rather than the categories it actually holds. */}
      {showTags && tagChips.length > 0 && (
        <div
          className="facets-tagrow"
          role="group"
          aria-label={copy.categoryLabel ?? (locale === "zh" ? "分類" : "Categories")}
        >
          <button
            type="button"
            aria-pressed={!tag}
            className={`facets-tagchip${!tag ? " is-active" : ""}`}
            onClick={() => setTag("")}
          >
            {copy.allLabel}
          </button>
          {tagChips.map((c) => (
            <button
              key={c.tag}
              type="button"
              aria-pressed={tag === c.tag}
              className={`facets-tagchip${tag === c.tag ? " is-active" : ""}`}
              onClick={() => setTag(tag === c.tag ? "" : c.tag)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* Search only — the count/clear beside it is gone (客戶: 搜尋框右邊的數量
          與清除移除); the tag row and the search field's own ✕ cover clearing. */}
      {showSearch && (
        <div className="facets-cat-toolbar">
          <label className="facets-search-field">
            <Search aria-hidden="true" size={15} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={copy.searchPlaceholder}
              aria-label={copy.searchLabel}
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label={copy.clearLabel}>
                <X size={14} />
              </button>
            )}
          </label>
        </div>
      )}

      <div className="facets-cat-main">
        {visible.length > 0 ? (
          <FacetList
            items={visible}
            layout={isFiltering && layout !== "article" ? "grid" : layout}
            locale={locale}
            copy={copy}
            staySlug={staySlug}
            showTags={showTags}
          />
        ) : (
          <p className="facets-empty">{copy.noResults}</p>
        )}
      </div>
    </div>
  );
}

/* ── The entries ──
   Four shapes for one list, kept together because they differ only in the card:
   "article" is the villa index's, the other three are the group site's. */

function FacetList({
  items,
  layout,
  locale,
  copy,
  staySlug,
  showTags = true,
}: {
  items: CardItem[];
  layout: string;
  locale: Locale;
  copy: FacetCopy;
  staySlug?: string;
  /** Same switch as the chip row above. 旅遊專欄 is categorised by tag and by
   *  nothing else (客戶: 以標籤作為主要分類方式，不另外增加複雜搜尋分類), so the
   *  tag has to be readable on the card as well as clickable in the row — the
   *  reader could filter by a category the cards never admitted to carrying.
   *  Off hides both, so an index with the row switched off stays as it was. */
  showTags?: boolean;
}) {
  if (layout === "article") {
    return (
      <div className="articles-grid">
        {items.map((item) => {
          const title = trs(item as Parameters<typeof trs>[0], "title", locale);
          const tags = showTags
            ? cardTagsT(item as Parameters<typeof cardTagsT>[0], locale)
            : [];
          return (
            <ArticleCard
              key={item.id}
              heading="h2"
              href={buildContentHref(item as Parameters<typeof buildContentHref>[0], staySlug)}
              title={title}
              summary={trs(item as Parameters<typeof trs>[0], "summary", locale)}
              cover={item.cover_image_url}
              tags={tags}
            />
          );
        })}
      </div>
    );
  }

  if (layout === "magazine" && items.length > 0) {
    const [feature, ...rest] = items;
    return (
      <>
        <section className={`journal-feature${rest.length === 0 ? " is-alone" : ""}`}>
          <FeatureCard item={feature} locale={locale} copy={copy} className="journal-feature-card" imageClass="journal-feature-image" bodyClass="journal-feature-body" />
        </section>
        {rest.length > 0 && (
          <section className="journal-magazine">
            <JournalMagazineGrid items={rest} initialCount={9} loadMoreLabel={copy.loadMore} noMoreLabel={copy.noMore} locale={locale} />
          </section>
        )}
      </>
    );
  }

  if (layout === "featured" && items.length > 0) {
    const [feature, ...rest] = items;
    return (
      <>
        <section className="activity-featured">
          <FeatureCard item={feature} locale={locale} copy={copy} className="activity-featured-panel" imageClass="activity-featured-image" bodyClass="activity-featured-copy" />
        </section>
        {rest.length > 0 && (
          <section className="category-article-list">
            <LoadMoreGrid items={rest} initialCount={6} loadMoreLabel={copy.loadMore} noMoreLabel={copy.noMore} className="content-card-grid" locale={locale} />
          </section>
        )}
      </>
    );
  }

  return (
    <section className="category-article-list">
      <LoadMoreGrid items={items} initialCount={6} loadMoreLabel={copy.loadMore} noMoreLabel={copy.noMore} className="content-card-grid" locale={locale} />
    </section>
  );
}

function FeatureCard({
  item,
  locale,
  copy,
  className,
  imageClass,
  bodyClass,
}: {
  item: CardItem;
  locale: Locale;
  copy: FacetCopy;
  className: string;
  imageClass: string;
  bodyClass: string;
}) {
  const title = trs(item as Parameters<typeof trs>[0], "title", locale);
  const summary = trs(item as Parameters<typeof trs>[0], "summary", locale);
  const meta = cardTagsT(item as Parameters<typeof cardTagsT>[0], locale).join(" / ") || item.content_type;
  return (
    <Link href={buildContentHref(item as Parameters<typeof buildContentHref>[0])} className={className}>
      {item.cover_image_url && (
        <div className={imageClass}>
          <img src={item.cover_image_url} alt={title} />
        </div>
      )}
      <div className={bodyClass}>
        <div className="content-card-meta"><span>{meta}</span></div>
        <h2>{title}</h2>
        {summary && <p>{summary}</p>}
        <span className="content-hero-link">{copy.readMore} <ArrowUpRight size={16} /></span>
      </div>
    </Link>
  );
}

"use client";

import { Fragment, useMemo, useState } from "react";
import ScrollRail from "../../content/ScrollRail";
import { tagKey } from "../../tr";

export type TaggedCard = {
  /** Stable key — the entry's id or slug. */
  key: string;
  /** Every tag on the entry, already localised. */
  tags: string[];
  /** Optional labels used by the filter row when the card prints another set.
   *  Multi-source news cards use category names for filtering while displaying
   *  the article's own card-label selection. */
  filterTags?: string[];
  /** The card itself, rendered on the server. */
  node: React.ReactNode;
};

/**
 * Category chips over any card row.
 *
 * The news variant grew one of these first and it only ever read `tags[0]`, so
 * an entry tagged 在地, 櫻花 could be found under 在地 and nowhere else — the
 * rest of its tags were invisible to the reader even though the editor had
 * filled them in. This reads every filter tag, and takes pre-rendered cards so
 * every variant — the news row included, via NewsCategoryFilter — shares this
 * row and brings only its own card markup. A card may print a separate,
 * editor-selected label set while the row still filters by its source category.
 *
 * Chips come from the entries on show, so the row can never offer one that
 * empties the list. A single category still gets a row: the editor asked for
 * the chips, and hiding them when the content happens to use one tag makes the
 * setting look broken (客戶: 只顯示 1 個時怎麼就沒有全部和那一個的 chip).
 */
/**
 * The chips a set of cards produces, in the order they should read.
 *
 * Keyed by tagKey so 在地/Local and local are one chip, labelled with the first
 * spelling seen — matching on the raw string split a category into a chip per
 * casing, each holding part of its entries.
 *
 * `order` ranks the keys it names and leaves the rest where the entries put
 * them. Without it the row's order is "whichever entry the caller listed first
 * introduced this chip", which for a multi-category collection meant "whichever
 * category owns the newest post" — an order that moved on its own every time
 * something was published.
 *
 * A function, not the body of the useMemo it feeds, so the ordering can be run
 * in a test rather than only read.
 */
export function chipsFor(items: TaggedCard[], order?: string[]): Array<[string, string]> {
  const seen = new Map<string, string>();
  for (const item of items) {
    for (const tag of item.filterTags ?? item.tags) {
      const key = tagKey(tag);
      if (key && !seen.has(key)) seen.set(key, tag.trim());
    }
  }
  const found = Array.from(seen.entries());
  if (!order?.length) return found;
  /* Stable, so an unranked chip keeps the position the entries gave it rather
     than being shuffled in among the ranked ones. */
  const rank = new Map(order.map((key, i) => [key, i]));
  return found.sort(
    ([a], [b]) =>
      (rank.get(a) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b) ?? Number.MAX_SAFE_INTEGER),
  );
}

export default function CardTagFilter({
  items,
  gridClassName,
  rail = false,
  label,
  allLabel,
  order,
}: {
  items: TaggedCard[];
  gridClassName: string;
  rail?: boolean;
  label: string;
  allLabel: string;
  /** tagKeys in the order the chips should read, for a row whose chips are CMS
   *  categories rather than free-text tags — the caller knows what order the
   *  client put those categories in and the cards do not. Anything not listed
   *  keeps its place after them. Left off, the chips read as they always have:
   *  in the order the entries introduce them. */
  order?: string[];
}) {
  const categories = useMemo(() => chipsFor(items, order), [items, order]);

  /** A tagKey, not a label. */
  const [active, setActive] = useState("");
  const shown = active
    ? items.filter((item) => (item.filterTags ?? item.tags).some((t) => tagKey(t) === active))
    : items;
  const nodes = shown.map((item) => <Fragment key={item.key}>{item.node}</Fragment>);

  return (
    <>
      {categories.length > 0 && (
        <div className="home-news-filter" role="group" aria-label={label}>
          <button
            type="button"
            className={active === "" ? "is-active" : ""}
            aria-pressed={active === ""}
            onClick={() => setActive("")}
          >
            {allLabel}
          </button>
          {categories.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={active === key ? "is-active" : ""}
              aria-pressed={active === key}
              onClick={() => setActive(key)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {rail ? (
        <ScrollRail className={`${gridClassName} is-rail`} ariaLabel={label}>{nodes}</ScrollRail>
      ) : (
        <div className={gridClassName}>{nodes}</div>
      )}
    </>
  );
}

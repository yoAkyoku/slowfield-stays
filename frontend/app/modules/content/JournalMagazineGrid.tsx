"use client";

import Link from "next/link";
import { buildContentHref } from "../contentRoutes";
import type { Locale } from "../i18n";
import { cardTagsT, trs } from "../tr";
import LoadMore from "./LoadMore";
import type { CardItem } from "./LoadMoreGrid";

type JournalItem = CardItem;

export default function JournalMagazineGrid({
  items,
  initialCount,
  loadMoreLabel,
  noMoreLabel,
  locale,
}: {
  items: JournalItem[];
  initialCount: number;
  loadMoreLabel: string;
  noMoreLabel: string;
  locale?: Locale;
}) {
  const itemTitle = (item: JournalItem) => locale ? trs(item, "title", locale) : item.title;
  const itemSummary = (item: JournalItem) => locale ? trs(item, "summary", locale) : (item.summary ?? "");

  return (
    /* The load-more grid with the magazine's own card: the first one leads. */
    <LoadMore
      items={items}
      initialCount={initialCount}
      loadMoreLabel={loadMoreLabel}
      noMoreLabel={noMoreLabel}
      className="journal-magazine-grid"
      render={(page, index) => (
        <article
          className={`journal-mag-card ${index === 0 ? "journal-mag-card--lead" : ""}`}
          key={page.id}
        >
          <Link href={buildContentHref(page)}>
            <div className="journal-mag-card-image">
              {page.cover_image_url ? (
                <img src={page.cover_image_url} alt={itemTitle(page)} loading="lazy" />
              ) : (
                <span>{page.content_type}</span>
              )}
            </div>
            <div className="journal-mag-card-body">
              <span className="journal-mag-card-tag">
                {(locale ? cardTagsT(page, locale) : (page.tags ?? [])).join(" / ") || page.content_type}
              </span>
              <h3>{itemTitle(page)}</h3>
              {itemSummary(page) ? <p>{itemSummary(page)}</p> : null}
            </div>
          </Link>
        </article>
      )}
    />
  );
}

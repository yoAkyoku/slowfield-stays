"use client";

import Link from "next/link";
import { useState } from "react";
import { buildContentHref } from "../contentRoutes";
import type { Locale } from "../i18n";
import { cardTagsT, trs } from "../tr";

type JournalItem = {
  id: number;
  slug: string | null;
  title: string;
  summary?: string;
  cover_image_url?: string;
  content_type: string;
  tags?: string[];
  translations?: Record<string, Record<string, string>>;
};

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
  const [shown, setShown] = useState(initialCount);
  const visible = items.slice(0, shown);
  const hasMore = shown < items.length;

  const itemTitle = (item: JournalItem) => locale ? trs(item, "title", locale) : item.title;
  const itemSummary = (item: JournalItem) => locale ? trs(item, "summary", locale) : (item.summary ?? "");

  return (
    <>
      <div className="journal-magazine-grid">
        {visible.map((page, index) => (
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
        ))}
      </div>
      <div className="load-more-container">
        {hasMore ? (
          <button
            className="load-more-button"
            type="button"
            onClick={() => setShown((s) => Math.min(s + initialCount, items.length))}
          >
            {loadMoreLabel}
          </button>
        ) : items.length > initialCount ? (
          <span className="load-more-done">{noMoreLabel}</span>
        ) : null}
      </div>
    </>
  );
}

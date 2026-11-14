"use client";

import { useState } from "react";
import type { Stay } from "../api";
import type { Locale } from "../i18n";
import StayCard from "./StayCard";

export default function StaysLoadMore({
  stays,
  detailsLabel,
  initialCount,
  loadMoreLabel,
  noMoreLabel,
  locale = "en",
  propertySlugs = [],
}: {
  stays: Stay[];
  detailsLabel: string;
  initialCount: number;
  loadMoreLabel: string;
  noMoreLabel: string;
  locale?: Locale;
  propertySlugs?: string[];
}) {
  const [shown, setShown] = useState(initialCount);
  const visible = stays.slice(0, shown);
  const hasMore = shown < stays.length;

  return (
    <>
      <div className="stays-grid">
        {visible.map((stay) => (
          <StayCard
            key={stay.slug}
            stay={stay}
            detailsLabel={detailsLabel}
            locale={locale}
            /* See BlockStays: the detail page is the fallback for a villa whose
               own site is not published, not the other way round. */
            detailHref={propertySlugs.includes(stay.slug) ? undefined : `/stays/detail/${stay.slug}`}
          />
        ))}
      </div>
      <div className="load-more-container">
        {hasMore ? (
          <button
            className="load-more-button"
            type="button"
            onClick={() => setShown((s) => Math.min(s + initialCount, stays.length))}
          >
            {loadMoreLabel}
          </button>
        ) : stays.length > initialCount ? (
          <span className="load-more-done">{noMoreLabel}</span>
        ) : null}
      </div>
    </>
  );
}

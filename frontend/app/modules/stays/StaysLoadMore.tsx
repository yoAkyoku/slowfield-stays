"use client";

import type { Stay } from "../api";
import type { Locale } from "../i18n";
import StayCard from "./StayCard";
import LoadMore from "../content/LoadMore";

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
  return (
    <LoadMore
      items={stays}
      initialCount={initialCount}
      loadMoreLabel={loadMoreLabel}
      noMoreLabel={noMoreLabel}
      className="stays-grid"
      render={(stay) => (
        <StayCard
          key={stay.slug}
          stay={stay}
          detailsLabel={detailsLabel}
          locale={locale}
          /* See BlockStays: the detail page is the fallback for a villa whose
             own site is not published, not the other way round. */
          detailHref={propertySlugs.includes(stay.slug) ? undefined : `/stays/detail/${stay.slug}`}
        />
      )}
    />
  );
}

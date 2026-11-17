"use client";

import { useState, type ReactNode } from "react";
import { buildContentHref } from "../contentRoutes";
import type { Locale } from "../i18n";
import { cardTagsT, trs } from "../tr";
import { ContentCard } from "./cards";

export type CardItem = {
  id: number;
  slug: string | null;
  title: string;
  summary?: string;
  cover_image_url?: string;
  content_type: string;
  tags?: string[];
  translations?: Record<string, Record<string, string>>;
};

export default function LoadMoreGrid({
  items,
  initialCount,
  loadMoreLabel,
  noMoreLabel,
  className,
  locale,
  children,
}: {
  items: CardItem[];
  initialCount: number;
  loadMoreLabel: string;
  noMoreLabel: string;
  className?: string;
  locale?: Locale;
  children?: (item: CardItem, index: number) => ReactNode;
}) {
  const [shown, setShown] = useState(initialCount);
  const visible = items.slice(0, shown);
  const hasMore = shown < items.length;

  const itemTitle = (item: CardItem) => locale ? trs(item, "title", locale) : item.title;
  const itemSummary = (item: CardItem) => locale ? trs(item, "summary", locale) : (item.summary ?? "");

  const defaultCard = (item: CardItem, index: number) => (
    <ContentCard
      key={item.id}
      index={index}
      href={buildContentHref(item)}
      title={itemTitle(item)}
      summary={itemSummary(item)}
      cover={item.cover_image_url}
      meta={(locale ? cardTagsT(item, locale) : (item.tags ?? [])).join(" / ") || item.content_type}
      placeholder={item.content_type}
    />
  );

  const renderCard = children || defaultCard;

  return (
    <>
      <div className={className || "content-card-grid"}>
        {visible.map((item, index) => renderCard(item, index))}
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

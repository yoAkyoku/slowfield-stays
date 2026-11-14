"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useState, type CSSProperties, type ReactNode } from "react";
import { buildContentHref } from "../contentRoutes";
import type { Locale } from "../i18n";
import { cardTagsT, trs } from "../tr";

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
    <article className="content-card" key={item.id} style={{ "--content-index": index } as CSSProperties}>
      <Link aria-label={itemTitle(item)} href={buildContentHref(item)}>
        <div className="content-card-media">
          {item.cover_image_url ? <img src={item.cover_image_url} alt={itemTitle(item)} loading="lazy" /> : <span>{item.content_type}</span>}
        </div>
        <div className="content-card-body">
          <div className="content-card-meta">
            <span>{(locale ? cardTagsT(item, locale) : (item.tags ?? [])).join(" / ") || item.content_type}</span>
            <ArrowUpRight size={18} />
          </div>
          <h2>{itemTitle(item)}</h2>
          {itemSummary(item) ? <p>{itemSummary(item)}</p> : null}
        </div>
      </Link>
    </article>
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

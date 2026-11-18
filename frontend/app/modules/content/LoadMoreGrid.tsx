"use client";

import type { ReactNode } from "react";
import { buildContentHref } from "../contentRoutes";
import type { Locale } from "../i18n";
import { cardTagsT, trs } from "../tr";
import { ContentCard } from "./cards";
import LoadMore from "./LoadMore";

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

  return (
    <LoadMore
      items={items}
      initialCount={initialCount}
      loadMoreLabel={loadMoreLabel}
      noMoreLabel={noMoreLabel}
      className={className || "content-card-grid"}
      render={children || defaultCard}
    />
  );
}

"use client";

import CardTagFilter, { type TaggedCard } from "./CardTagFilter";
import { NewsCard } from "../../content/cards";

export type NewsCard = {
  id: number;
  href: string;
  title: string;
  summary: string;
  /** All editor-selected labels printed on the card. Filter chips can use
   *  separate source-category labels through `filterTags`. */
  tags: string[];
  filterTags?: string[];
  cover: string;
};

/**
 * The news list with a category filter a visitor can actually use.
 *
 * The block already had a category setting, but it was the editor's: it decided
 * which entries appeared and the reader saw a fixed list. The categories were
 * printed on each card with no way to act on them.
 *
 * Only the card markup is the news variant's own — the chips, the filtering and
 * the grid/rail tail are CardTagFilter's, which this variant grew first and the
 * others were then generalised onto.
 */
export default function NewsCategoryFilter({
  cards,
  rail,
  label,
  allLabel,
  readMore,
  order,
}: {
  cards: NewsCard[];
  rail: boolean;
  label: string;
  allLabel: string;
  readMore: string;
  /** Passed straight through — see CardTagFilter. */
  order?: string[];
}) {
  const items: TaggedCard[] = cards.map((card) => ({
    key: String(card.id),
    tags: card.tags,
    filterTags: card.filterTags,
    node: (
      <NewsCard href={card.href} title={card.title} summary={card.summary} cover={card.cover} tags={card.tags} readMore={readMore} />
    ),
  }));

  return (
    <CardTagFilter
      items={items}
      gridClassName="home-news-grid"
      rail={rail}
      label={label}
      allLabel={allLabel}
      order={order}
    />
  );
}

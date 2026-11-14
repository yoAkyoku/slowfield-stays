"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import CardCover from "../../content/CardCover";
import CardTagFilter, { type TaggedCard } from "./CardTagFilter";

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
      <Link href={card.href} className="home-news-card">
        <CardCover src={card.cover} alt={card.title} className="home-news-img" />
        <div className="home-news-body">
          {card.tags.length > 0 && <div className="tags tags--lead">{card.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>}
          <h3 title={card.title}>{card.title}</h3>
          {card.summary && <p>{card.summary}</p>}
          <span className="home-news-more">{readMore} <ArrowUpRight size={15} /></span>
        </div>
      </Link>
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

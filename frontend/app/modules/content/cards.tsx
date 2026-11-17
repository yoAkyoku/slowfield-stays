import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import CardCover from "./CardCover";

/**
 * The two content cards the public site draws, each in one place.
 *
 * `content-card` (listing pages, the load-more grid, a stay's related reading)
 * was written out three times; the copy on the stay page had drifted to a
 * media class no stylesheet styles, so its covers rendered unsized.
 * `article-card` (the 文章 block and the filtered category pages) was written
 * twice, and only one copy fell back to a placeholder for a missing cover.
 */

type Heading = "h2" | "h3" | "h4";

/** A listing card: cover, a meta line with the card's tags, title, summary. */
export function ContentCard({
  href,
  title,
  summary,
  cover,
  meta,
  placeholder,
  index,
  heading: H = "h2",
}: {
  href: string;
  title: string;
  summary?: string;
  cover?: string | null;
  /** The meta line: the card's tags, or the section name when it has none. */
  meta: string;
  /** Shown in the media frame when there is no cover. */
  placeholder: string;
  /** Position in the grid, for the staggered entrance. */
  index?: number;
  heading?: Heading;
}) {
  return (
    <article className="content-card" style={index === undefined ? undefined : ({ "--content-index": index } as CSSProperties)}>
      <Link aria-label={title} href={href}>
        <div className="content-card-media">
          {cover ? <img src={cover} alt={title} loading="lazy" /> : <span>{placeholder}</span>}
        </div>
        <div className="content-card-body">
          <div className="content-card-meta">
            <span>{meta}</span>
            <ArrowUpRight size={18} />
          </div>
          <H>{title}</H>
          {summary ? <p>{summary}</p> : null}
        </div>
      </Link>
    </article>
  );
}

/** An article card: cover (or its placeholder), a lead row of tags, title, summary. */
export function ArticleCard({
  href,
  title,
  summary,
  cover,
  tags,
  heading: H = "h3",
}: {
  href: string;
  title: string;
  summary?: string;
  cover?: string | null;
  tags: string[];
  /** h2 where the card is the section's own content (nothing sits between the
   *  page h1 and it), h3 under a section heading. The stylesheet matches both. */
  heading?: Heading;
}) {
  return (
    <Link href={href} className="article-card">
      <CardCover src={cover ?? ""} alt={title} className="article-card-img" />
      <div className="article-card-body">
        {/* .tags--lead, not .article-tags: the latter is the article page's own
            trailing row (centred, 44px above it), which inside a card opens a
            gap over the title. Same markup the 最新消息 cards use. */}
        {tags.length > 0 && (
          <div className="tags tags--lead">
            {tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
          </div>
        )}
        <H>{title}</H>
        {summary ? <p>{summary}</p> : null}
      </div>
    </Link>
  );
}

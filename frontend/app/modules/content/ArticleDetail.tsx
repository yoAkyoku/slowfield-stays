import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Page } from "../api";
import type { Locale } from "../i18n";
import { pickT, trs } from "../tr";
import ContentBlockRenderer from "./ContentBlockRenderer";
import ShareButtons from "./ShareButtons";
import CardCover from "./CardCover";
import { articleNav, formatArticleDate, type ArticleLink, type RelatedArticle } from "./articleNav";

export type ArticleCopy = {
  share: string;
  related: string;
  backToList: string;
  prev: string;
  next: string;
};

/**
 * One article layout for the whole network (客戶 reference: title / category·date
 * left, share right / centred body / back · prev · next / related).
 *
 * Parent editorial and villa press pages rendered the same entry two ways, which
 * is how they drifted apart; this is the single layout both use. The summary and
 * cover are deliberately not shown on the article itself — the headline carries
 * it, and the body starts straight away.
 */
export default function ArticleDetail({
  page,
  locale,
  category,
  backHref,
  siblings,
  staySlug,
  copy,
}: {
  page: Page;
  locale: Locale;
  category: string;
  backHref: string;
  /** Every entry in this category, for prev / next / related. */
  siblings: Page[];
  staySlug?: string;
  copy: ArticleCopy;
}) {
  const title = trs(page, "title", locale);
  const body = trs(page, "body", locale);
  const paragraphs = body.split("\n").map((p) => p.trim()).filter(Boolean);
  const dateStr = formatArticleDate(page.published_at);
  const { prev, next, related } = articleNav(siblings, page, locale, staySlug, category);

  // Articles open with a rich_text block that repeats the title (and an eyebrow
  // of tags/source) — a leftover from when the header did not show the title
  // (客戶: 內文的「分類·企劃 + 標題」是哪來的). The header carries it now, so drop
  // that duplicate: strip the leading block's heading + eyebrow, keeping only its
  // prose, and drop the block outright if that is all it held.
  const rawBlocks = page.body_blocks?.length ? page.body_blocks : [];
  const blocks = (() => {
    const first = rawBlocks[0] as unknown as { type?: string; text?: unknown; config?: Record<string, unknown> } | undefined;
    if (!first) return rawBlocks;
    const resolve = (v: unknown) => pickT(v, locale);
    const norm = (s: string) => s.replace(/\s+/g, " ").trim();
    const titleN = norm(title);
    // A leading heading echoes the title when it equals it, or when the title is
    // just it with a brand prefix — "慢域旅遊 全新官網上線" vs "全新官網上線". The
    // length guard keeps a short genuine section heading from being swallowed.
    const echoesTitle = (h: string) => {
      const hn = norm(h);
      if (!hn) return false;
      if (hn === titleN) return true;
      return hn.length >= 4 && hn.length >= titleN.length * 0.5 && (titleN.endsWith(hn) || hn.endsWith(titleN));
    };
    // A standalone heading block that just restates the title → drop it whole.
    if (first.type === "heading" && echoesTitle(resolve(first.text))) {
      return rawBlocks.slice(1);
    }
    // A rich_text intro block that restates the title (± an eyebrow of tags) →
    // strip its heading and eyebrow, keep only its prose (drop it if that is all).
    if (first.type === "rich_text" && first.config && echoesTitle(resolve(first.config.heading))) {
      const prose = resolve(first.config.body).trim();
      const cleanedFirst = { ...first, config: { ...first.config, heading: undefined, eyebrow: undefined } };
      return prose ? [cleanedFirst as unknown as (typeof rawBlocks)[number], ...rawBlocks.slice(1)] : rawBlocks.slice(1);
    }
    return rawBlocks;
  })();

  return (
    <article className={`article article-${page.content_type}`}>
      <header className="article-head">
        <h1 className="article-title">{title}</h1>
        <div className="article-metarow">
          <div className="article-meta">
            <span className="article-cat">{category}</span>
            {dateStr && (
              <time className="article-date" dateTime={page.published_at ?? undefined}>
                {dateStr}
              </time>
            )}
          </div>
          <ShareButtons title={title} label={copy.share} />
        </div>
      </header>

      <div className="article-body" data-render-locale={locale}>
        {blocks.length ? (
          <ContentBlockRenderer blocks={blocks} locale={locale} />
        ) : (
          paragraphs.map((p, i) => <p key={i}>{p}</p>)
        )}
      </div>

      <nav className="article-nav" aria-label={copy.backToList}>
        {prev ? (
          <Link className="article-nav-arrow article-nav-prev" href={prev.href} aria-label={`${copy.prev}: ${prev.title}`}>
            <ArrowLeft size={18} aria-hidden="true" />
          </Link>
        ) : (
          <span className="article-nav-arrow article-nav-prev is-disabled" aria-hidden="true">
            <ArrowLeft size={18} />
          </span>
        )}
        <Link className="article-nav-back" href={backHref}>
          {copy.backToList}
        </Link>
        {next ? (
          <Link className="article-nav-arrow article-nav-next" href={next.href} aria-label={`${copy.next}: ${next.title}`}>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        ) : (
          <span className="article-nav-arrow article-nav-next is-disabled" aria-hidden="true">
            <ArrowRight size={18} />
          </span>
        )}
      </nav>

      {related.length > 0 && (
        <section className="article-related">
          <h2 className="article-related-title">{copy.related}</h2>
          <div className="article-related-grid">
            {related.map((item: RelatedArticle) => (
              <Link className="article-related-card" href={item.href} key={item.href}>
                <div className="article-related-img">
                  <CardCover src={item.image} alt={item.title} className="article-related-cover" />
                </div>
                <div className="article-related-body">
                  <div className="article-related-meta">
                    <span>{item.category}</span>
                    {item.date && <span>{item.date}</span>}
                  </div>
                  <h3>{item.title}</h3>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

export type { ArticleLink };

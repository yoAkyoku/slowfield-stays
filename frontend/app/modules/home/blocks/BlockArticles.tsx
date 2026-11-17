import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import ScrollRail from "../../content/ScrollRail";
import { getPages } from "../../api";
import { buildContentHref, contentIndexHref } from "../../contentRoutes";
import type { Locale } from "../../i18n";
import { cardTagsT, cfgT, trs , eyebrowT, tagsT} from "../../tr";
import { contentFilterTags, hasContentFilterTag } from "../../contentFilter";
import ViewAllFooter from "../ViewAllFooter";
import { ArticleCard } from "../../content/cards";

export type BlockArticlesConfig = {
  limit?: number;
  content_type?: string;
  variant?: "grid" | "feature" | "news";
  /** New multi-select filter; `filter_tag` remains supported for old blocks. */
  filter_tags?: string[];
  filter_tag?: string;
  eyebrow?: string | Record<string, string>;
  title?: string | Record<string, string>;
};

/** One row of cards: a plain grid, or a rail with arrows when the block asks. */
function RailOrGrid({
  rail, label, railProps, children,
}: {
  rail: boolean;
  label: string;
  railProps: Record<string, unknown>;
  children: React.ReactNode;
}) {
  if (!rail) return <div className="home-news-grid" {...railProps}>{children}</div>;
  return (
    <ScrollRail className="home-news-grid is-rail" ariaLabel={label}>
      {children}
    </ScrollRail>
  );
}

export default async function BlockArticles({ locale, config }: { locale: Locale; config?: BlockArticlesConfig }) {
  const zh = locale === "zh";
  const c = (config ?? {}) as Record<string, unknown>;
  const contentType = String(c.content_type ?? "journal");
  const limit = Math.max(1, Number(c.limit ?? 3));
  const variant = String(c.variant ?? "grid");
  // Optional category filter — multiple tags use OR semantics. The reader also
  // accepts legacy `filter_tag` blocks so existing content keeps working.
  const filterTags = contentFilterTags(c);
  const all = await getPages(contentType);
  const matching = filterTags.length
    ? all.filter((page) => hasContentFilterTag(page.tags, filterTags) || hasContentFilterTag(tagsT(page, locale), filterTags))
    : all;
  const articles = matching.slice(0, limit);
  if (!articles.length) return null;

  // Cleared means cleared — see the note in BlockStays; cfgT reads "" as
  // missing, so an explicit empty value has to be checked for separately.
  const eyebrow = eyebrowT(c, locale, (zh ? "旅遊專欄" : "Journal"));
  const title = cfgT(c, "title", locale, zh ? "出發前值得先知道的事" : "Worth Knowing Before You Go");
  const viewAll = zh ? "瀏覽全部" : "View all";

  // 最新消息 — OA-style three-up news cards: cover + category chip + title + a
  // "view more" cue. No fabricated dates (the CMS has no published date field);
  // the category chip comes from the first tag when present.
  // Same 橫向滑動 switch as the collection block; see the note there on why the
  // container is focusable.
  const rail = c.rail === true;
  const railProps = rail
    ? { tabIndex: 0, role: "region" as const, "aria-label": String(title || eyebrow || viewAll) }
    : {};

  if (variant === "news") {
    return (
      <section className="section home-news-section">
        <div className="home-news-head">
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h2>{title}</h2>
        </div>
        <RailOrGrid rail={rail} label={String(title || eyebrow || viewAll)} railProps={railProps}>
          {articles.map((article) => {
            const articleTitle = trs(article, "title", locale);
            const articleSummary = trs(article, "summary", locale);
            const category = cardTagsT(article, locale)[0];
            return (
              <Link href={buildContentHref(article)} className="home-news-card" key={article.id}>
                <div className="home-news-img">
                  {article.cover_image_url && <img src={article.cover_image_url} alt={articleTitle} loading="lazy" />}
                  {category && <span className="home-news-cat">{category}</span>}
                </div>
                <div className="home-news-body">
                  <h3>{articleTitle}</h3>
                  {articleSummary && <p>{articleSummary}</p>}
                  <span className="home-news-more">{zh ? "閱讀更多" : "Read more"} <ArrowUpRight size={15} /></span>
                </div>
              </Link>
            );
          })}
        </RailOrGrid>
        {/* Shared with BlockStays — this used to be its own near-identical
            copy under `home-news-foot`, which had no text-align of its own
            and only looked centred because `.home-news-section` (above) sets
            one. Using the same component keeps the two in sync. */}
        <ViewAllFooter href={contentIndexHref(contentType)} label={viewAll} icon={ArrowUpRight} />
      </section>
    );
  }

  return (
    <section className="section">
      <div className="section-header">
        <div>
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h2>{title}</h2>
        </div>
        <Link href={contentIndexHref(contentType)}>{viewAll}</Link>
      </div>

      {variant === "feature" && articles.length >= 2 ? (() => {
        const featTitle = trs(articles[0], "title", locale);
        const featSummary = trs(articles[0], "summary", locale);
        return (
          <div className="articles-feature-layout">
            <Link href={buildContentHref(articles[0])} className="article-feature-main">
              {articles[0].cover_image_url && (
                <div className="article-feature-img">
                  <img src={articles[0].cover_image_url} alt={featTitle} loading="lazy" />
                </div>
              )}
              <div className="article-feature-body">
                {cardTagsT(articles[0], locale).length > 0 && (
                  /* .article-tags belongs to the article page — it is centred,
                     680px wide and sits 44px below the copy it follows. Inside
                     a card that opened a gap above the title. The card row is
                     .tags--lead, the same one the 最新消息 cards use. */
                  <div className="tags tags--lead">
                    {cardTagsT(articles[0], locale).map((tag) => (
                      <span className="tag" key={tag}>{tag}</span>
                    ))}
                  </div>
                )}
                <h3>{featTitle}</h3>
                {featSummary && <p>{featSummary}</p>}
              </div>
            </Link>
            <div className="article-feature-stack">
              {articles.slice(1).map((article) => {
                const articleTitle = trs(article, "title", locale);
                const articleSummary = trs(article, "summary", locale);
                return (
                  <Link href={buildContentHref(article)} className="article-card-sm" key={article.id}>
                    {article.cover_image_url && (
                      <img src={article.cover_image_url} alt={articleTitle} loading="lazy" />
                    )}
                    <div>
                      <h3>{articleTitle}</h3>
                      {articleSummary && <p>{articleSummary}</p>}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })() : (
        <div className="articles-grid">
          {articles.map((article) => {
            const articleTitle = trs(article, "title", locale);
            const articleSummary = trs(article, "summary", locale);
            return (
              <ArticleCard
                key={article.id}
                href={buildContentHref(article)}
                title={articleTitle}
                summary={articleSummary}
                cover={article.cover_image_url}
                tags={cardTagsT(article, locale)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

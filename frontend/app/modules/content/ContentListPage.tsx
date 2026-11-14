import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { getCurrentSite, getPages } from "../api";
import { buildContentHref } from "../contentRoutes";
import { getLocale, publicUiText } from "../i18n";
import { cssUrl } from "../safeCss";
import { cardTagsT, trs } from "../tr";

export default async function ContentListPage({
  contentType,
  copyOverride
}: {
  contentType: string;
  copyOverride?: { empty?: string; intro?: string; title?: string };
}) {
  const locale = await getLocale();
  const ui = publicUiText(locale);
  const baseCopy = ui.content[contentType as keyof typeof ui.content] ?? ui.content.brand;
  const copy = { ...baseCopy, ...copyOverride };
  const [pages, site] = await Promise.all([getPages(contentType), getCurrentSite()]);
  const heroImage = (site.settings?.[`hero_${contentType}`] as string | undefined) || "";
  const layoutTone = ["media", "pr", "career"].includes(contentType)
    ? "registry"
    : ["activity", "journal"].includes(contentType)
      ? "editorial"
      : "visual";

  return (
    <main className={`content-index content-index-${contentType} content-index-${layoutTone}`}>
      <section
        className={`content-index-hero${heroImage ? " has-hero-image" : ""}`}
        style={cssUrl(heroImage) ? { backgroundImage: cssUrl(heroImage) } : undefined}
      >
        <div>
          <h1>{copy.title}</h1>
          <p>{copy.intro}</p>
        </div>
      </section>
      {pages.length ? (
        <section className="content-card-grid" aria-label={copy.title}>
          {pages.map((page, index) => {
            const cardTitle = trs(page, "title", locale);
            const cardSummary = trs(page, "summary", locale);
            return (
              <article className="content-card" key={page.id} style={{ "--content-index": index } as CSSProperties}>
                <Link aria-label={cardTitle} href={buildContentHref(page)}>
                  <div className="content-card-media">
                    {page.cover_image_url ? <img src={page.cover_image_url} alt={cardTitle} loading="lazy" /> : <span>{copy.title}</span>}
                  </div>
                  <div className="content-card-body">
                    <div className="content-card-meta">
                      <span>{cardTagsT(page, locale).join(" / ") || copy.title}</span>
                      <ArrowUpRight size={18} />
                    </div>
                    <h2>{cardTitle}</h2>
                    {cardSummary ? <p>{cardSummary}</p> : null}
                  </div>
                </Link>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="content-empty">
          <p>{copy.empty}</p>
        </section>
      )}
    </main>
  );
}

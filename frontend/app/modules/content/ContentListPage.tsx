import { getCurrentSite, getPages } from "../api";
import { buildContentHref } from "../contentRoutes";
import { getLocale, publicUiText } from "../i18n";
import { cssUrl } from "../safeCss";
import { cardTagsT, trs } from "../tr";
import { ContentCard } from "./cards";

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
          {pages.map((page, index) => (
            <ContentCard
              key={page.id}
              index={index}
              href={buildContentHref(page)}
              title={trs(page, "title", locale)}
              summary={trs(page, "summary", locale)}
              cover={page.cover_image_url}
              meta={cardTagsT(page, locale).join(" / ") || copy.title}
              placeholder={copy.title}
            />
          ))}
        </section>
      ) : (
        <section className="content-empty">
          <p>{copy.empty}</p>
        </section>
      )}
    </main>
  );
}

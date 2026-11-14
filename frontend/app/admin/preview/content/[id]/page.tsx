import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { getAdminPage } from "../../../modules/adminApi";
import { getCurrentSite } from "../../../../modules/api";
import { getLocale, publicUiText } from "../../../../modules/i18n";
import { trs } from "../../../../modules/tr";
import { fontVars, layoutVars, pageBackgroundStyle, themeVars, typeScaleVars } from "../../../../modules/fontPresets";
import ContentBlockRenderer from "../../../../modules/content/ContentBlockRenderer";

/**
 * Draft-aware live preview for a CMS content page. Rendered with the SAME
 * front-end components (hero + ContentBlockRenderer) and the site's fonts /
 * theme, so an editor sees the real front-end styling before publishing.
 *
 * Lives under /admin/ (so middleware requires an admin token — drafts stay
 * private) but OUTSIDE (dashboard) so it carries no admin chrome.
 */
export default async function AdminContentPreview(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const [page, site] = await Promise.all([getAdminPage(params.id), getCurrentSite()]);
  if (!page) notFound();

  const locale = await getLocale();
  const ui = publicUiText(locale);
  const contentCopy = ui.content[page.content_type as keyof typeof ui.content];
  const pageTitle = trs(page, "title", locale);
  const pageSummary = trs(page, "summary", locale);
  const pageBody = trs(page, "body", locale);
  const paragraphs = pageBody.split("\n").map((p) => p.trim()).filter(Boolean);
  const blocks = page.body_blocks?.length ? page.body_blocks : [];

  /* Was a hand-rolled subset: two theme colours copied by hand, no type scale,
     no layout vars, and `background: <raw pageBg>` — the only place in the app
     that skipped safeCssBackground, so a site-scoped editor could store
     `url(https://…)` and have it fetched when a super-admin opened the preview.
     It also made the preview lie: an editor approved a page whose type scale,
     gutters and section rhythm were not the published ones. Same four var sets
     as every other preview route and as the live layouts. */
  const settings = site.settings as Record<string, unknown> | undefined;
  const wrapStyle = {
    ...themeVars(site.theme_config),
    ...fontVars(settings),
    ...typeScaleVars(settings),
    ...layoutVars(settings),
    fontFamily: "var(--font-body)",
    ...pageBackgroundStyle(site.theme_config),
  } as CSSProperties;

  return (
    <div style={wrapStyle}>
      <main className="content-detail-page">
        <article className={`content-detail content-detail-${page.content_type}`}>
          <header className="content-detail-hero">
            <div>
              <div className="eyebrow">{contentCopy?.eyebrow ?? page.content_type}</div>
              <h1>{pageTitle}</h1>
              {pageSummary ? <p>{pageSummary}</p> : null}
              {page.tags?.length ? (
                <div className="tags" style={{ marginTop: 12 }}>
                  {page.tags.map((tag) => (
                    <span className="tag" key={tag}>{tag}</span>
                  ))}
                </div>
              ) : null}
            </div>
            {page.cover_image_url ? <img src={page.cover_image_url} alt={pageTitle} /> : null}
          </header>
          <div className="content-detail-body content-detail-body--full">
            {blocks.length ? (
              <ContentBlockRenderer blocks={blocks} locale={locale} />
            ) : (
              paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
            )}
          </div>
        </article>
      </main>
    </div>
  );
}

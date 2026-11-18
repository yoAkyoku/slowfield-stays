import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentSite, resolvePage } from "../../../modules/api";
import { contentIndexHref } from "../../../modules/contentRoutes";
import { getLocale, publicUiText } from "../../../modules/i18n";
import { tagsT, trs } from "../../../modules/tr";
import { EntryBody, EntryJsonLd, entryMetadata, redirectToCanonical } from "../../../modules/content/entryRoute";

const CATEGORY = "privacy";

export async function generateMetadata(props: { params: Promise<{ identifier: string }> }) {
  const params = await props.params;
  return entryMetadata(CATEGORY, params.identifier, { zh: "隱私政策", en: "Privacy policy" });
}

export default async function PrivacyDetailPage(props: { params: Promise<{ identifier: string }> }) {
  const params = await props.params;
  // The index lists privacy entries; it does not render their article bodies.
  // A published entry with slug "privacy" still needs its own detail route, so
  // the identifier is resolved as an article, never redirected by its name.
  const [page, site] = await Promise.all([
    resolvePage(CATEGORY, params.identifier),
    getCurrentSite(),
  ]);
  if (!page) notFound();
  const canonicalPath = redirectToCanonical(page, CATEGORY, params.identifier);
  const locale = await getLocale();
  const ui = publicUiText(locale);
  const contentCopy = ui.content[page.content_type as keyof typeof ui.content];
  const detailCopy = ui.contentDetail;
  const backHref = contentIndexHref(page.content_type);
  const ctaHref = contentCopy?.ctaHref ?? detailCopy.ctaHref;
  const ctaLabel = contentCopy?.ctaLabel ?? detailCopy.ctaLabel;
  const pageTitle = trs(page, "title", locale);
  const pageSummary = trs(page, "summary", locale);

  return (
    <main className="content-detail-page">
      <EntryJsonLd page={page} locale={locale} site={site} path={canonicalPath} />
      <article className={`content-detail content-detail-${page.content_type}`}>
        <header className="content-detail-hero">
          <div>
            <Link className="content-detail-back" href={backHref}>
              {detailCopy.backLabel}
            </Link>
            <div className="eyebrow">{contentCopy?.eyebrow ?? (locale === "zh" ? "隱私政策" : "Privacy")}</div>
            <h1>{pageTitle}</h1>
            {pageSummary ? <p>{pageSummary}</p> : null}
            {tagsT(page, locale).length ? (
              <div className="tags" style={{ marginTop: 12 }}>
                {tagsT(page, locale).map((tag) => (
                  <span className="tag" key={tag}>{tag}</span>
                ))}
              </div>
            ) : null}
          </div>
          {page.cover_image_url ? <img src={page.cover_image_url} alt={pageTitle} /> : null}
        </header>
        <div className="content-detail-body content-detail-body--full">
          <EntryBody page={page} locale={locale} />
        </div>
        <div className="content-detail-footer">
          <Link className="content-detail-cta" href={ctaHref}>{ctaLabel}</Link>
        </div>
      </article>
    </main>
  );
}

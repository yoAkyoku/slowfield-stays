import { contentTypeCatalogue } from "../../../modules/contentTypes";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentSite, resolvePage } from "../../../modules/api";
import { listingIndexHref } from "../../../modules/contentRoutes";
import { getLocale, publicUiText } from "../../../modules/i18n";
import { tagsT, trs } from "../../../modules/tr";
import { EntryBody, EntryJsonLd, entryMetadata, redirectToCanonical } from "../../../modules/content/entryRoute";

const CATEGORY = "page";

export async function generateMetadata(props: { params: Promise<{ identifier: string }> }) {
  const params = await props.params;
  return entryMetadata(CATEGORY, params.identifier, { zh: "一般頁面", en: "Page" });
}

export default async function PageDetailPage(props: { params: Promise<{ identifier: string }> }) {
  const params = await props.params;
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
  const backHref = listingIndexHref(site, page.content_type);
  const categoryLabel = contentTypeCatalogue(site, locale).get(page.content_type)?.label || contentCopy?.title || detailCopy.fallbackType;
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
            <div className="eyebrow">{categoryLabel}</div>
            <h1>{pageTitle}</h1>
            {pageSummary ? <p>{pageSummary}</p> : null}
          </div>
          {page.cover_image_url ? <img src={page.cover_image_url} alt={pageTitle} /> : null}
        </header>
        <div className="content-detail-layout">
          <aside className="content-detail-aside">
            <div>
              <span>{detailCopy.readingLabel}</span>
              <strong>{categoryLabel}</strong>
            </div>
            {pageSummary ? (
              <div>
                <span>{detailCopy.summaryLabel}</span>
                <p>{pageSummary}</p>
              </div>
            ) : null}
            {tagsT(page, locale).length ? (
              <div>
                <span>{detailCopy.tagsLabel}</span>
                <div className="tags">
                  {tagsT(page, locale).map((tag) => (
                    <span className="tag" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            <div>
              <span>{detailCopy.nextLabel}</span>
              <Link className="content-detail-cta" href={ctaHref}>
                {ctaLabel}
              </Link>
            </div>
          </aside>
          <div className="content-detail-body">
            <EntryBody page={page} locale={locale} />
          </div>
        </div>
      </article>
    </main>
  );
}

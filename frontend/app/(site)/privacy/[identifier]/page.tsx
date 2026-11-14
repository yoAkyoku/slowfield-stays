import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentSite, resolvePage } from "../../../modules/api";
import { contentIndexHref } from "../../../modules/contentRoutes";
import { getLocale, publicUiText } from "../../../modules/i18n";
import { tagsT, trs } from "../../../modules/tr";
import JsonLd from "../../../modules/JsonLd";
import ContentBlockRenderer from "../../../modules/content/ContentBlockRenderer";
import { buildMetadata, cmsEntrySeo, excerpt, seoTextForLocale, siteUrl } from "../../../modules/seo";

const CATEGORY = "privacy";

export async function generateMetadata(props: { params: Promise<{ identifier: string }> }) {
  const params = await props.params;
  const locale = await getLocale();
  const [site, page] = await Promise.all([getCurrentSite(), resolvePage(CATEGORY, params.identifier)]);
  if (!page) {
    return buildMetadata({ title: publicUiText(locale).notFound, noIndex: true, path: `/${CATEGORY}/${params.identifier}`, site });
  }
  const seo = cmsEntrySeo(page, locale);
  return buildMetadata({
    title: seo.title || seoTextForLocale(trs(page, "title", locale), locale) || (locale === "zh" ? "隱私政策" : "Privacy policy"),
    description: seo.description
      || seoTextForLocale(trs(page, "summary", locale), locale)
      || seoTextForLocale(excerpt(trs(page, "body", locale)), locale),
    image: seo.image || page.cover_image_url,
    canonical: seo.canonical,
        publishedTime: page.published_at ?? undefined,
    path: page.public_path || `/${CATEGORY}/${page.slug || page.id}`,
    site,
    type: "article"
  });
}

export default async function PrivacyDetailPage(props: { params: Promise<{ identifier: string }> }) {
  const params = await props.params;
  // The index lists privacy entries; it does not render their article bodies.
  // A published entry with slug "privacy" still needs its own detail route.
  const [page, site] = await Promise.all([
    resolvePage(CATEGORY, params.identifier),
    getCurrentSite(),
  ]);
  if (!page) notFound();
  const locale = await getLocale();
  const ui = publicUiText(locale);
  const contentCopy = ui.content[page.content_type as keyof typeof ui.content];
  const detailCopy = ui.contentDetail;
  const backHref = contentIndexHref(page.content_type);
  const ctaHref = contentCopy?.ctaHref ?? detailCopy.ctaHref;
  const ctaLabel = contentCopy?.ctaLabel ?? detailCopy.ctaLabel;
  const canonicalPath = page.public_path || `/${CATEGORY}/${page.slug || page.id}`;
  const requestedPath = `/${CATEGORY}/${params.identifier}`;
  const pageTitle = trs(page, "title", locale);
  const pageSummary = trs(page, "summary", locale);
  const pageBody = trs(page, "body", locale);
  const paragraphs = pageBody.split("\n").map((p) => p.trim()).filter(Boolean);
  const blocks = page.body_blocks?.length ? page.body_blocks : [];

  if (page.slug && requestedPath !== canonicalPath) {
    redirect(canonicalPath);
  }

  return (
    <main className="content-detail-page">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: seoTextForLocale(pageTitle, locale) || undefined,
          description: seoTextForLocale(pageSummary, locale) || undefined,
          image: page.cover_image_url ? siteUrl(page.cover_image_url, site) : undefined,
          url: siteUrl(canonicalPath, site)
        }}
      />
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
          {blocks.length ? (
            <ContentBlockRenderer blocks={blocks} locale={locale} />
          ) : (
            paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
          )}
        </div>
        <div className="content-detail-footer">
          <Link className="content-detail-cta" href={ctaHref}>{ctaLabel}</Link>
        </div>
      </article>
    </main>
  );
}

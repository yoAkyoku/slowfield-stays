import { contentTypeCatalogue } from "../../../modules/contentTypes";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentSite, getPages, resolvePage } from "../../../modules/api";
import { contentIndexHref, listingIndexHref } from "../../../modules/contentRoutes";
import { getLocale, publicUiText } from "../../../modules/i18n";
import { tagsT, trs } from "../../../modules/tr";
import JsonLd from "../../../modules/JsonLd";
import ArticleDetail from "../../../modules/content/ArticleDetail";
import { buildMetadata, cmsEntrySeo, excerpt, seoTextForLocale, siteUrl } from "../../../modules/seo";

export async function generateMetadata(props: { params: Promise<{ category: string; identifier: string }> }) {
  const params = await props.params;
  const locale = await getLocale();
  const [site, page] = await Promise.all([getCurrentSite(), resolvePage(params.category, params.identifier)]);
  if (!page) {
    return buildMetadata({ title: publicUiText(locale).notFound, noIndex: true, path: `/${params.category}/${params.identifier}`, site });
  }
  const seo = cmsEntrySeo(page, locale);
  return buildMetadata({
    title: seo.title || seoTextForLocale(trs(page, "title", locale), locale) || (locale === "zh" ? "文章" : "Article"),
    description: seo.description
      || seoTextForLocale(trs(page, "summary", locale), locale)
      || seoTextForLocale(excerpt(trs(page, "body", locale)), locale),
    image: seo.image || page.cover_image_url,
    canonical: seo.canonical,
        publishedTime: page.published_at ?? undefined,
    path: page.public_path || `/${params.category}/${page.slug || page.id}`,
    site,
    type: "article"
  });
}

export default async function CmsPublicPage(props: { params: Promise<{ category: string; identifier: string }> }) {
  const params = await props.params;
  // A CMS entry whose slug equals its own section (e.g. /experience/experience)
  // is the section landing content listed as a child of itself, producing a
  // duplicate of /experience with a self-referencing canonical. Collapse it onto
  // the section index so one URL owns the ranking, not two.
  if (params.identifier === params.category) {
    redirect(`/${params.category}`);
  }
  const [page, site] = await Promise.all([
    resolvePage(params.category, params.identifier),
    getCurrentSite(),
  ]);
  if (!page) notFound();
  const locale = await getLocale();
  const ui = publicUiText(locale);
  const contentCopy = ui.content[page.content_type as keyof typeof ui.content];
  const detailCopy = ui.contentDetail;
  const backHref = listingIndexHref(site, page.content_type);
  // Every entry in this category, for prev / next / related on the article.
  const siblings = await getPages(page.content_type);
  const canonicalPath = page.public_path || `/${params.category}/${page.slug || page.id}`;
  const requestedPath = `/${params.category}/${params.identifier}`;
  const pageTitle = trs(page, "title", locale);
  const pageSummary = trs(page, "summary", locale);

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
      <ArticleDetail
        page={page}
        locale={locale}
        category={contentTypeCatalogue(site, locale).get(page.content_type)?.label || contentCopy?.eyebrow || page.content_type}
        backHref={backHref}
        siblings={siblings}
        copy={{
          share: locale === "zh" ? "分享" : "Share",
          related: locale === "zh" ? "相關文章" : "Related",
          backToList: detailCopy.backLabel,
          prev: locale === "zh" ? "上一篇" : "Previous",
          next: locale === "zh" ? "下一篇" : "Next",
        }}
      />
    </main>
  );
}

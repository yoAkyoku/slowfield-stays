import { contentTypeCatalogue } from "../../../modules/contentTypes";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentSite, getPages, resolvePage } from "../../../modules/api";
import { listingIndexHref } from "../../../modules/contentRoutes";
import { getLocale, publicUiText } from "../../../modules/i18n";
import ArticleDetail from "../../../modules/content/ArticleDetail";
import { EntryJsonLd, entryMetadata, redirectToCanonical } from "../../../modules/content/entryRoute";

export async function generateMetadata(props: { params: Promise<{ category: string; identifier: string }> }) {
  const params = await props.params;
  return entryMetadata(params.category, params.identifier, { zh: "文章", en: "Article" });
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
  const canonicalPath = redirectToCanonical(page, params.category, params.identifier);
  const locale = await getLocale();
  const ui = publicUiText(locale);
  const contentCopy = ui.content[page.content_type as keyof typeof ui.content];
  const detailCopy = ui.contentDetail;
  const backHref = listingIndexHref(site, page.content_type);
  // Every entry in this category, for prev / next / related on the article.
  const siblings = await getPages(page.content_type);

  return (
    <main className="content-detail-page">
      <EntryJsonLd page={page} locale={locale} site={site} path={canonicalPath} />
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

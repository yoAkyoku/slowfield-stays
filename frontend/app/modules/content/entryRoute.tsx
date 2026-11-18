import { redirect } from "next/navigation";
import { getCurrentSite, resolvePage, type Page } from "../api";
import { getLocale, publicUiText, type Locale } from "../i18n";
import JsonLd from "../JsonLd";
import { buildMetadata, cmsEntrySeo, excerpt, seoTextForLocale, siteUrl } from "../seo";
import { trs } from "../tr";
import ContentBlockRenderer from "./ContentBlockRenderer";

/**
 * The parts every CMS detail route shares: /page/x, /privacy/x and
 * /{category}/x. The three routes each carried their own copy of the metadata
 * chain, the canonical redirect, the Article JSON-LD and the blocks-or-text
 * body, and differ only in the page they draw around them.
 */

/** Where an entry lives: its own public_path, else /{category}/{slug or id}. */
export function entryPath(page: Pick<Page, "public_path" | "slug" | "id">, category: string): string {
  return page.public_path || `/${category}/${page.slug || page.id}`;
}

/**
 * A resolved entry's metadata. The title falls back to the page's own title and
 * the description to the summary, then the body, so an entry with no SEO fields
 * still has a real snippet; `fallback` is the last resort for an untitled one.
 * The group routes reach it through entryMetadata; the villa route, which
 * resolves its entries its own way, calls it with the page it found.
 */
export function pageEntryMetadata(page: Page, locale: Locale, { path, site, fallback }: {
  path: string;
  site: Parameters<typeof buildMetadata>[0]["site"];
  fallback: Record<Locale, string>;
}) {
  const seo = cmsEntrySeo(page, locale);
  return buildMetadata({
    title: seo.title || seoTextForLocale(trs(page, "title", locale), locale) || fallback[locale],
    description: seo.description
      || seoTextForLocale(trs(page, "summary", locale), locale)
      || seoTextForLocale(excerpt(trs(page, "body", locale)), locale),
    image: seo.image || page.cover_image_url,
    canonical: seo.canonical,
    publishedTime: page.published_at ?? undefined,
    path,
    site,
    type: "article",
  });
}

/** The metadata of /{category}/{identifier} on the group site. */
export async function entryMetadata(category: string, identifier: string, fallback: Record<Locale, string>) {
  const locale = await getLocale();
  const [site, page] = await Promise.all([getCurrentSite(), resolvePage(category, identifier)]);
  if (!page) {
    return buildMetadata({ title: publicUiText(locale).notFound, noIndex: true, path: `/${category}/${identifier}`, site });
  }
  return pageEntryMetadata(page, locale, { path: entryPath(page, category), site, fallback });
}

/**
 * Send a slugged entry reached by any other URL (its id, an old category) to
 * the one it owns, and return that path. Only a resolved mismatch redirects:
 * an entry whose slug happens to equal its category is still an article.
 */
export function redirectToCanonical(page: Page, category: string, identifier: string): string {
  const canonicalPath = entryPath(page, category);
  const requestedPath = `/${category}/${identifier}`;
  if (page.slug && requestedPath !== canonicalPath) {
    redirect(canonicalPath);
  }
  return canonicalPath;
}

/** The entry's schema.org Article. */
export function EntryJsonLd({ page, locale, site, path }: {
  page: Page;
  locale: Locale;
  site: Parameters<typeof siteUrl>[1];
  path: string;
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Article",
        headline: seoTextForLocale(trs(page, "title", locale), locale) || undefined,
        description: seoTextForLocale(trs(page, "summary", locale), locale) || undefined,
        image: page.cover_image_url ? siteUrl(page.cover_image_url, site) : undefined,
        url: siteUrl(path, site),
      }}
    />
  );
}

/** The entry's body: its blocks when it has any, else its text as paragraphs. */
export function EntryBody({ page, locale }: { page: Page; locale: Locale }) {
  const blocks = page.body_blocks?.length ? page.body_blocks : [];
  if (blocks.length) return <ContentBlockRenderer blocks={blocks} locale={locale} />;
  const paragraphs = trs(page, "body", locale).split("\n").map((p) => p.trim()).filter(Boolean);
  return <>{paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</>;
}

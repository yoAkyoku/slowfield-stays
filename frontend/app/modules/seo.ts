import type { Metadata } from "next";
import type { PublicSite } from "./api";
import { getLocale, type Locale } from "./i18n";
import { isSafeUrl } from "./safeHtml";
import { bilingualOr } from "./tr";

/**
 * NEXT_PUBLIC_SITE_URL is not set on the server, so every canonical, og:url and
 * og:image on the live site pointed at http://localhost:3000 — Google was told
 * the real pages were copies of a machine it cannot reach, and a link shared to
 * LINE or Facebook fetched its thumbnail from localhost and got nothing. That is
 * the share-image field being useless in the one place it exists for.
 *
 * FRONTEND_URL is already passed to this container (compose sets it for the
 * backend's email links too), and metadata is built on the server, where a
 * non-NEXT_PUBLIC var is readable. Falling back to it fixes the live site
 * without anyone having to edit compose or .env on the server first.
 */
/* Trailing slashes are stripped because these values come from a .env file a
   person types: "https://www.example.com/" would build canonicals reading
   "https://www.example.com//dining", which a crawler treats as a different URL
   from the one every link on the site points at. */
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.FRONTEND_URL ||
  "http://localhost:3000"
).replace(/\/+$/, "");
const SITE_NAME = "Slowfield Stays";

function siteOrigin(site?: Pick<PublicSite, "domain">) {
  const domain = String(site?.domain ?? "").trim();
  if (domain) {
    try {
      const candidate = new URL(/^https?:\/\//i.test(domain) ? domain : `https://${domain}`);
      if ((candidate.protocol === "https:" || candidate.protocol === "http:") && !candidate.username && !candidate.password) {
        const host = candidate.hostname.toLowerCase();
        if (host === "localhost" || host.endsWith(".localhost") || host === "127.0.0.1" || host === "::1") return SITE_URL;
        // Sitemap and robots publish the site's configured host over HTTPS;
        // keep canonicals and social image URLs on that same origin.
        return `https://${candidate.host}`.replace(/\/+$/, "");
      }
    } catch {
      // An incomplete domain should not break page rendering; use the configured site URL.
    }
  }
  return SITE_URL;
}

function absoluteUrl(pathOrUrl?: string | null, site?: Pick<PublicSite, "domain">) {
  if (!pathOrUrl) return undefined;
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
  return `${siteOrigin(site)}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
}

/* The value lands in an og:image meta tag, and it arrives from a settings field
   an admin types into. isSafeUrl is the same http(s)-or-site-relative allow-list
   the block renderers use for hrefs; the server action validates on the way in,
   this catches whatever was stored before it existed. */
function safeImageUrl(image?: string | null, site?: Pick<PublicSite, "domain">) {
  const raw = String(image ?? "").trim();
  if (!raw || !isSafeUrl(raw)) return undefined;
  return absoluteUrl(raw, site);
}

/**
 * The share image used when a page has none of its own.
 *
 * Kept in settings rather than in code because it is a picture the client
 * changes with a season or a rebrand, and because each villa site needs its
 * own: a link to 禾境 shared to LINE should not preview the group's cover.
 */
function defaultOgImage(site?: PublicSite) {
  const settings = site?.settings as Record<string, unknown> | undefined;
  const configured = settings?.seo_og_image;
  return typeof configured === "string" ? configured : undefined;
}

/**
 * One SEO title or description, in the language being read, with no borrowing
 * across languages.
 *
 * The generic bilingual readers all borrow the other locale when a field is
 * empty, which is right for body copy — a half-translated block showing
 * something beats it showing nothing. It is wrong for a `<title>`: the English
 * half of an SEO field is the half editors leave blank, so cfgT / pickT handed
 * the Chinese one to Google, Facebook and LINE. The group homepage wrote its
 * own strict reader for exactly this (see `(site)/page.tsx`, "cfgT would then
 * borrow the Chinese half") and the villa routes and this module never followed;
 * this is that reader, in one place, so they cannot drift again.
 *
 * Two shapes reach here. A `{ zh, en }` map is already per-locale, so its half
 * is taken as typed — splitting it further would cut "宜蘭包棟 Villa" down to
 * "宜蘭包棟" on the Chinese page. A plain string is the legacy single field that
 * may carry both languages at once, which is what bilingualOr is for.
 */
export function seoTextForLocale(value: unknown, locale: Locale, fallback = ""): string {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    return String((value as Record<string, unknown>)[locale] ?? "").trim() || fallback;
  }
  if (typeof value === "string") {
    const text = value.trim();
    if (text.startsWith("{")) {
      try {
        const parsed = JSON.parse(text) as Record<string, unknown>;
        return String(parsed[locale] ?? "").trim() || fallback;
      } catch {
        // A legacy title can begin with a brace; treat invalid JSON as text.
      }
    }
    return bilingualOr(text, locale, fallback);
  }
  return fallback;
}

/**
 * One page's SEO overrides out of `settings.pages[key].seo`.
 *
 * The per-page SEO editor (admin → 網站 → 頁面 → 編輯) has always written here,
 * for the group site as well as the villas, but only the villa routes ever read
 * it: filling in a title for 品牌介紹 or 聯繫我們 on the group site changed
 * nothing. Values are bilingual { zh, en } maps.
 *
 * Read with seoTextForLocale rather than pickT: five parent routes consume this
 * helper, and pickT reaches for the other locale, so a page whose English SEO
 * title was left blank served its Chinese one as the English `<title>`.
 */
export function pageSettingsSeo(
  site: { settings?: Record<string, unknown> | null } | undefined,
  key: string,
  locale: Locale,
): { title: string; description: string; image?: string; canonical?: string; noIndex: boolean } {
  const pages = (site?.settings?.pages ?? {}) as Record<string, Record<string, unknown>>;
  const seo = (pages[key]?.seo ?? {}) as Record<string, unknown>;
  const image = seo.og_image;
  const canonical = seo.canonical;
  return {
    title: seoTextForLocale(seo.title, locale),
    description: seoTextForLocale(seo.description, locale),
    image: typeof image === "string" && image ? image : undefined,
    ...(typeof canonical === "string" && canonical.trim() ? { canonical: canonical.trim() } : {}),
    // Only an explicit true keeps a page out of the index. Anything else — a
    // missing key, a stray string — leaves it indexable, because silently
    // de-listing a page is the more damaging way to be wrong.
    noIndex: seo.noindex === true,
  };
}

/**
 * One CMS entry's SEO overrides, in the reader's language.
 *
 * The CMS editor stores meta title and description per locale, under
 * translations[locale].seo_title / seo_description, and copies only the primary
 * locale into the flat `seo` object. Every public route read the flat copy, so
 * an editor who filled in the English meta description watched the Chinese one
 * appear on the English page. The flat value stays as the fallback, since that
 * is where an entry saved before the bilingual editor existed still keeps it.
 */
export function cmsEntrySeo(
  page: { seo?: Record<string, string | null> | null; translations?: Record<string, Record<string, string>> | null },
  locale: Locale,
): { title: string; description: string; image: string; canonical: string } {
  const translated = page.translations?.[locale] ?? {};
  const flat = page.seo ?? {};
  return {
    title: seoTextForLocale(translated.seo_title, locale) || seoTextForLocale(flat.title, locale),
    description: seoTextForLocale(translated.seo_description, locale) || seoTextForLocale(flat.description, locale),
    image: flat.og_image || "",
    canonical: flat.canonical || "",
  };
}

/**
 * A meta description built from body copy, for an entry whose author filled in
 * neither an SEO description nor a summary. Without this the page inherited the
 * site-wide default and every such entry described itself identically, which is
 * the duplicate-description warning in Search Console.
 */
export function excerpt(text?: string | null, max = 160): string {
  const flat = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (flat.length <= max) return flat;
  // Cut on a word boundary when there is one near the limit; CJK copy has no
  // spaces, so a hard cut is the only option there.
  const clipped = flat.slice(0, max);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
}

/**
 * The site's name in the language being browsed.
 *
 * This belongs here rather than at the call sites. Every route already passes
 * `site`, but only the homepage bothered to swap in the bilingual name first —
 * so renaming the brand in the admin renamed the page body everywhere and the
 * `<title>` on exactly one page. Every other route, and therefore every search
 * result, kept the old name from the database column. Resolving it inside
 * buildMetadata means a route cannot forget.
 *
 * No borrowing across languages here, unlike most bilingual fields: a site with
 * only an English `name_translations` must keep showing its database name on
 * the Chinese pages rather than adopt the English one.
 */
export async function metadataSiteName(site?: PublicSite): Promise<string> {
  const translations = site?.settings?.name_translations as Record<string, string> | undefined;
  return translations?.[await getLocale()] || site?.name || SITE_NAME;
}

export async function buildMetadata({
  canonical,
  description,
  image,
  modifiedTime,
  noIndex,
  publishedTime,
  path,
  site,
  title,
  type = "website"
}: {
  canonical?: string | null;
  description?: string | null;
  image?: string | null;
  /** Pages that must never rank: a tokenised unsubscribe link, a 404 shell. */
  noIndex?: boolean;
  path?: string;
  site?: PublicSite;
  title: string;
  type?: "website" | "article";
  /** ISO timestamps for an article. Search engines and social cards use these
   *  to show "updated 3 days ago" and to rank fresh content; without them an
   *  entry published today looks the same age as one from two years back. */
  publishedTime?: string | null;
  modifiedTime?: string | null;
}): Promise<Metadata> {
  const locale = await getLocale();
  const siteName = await metadataSiteName(site);
  const defaultDescription = seoTextForLocale(site?.seo_defaults?.description, locale);
  const cleanTitle = String(title ?? "").trim();
  const baseTitle = cleanTitle || siteName;
  const resolvedTitle = baseTitle.includes(siteName) ? baseTitle : `${baseTitle} | ${siteName}`;
  const resolvedDescription = String(description ?? "").trim() || defaultDescription;
  const url = absoluteUrl(canonical, site) ?? absoluteUrl(path, site);
  const imageUrl = safeImageUrl(image, site) ?? safeImageUrl(defaultOgImage(site), site);

  return {
    title: resolvedTitle,
    description: resolvedDescription,
    alternates: url ? { canonical: url } : undefined,
    // max-image-preview:large is what lets a stay's photo appear at full size in
    // a Google result rather than as a thumbnail.
    robots: noIndex
      ? { index: false, follow: true }
      : { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
    openGraph: {
      title: resolvedTitle,
      description: resolvedDescription,
      siteName,
      type,
      url,
      // Facebook and LINE pick the preview language from this; without it a
      // Chinese page shared to LINE was treated as the platform default.
      locale: locale === "zh" ? "zh_TW" : "en_US",
      // The other language exists at the same URL behind a cookie, so it is
      // declared as an alternate rather than given a URL it does not have.
      alternateLocale: locale === "zh" ? "en_US" : "zh_TW",
      ...(type === "article" && (publishedTime || modifiedTime)
        ? {
            publishedTime: publishedTime ?? undefined,
            modifiedTime: modifiedTime ?? publishedTime ?? undefined,
          }
        : {}),
      images: imageUrl ? [{ url: imageUrl, width: 1200, height: 630 }] : undefined
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title: resolvedTitle,
      description: resolvedDescription,
      images: imageUrl ? [imageUrl] : undefined
    }
  };
}

export function siteUrl(path = "/", site?: Pick<PublicSite, "domain">) {
  return absoluteUrl(path, site) ?? siteOrigin(site);
}

export function siteOrganizationJsonLd(site: PublicSite) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.name,
    url: siteUrl("/", site),
    email: site.contact_config?.email || undefined
  };
}

export function siteWebsiteJsonLd(site: PublicSite) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.name,
    url: siteUrl("/", site),
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl("/stays", site)}?destination={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };
}

/**
 * A listing page's items, as structured data.
 *
 * `/stays` and the category indexes carried none: a search engine saw a page of
 * links and had to guess what they were. An ItemList names the order and the
 * destination of each entry, which is what earns a listing its rich result.
 */
export function itemListJsonLd(
  items: Array<{ name: string; url: string; image?: string | null }>,
  name: string,
  site?: Pick<PublicSite, "domain">,
): Record<string, unknown> | null {
  const clean = items
    .map((i) => ({ name: String(i.name ?? "").trim(), url: i.url, image: i.image || undefined }))
    .filter((i) => i.name && i.url);
  if (!clean.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: clean.length,
    itemListElement: clean.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: absoluteUrl(item.url, site),
      ...(item.image ? { image: absoluteUrl(item.image, site) } : {}),
    })),
  };
}

/**
 * A villa's own homepage as a LodgingBusiness.
 *
 * The parent's stay-detail route emits this, but a villa site's own front page —
 * the URL a villa actually promotes — emitted nothing at all, so the page most
 * likely to be searched for by name was the one with no structured data.
 */
export function lodgingJsonLd(opts: {
  name: string;
  url: string;
  description?: string | null;
  image?: string | null;
  address?: string | null;
  phone?: string | null;
  site?: Pick<PublicSite, "domain">;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: opts.name,
    url: absoluteUrl(opts.url, opts.site),
    description: opts.description || undefined,
    image: opts.image ? absoluteUrl(opts.image, opts.site) : undefined,
    address: opts.address ? { "@type": "PostalAddress", streetAddress: opts.address } : undefined,
    telephone: opts.phone || undefined,
  };
}


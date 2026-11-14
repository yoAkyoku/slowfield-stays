import type { MetadataRoute } from "next";
import { getCurrentSite, getPages, getPropertySites, getStays } from "./modules/api";
import { buildContentHref } from "./modules/contentRoutes";
import { isServableThroughSiteOverride } from "./modules/siteVisibility";
import { sitemapPageKeys, type PropertyPageConfig } from "./modules/property/types";

// Always generate at request time — backend not available during build
export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // This is a route handler, so the layout's ?site= visibility gate never runs:
  // GET /sitemap.xml?site={draft} would otherwise emit the draft's whole URL
  // set. Resolve the site first and return nothing when it is not servable.
  const site = await getCurrentSite();
  if (!isServableThroughSiteOverride(site)) return [];

  const [stays, pages, propertySites] = await Promise.all([
    getStays(),
    getPages(),
    getPropertySites()
  ]);

  const rawDomain = site.domain?.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const frontendUrl = process.env.FRONTEND_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  const baseUrl =
    rawDomain && rawDomain !== "localhost"
      ? `https://${rawDomain}`
      : (frontendUrl ?? "http://localhost:3000").replace(/\/+$/, "");

  const now = new Date();

  // Static routes — ordered by SEO importance
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl,                        lastModified: now, changeFrequency: "daily",   priority: 1.0 },
    { url: `${baseUrl}/stays`,             lastModified: now, changeFrequency: "daily",   priority: 0.9 },
    { url: `${baseUrl}/experience`,        lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/activities`,        lastModified: now, changeFrequency: "weekly",  priority: 0.8 },
    { url: `${baseUrl}/dining`,            lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${baseUrl}/journal`,           lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${baseUrl}/brand`,             lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/contact`,           lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/media-coverage`,    lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/pr`,                lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/careers`,           lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/news`,               lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${baseUrl}/services`,          lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/franchise`,         lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/privacy`,           lastModified: now, changeFrequency: "yearly",  priority: 0.2 }
  ];

  // Individual stay pages — high priority (conversion pages)
  const stayRoutes: MetadataRoute.Sitemap = stays.map((stay) => ({
    url: `${baseUrl}/stays/${stay.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.85
  }));

  // Group content pages by type for appropriate priority weighting
  const priorityByType: Record<string, number> = {
    activity: 0.7,
    news:     0.7,
    service:  0.6,
    dining:   0.65,
    journal:  0.65,
    brand:    0.55
  };

  const contentRoutes: MetadataRoute.Sitemap = pages.map((page) => ({
    url: `${baseUrl}${buildContentHref(page)}`,
    lastModified: now,
    changeFrequency: (page.content_type === "journal" ? "monthly" : "monthly") as MetadataRoute.Sitemap[number]["changeFrequency"],
    priority: priorityByType[page.content_type] ?? 0.5
  }));

  // Property (child) site pages. Each villa's sub-pages come from its own
  // settings.pages, the same source its nav and its routes read, so a page the
  // client added is listed and one they deleted is not.
  const propertyRoutes: MetadataRoute.Sitemap = propertySites
    // Belt-and-suspenders: /site/children already filters these out, but a
    // template (the leftover "測試子站" test tenant) or a non-active draft must
    // never reach the sitemap even if that ever changes.
    .filter((ps) => ps.status === "active" && !(ps as { is_template?: boolean }).is_template)
    .flatMap((ps) => {
    const base = `${baseUrl}/stays/${ps.slug}`;
    const pages = ((ps.settings?.pages ?? {}) as Record<string, PropertyPageConfig>);
    return [
      { url: base, lastModified: now, changeFrequency: "weekly" as const, priority: 0.8 },
      ...sitemapPageKeys(pages).map((key) => ({
        url: `${base}/${key}`,
        lastModified: now,
        changeFrequency: "monthly" as const,
        priority: 0.7,
      })),
    ];
  });

  // Drop section routes the site has hidden in the admin (nav_hidden) — a
  // coming-soon stub taken out of the nav should not sit in the sitemap
  // advertising itself to crawlers (客戶: 隱藏空殼頁, 慢域選品/curation kept because
  // it is not hidden). Curation is not in the static list anyway.
  const pagesConfig = (site.settings?.pages ?? {}) as Record<string, Record<string, unknown>>;
  // A page deleted in 頁面管理 (tombstoned) is gone, not just hidden.
  const isHidden = (key: string) => pagesConfig[key]?.nav_hidden === true || pagesConfig[key]?.deleted === true;
  const URL_SEG_TO_KEY: Record<string, string> = {
    pr: "pr", careers: "career", services: "service", franchise: "franchise", "media-coverage": "media",
  };
  const visibleStatic = staticRoutes.filter((r) => {
    const seg = r.url.slice(baseUrl.length).replace(/^\//, "");
    const key = URL_SEG_TO_KEY[seg];
    return !key || !isHidden(key);
  });
  const visibleContent = contentRoutes.filter((_, i) => !isHidden(String(pages[i]?.content_type ?? "")));

  /* One entry per URL. A villa that is BOTH a stay in the catalogue and a child
     site is produced twice — stayRoutes gives /stays/{slug} from the catalogue
     and propertyRoutes gives the same URL as the villa's own root — and
     hejing was listed twice in the live sitemap for exactly that reason.
     (八代町 escaped it only because its stay slug and its site slug differ,
     which is the same mismatch that sends its card to the detail page.)

     The LAST entry wins, so the more specific route survives: propertyRoutes is
     the villa's real home page and carries its own priority, while the
     catalogue's version is the generic 0.85. Order is otherwise preserved. */
  const all = [...visibleStatic, ...stayRoutes, ...visibleContent, ...propertyRoutes];
  return Array.from(new Map(all.map((entry) => [entry.url, entry])).values());
}

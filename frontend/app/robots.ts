import type { MetadataRoute } from "next";
import { getCurrentSite } from "./modules/api";
import { isServableThroughSiteOverride } from "./modules/siteVisibility";

// Always generate at request time — backend not available during build
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await getCurrentSite();
  // Like the sitemap, this route handler runs outside the layout's ?site= gate,
  // so robots.txt?site={draft} leaked the draft's host. Disallow everything when
  // the resolved site is not publicly servable.
  if (!isServableThroughSiteOverride(site)) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  const rawDomain = site.domain?.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  /* FRONTEND_URL first, the same chain sitemap.ts and seo.ts use.
     This route read only NEXT_PUBLIC_SITE_URL, which is set nowhere — not in
     the compose file, not in .env.production.example — so a site whose `domain`
     column is empty or "localhost" published
     `Sitemap: http://localhost:3000/sitemap.xml` to every crawler that asked.
     FRONTEND_URL is the one the deployment actually sets. */
  const configuredUrl = process.env.FRONTEND_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const siteUrl = rawDomain && rawDomain !== "localhost"
    ? `https://${rawDomain}`
    : configuredUrl.replace(/\/+$/, "");
  return {
    // /admin is behind the auth middleware, so nothing leaks — but crawling it
    // produces a trail of redirect chains to the login page in Search Console,
    // and the admin has no business in an index either way. The API is the same
    // argument: JSON endpoints are not pages.
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] }],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl
  };
}

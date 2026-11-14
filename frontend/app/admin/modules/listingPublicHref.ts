import type { AdminSite } from "./adminApi";

export function listingPublicHref(site: Pick<AdminSite, "parent_site_id" | "slug">, pageKey: string): string {
  const path = `/${encodeURIComponent(pageKey)}`;
  return site.parent_site_id != null ? `/stays/${encodeURIComponent(site.slug)}${path}` : path;
}

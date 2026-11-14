/**
 * Whether a resolved site may be served as a public villa page.
 *
 * Its own module, with no Next imports, because `api.ts` reaches for
 * `next/headers` at load time and nothing outside a request can import it.
 *
 * Two rules, and the second one was missing: `status` rode along in the resolve
 * payload and nothing read it, so a site created from a template was reachable
 * the moment it existed, serving the template villa's words and photos under
 * the new villa's name. Draft is the state a site is built in, and it has to
 * mean that on the public side too.
 *
 * A payload with no status at all still passes: older rows and the dev mock
 * carry none, and refusing those would take a live site down, which is a worse
 * failure than showing a draft.
 */
export function isPubliclyVisibleVilla(
  site: { parent_site_id?: number | null; status?: string } | null | undefined,
): boolean {
  if (!site) return false;
  // A site with no parent is the group site, which has its own routes.
  if (!site.parent_site_id) return false;
  return !site.status || site.status === "active";
}

/**
 * Whether a child site reached through the `?site=` override may be rendered on
 * the parent's routes.
 *
 * `/stays/{slug}` refused a draft villa; `/?site={slug}` served the same draft
 * on the parent's chrome, because the override predates the visibility rule and
 * nothing rechecked it. One door locked, the one beside it open.
 *
 * The parent site itself is never refused here. Its own status is not part of
 * this question — the override is the thing being gated — and refusing it would
 * mean one wrong click in the admin takes the whole public site down. Admin
 * preview routes are unaffected: they sit behind the admin token and exist
 * precisely to look at unpublished work.
 */
export function isServableThroughSiteOverride(
  site: { parent_site_id?: number | null; status?: string } | null | undefined,
): boolean {
  if (!site) return false;
  if (!site.parent_site_id) return true;
  return isPubliclyVisibleVilla(site);
}

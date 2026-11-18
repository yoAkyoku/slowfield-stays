import { getAdminSite, type AdminSite } from "./adminApi";
import { DEFAULT_ACCENT_COLOR, DEFAULT_PRIMARY_COLOR } from "../../modules/fontPresets";

/**
 * `PUT /sites/{id}` replaces the whole site. Anything the payload does not
 * name is cleared — theme_config in particular is replaced wholesale.
 *
 * Three saves only mean to change `settings` (the homepage blocks, a villa
 * page, the page list), and each built its own full payload from the stored
 * site. They had to be kept in step by hand: a theme field added to one and
 * not the others wiped that field whenever the other save ran — page_bg went
 * that way once, reset by a page reorder. One builder now.
 */
export function siteReplacePayload(site: AdminSite, settings: Record<string, unknown>) {
  const theme = (site.theme_config ?? {}) as Record<string, string | undefined>;
  const contact = (site.contact_config ?? {}) as Record<string, string | undefined>;
  const seo = (site.seo_defaults ?? {}) as Record<string, string | undefined>;
  return {
    name: site.name ?? "",
    slug: site.slug ?? "",
    domain: site.domain ?? "",
    status: site.status ?? "active",
    default_locale: site.default_locale ?? "zh",
    primary_color: theme.primaryColor ?? DEFAULT_PRIMARY_COLOR,
    accent_color: theme.accentColor ?? DEFAULT_ACCENT_COLOR,
    nav_bg: theme.navBg ?? "",
    nav_text: theme.navText ?? "",
    footer_bg: theme.footerBg ?? "",
    footer_text: theme.footerText ?? "",
    button_bg: theme.buttonBg ?? "",
    button_text: theme.buttonText ?? "",
    nav_button_bg: theme.navButtonBg ?? "",
    nav_button_text: theme.navButtonText ?? "",
    footer_button_bg: theme.footerButtonBg ?? "",
    footer_button_text: theme.footerButtonText ?? "",
    page_bg: theme.pageBg ?? "",
    contact_email: contact.email ?? "",
    contact_line: contact.line ?? "",
    seo_title: seo.title ?? "",
    seo_description: seo.description ?? "",
    parent_site_id: site.parent_site_id ?? null,
    template_site_id: site.template_site_id ?? null,
    is_template: site.is_template ?? false,
    template_version: site.template_version ?? "v1",
    settings,
  };
}

/**
 * The site a save is about, from the API rather than from the copy the browser
 * posted back. The forms carry the whole site in a hidden field, and trusting
 * it meant one admin's save reverted another's edits to a different page (the
 * snapshot was stale) and every field was whatever the browser sent. The
 * posted copy is used only if the refetch fails, so a transient API error
 * degrades to the old behaviour rather than wiping settings.
 */
export async function loadSite(siteId: string, posted: FormDataEntryValue | null): Promise<AdminSite> {
  const fresh = await getAdminSite(siteId);
  if (fresh) return fresh;
  return JSON.parse(String(posted ?? "{}")) as AdminSite;
}

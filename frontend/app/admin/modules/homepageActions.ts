"use server";

import { adminJsonRequest } from "./adminRequest";
import { actionRedirect, stampedRedirect } from "./adminUtils";
import { getAdminSite } from "./adminApi";
import type { AdminSite } from "./adminApi";
import { DEFAULT_ACCENT_COLOR, DEFAULT_PRIMARY_COLOR } from "../../modules/fontPresets";

export async function updateHomepageAction(formData: FormData) {
  const siteId = String(formData.get("_site_id") ?? "");
  if (!siteId) stampedRedirect("/admin/homepage?error=Missing+site+ID");

  const site = await loadSite(siteId, formData.get("_site_json"));

  let blocks: unknown[] = [];
  try {
    const raw = String(formData.get("_blocks_json") ?? "[]");
    blocks = JSON.parse(raw) as unknown[];
  } catch {
    stampedRedirect("/admin/homepage?error=Invalid+blocks+data");
  }

  let seo: Record<string, unknown> = {};
  try {
    seo = JSON.parse(String(formData.get("_seo_json") ?? "{}")) as Record<string, unknown>;
  } catch {
    /* ignore parse error — keep empty */
  }

  let nameTranslations: Record<string, string> = {};
  try {
    nameTranslations = JSON.parse(String(formData.get("_name_translations_json") ?? "{}")) as Record<string, string>;
  } catch {
    /* ignore */
  }

  const existingSettings = (site.settings ?? {}) as Record<string, unknown>;
  const existingHomepage = (existingSettings.homepage ?? {}) as Record<string, unknown>;

  const theme = (site.theme_config ?? {}) as Record<string, string>;
  const contact = (site.contact_config ?? {}) as Record<string, string>;
  const seoDefaults = (site.seo_defaults ?? {}) as Record<string, string>;
  const payload = {
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
    /* Carried through: this payload is a full replace, so a field it does
       not name is cleared — saving something unrelated would wipe these. */
    nav_button_bg: theme.navButtonBg ?? "",
    nav_button_text: theme.navButtonText ?? "",
    footer_button_bg: theme.footerButtonBg ?? "",
    footer_button_text: theme.footerButtonText ?? "",
    page_bg: theme.pageBg ?? "",
    contact_email: contact.email ?? "",
    contact_line: contact.line ?? "",
    seo_title: seoDefaults.title ?? "",
    seo_description: seoDefaults.description ?? "",
    parent_site_id: site.parent_site_id ?? null,
    template_site_id: site.template_site_id ?? null,
    is_template: site.is_template ?? false,
    template_version: site.template_version ?? "v1",
    settings: {
      ...existingSettings,
      name_translations: nameTranslations,
      homepage: {
        ...existingHomepage,
        blocks,
        seo,
      },
    },
  };

  const result = await adminJsonRequest(`/sites/${siteId}`, payload, "PUT", "Homepage update failed");
  actionRedirect(result, "/admin/homepage");
}

/**
 * Load the site the save is about, from the API rather than from the copy the
 * browser posted back.
 *
 * These forms carry the whole site object in a hidden field and the payload
 * below is a full replace, so trusting it had two consequences: an admin
 * editing one page silently reverted another admin's edits to a *different*
 * page, because their snapshot of settings was already stale by the time they
 * saved; and every field in the payload — slug, domain, status, theme — was
 * whatever the browser chose to send. The posted copy is used only if the
 * refetch fails, so a transient API error degrades to the old behaviour rather
 * than wiping settings.
 */
async function loadSite(siteId: string, posted: FormDataEntryValue | null): Promise<AdminSite> {
  const fresh = await getAdminSite(siteId);
  if (fresh) return fresh;
  return JSON.parse(String(posted ?? "{}")) as AdminSite;
}

"use server";

import { adminJsonRequest } from "./adminRequest";
import { actionRedirect, stampedRedirect } from "./adminUtils";
import { loadSite, siteReplacePayload } from "./sitePayload";

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

  const payload = siteReplacePayload(site, {
    ...existingSettings,
    name_translations: nameTranslations,
    homepage: {
      ...existingHomepage,
      blocks,
      seo,
    },
  });

  const result = await adminJsonRequest(`/sites/${siteId}`, payload, "PUT", "Homepage update failed");
  actionRedirect(result, "/admin/homepage");
}


"use server";

import { adminJsonRequest } from "./adminRequest";
import { actionRedirect, stampedRedirect } from "./adminUtils";
import { getAdminSite } from "./adminApi";
import type { AdminSite } from "./adminApi";
import { DEFAULT_ACCENT_COLOR, DEFAULT_PRIMARY_COLOR } from "../../modules/fontPresets";

/**
 * Save a single property page's blocks + SEO into site.settings.pages.{pageKey}
 */
export async function updatePropertyPageAction(formData: FormData) {
  const siteId = String(formData.get("_site_id") ?? "");
  const pageKey = String(formData.get("_page_key") ?? "");
  if (!siteId || !pageKey) stampedRedirect(`/admin/sites/${siteId}?error=Missing+params`);

  const site = await loadSite(siteId, formData.get("_site_json"));

  let blocks: unknown[] = [];
  try {
    blocks = JSON.parse(String(formData.get("_blocks_json") ?? "[]")) as unknown[];
  } catch {
    stampedRedirect(`/admin/sites/${siteId}/pages/${pageKey}?error=Invalid+blocks`);
  }

  let seo: Record<string, unknown> = {};
  try {
    seo = JSON.parse(String(formData.get("_seo_json") ?? "{}")) as Record<string, unknown>;
  } catch { /* keep empty */ }

  const showCmsList = String(formData.get("_show_cms_list") ?? "0") === "1";
  /* Absent means an older form that never carried the field — keep the search
     box rather than silently hiding it on the next save. */
  /* Absent means off, matching all three readers. This defaulted to "1" —
     the residue of the bug where the switch showed ON while the box was
     hidden. Unreachable today (the editor always posts the field) but it
     pointed the wrong way. */
  const showSearch = String(formData.get("_show_search") ?? "0") === "1";
  /* Absent defaults to "1", the opposite of show_search above, because the
     readers default the chip row ON. An older form that never carried the
     field must not hide a row the page is showing today. */
  const showTags = String(formData.get("_show_tag_row") ?? "1") === "1";
  /* Absent means off, unlike the chip row above: a form that never carried
     this field must not narrow a grid the page renders full-width today. */
  const cardsMatchText = String(formData.get("_cards_match_text") ?? "0") === "1";
  /* The hero mask. Stored as 0-100 because that is what the panel shows; the
     renderer divides. Empty stays empty rather than becoming 0, so "never
     configured" and "explicitly none" remain distinguishable to the reader. */
  const heroMaskColor = String(formData.get("_hero_mask_color") ?? "");
  const rawMaskOpacity = String(formData.get("_hero_mask_opacity") ?? "");
  const heroMaskOpacity = rawMaskOpacity === "" ? "" : Math.min(100, Math.max(0, Number(rawMaskOpacity) || 0));

  let label: Record<string, string> | undefined;
  try {
    const raw = formData.get("_label_json");
    if (raw) label = JSON.parse(String(raw)) as Record<string, string>;
  } catch { /* keep undefined */ }

  // Nav link mode: "page" (route to the sub-page) or "anchor" (scroll to a
  // homepage block via #tag).
  const navLinkMode = formData.get("_nav_link_mode") === "anchor" ? "anchor" : "page";
  /* Rows with no tag are dropped rather than saved empty: a sub-tab that
     matches nothing would render as a dead button. */
  let subTabs: unknown[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("_sub_tabs_json") ?? "[]")) as unknown;
    if (Array.isArray(parsed)) {
      subTabs = parsed.filter((r) => {
        const t = (r ?? {}) as Record<string, unknown>;
        const g = t.tag;
        if (typeof g === "string") return g.trim().length > 0;
        return Boolean(g) && Object.values(g as Record<string, unknown>).some((v) => String(v ?? "").trim());
      });
    }
  } catch {
    subTabs = [];
  }
  const navAnchor = formData.get("_nav_anchor") ? String(formData.get("_nav_anchor")).trim() : "";

  const heroImage = formData.get("_hero_image") ? String(formData.get("_hero_image")) : undefined;

  let heroTitle: Record<string, string> | undefined;
  try {
    const raw = formData.get("_hero_title_json");
    if (raw) heroTitle = JSON.parse(String(raw)) as Record<string, string>;
  } catch { /* keep undefined */ }

  let heroSubtitle: Record<string, string> | undefined;
  try {
    const raw = formData.get("_hero_subtitle_json");
    if (raw) heroSubtitle = JSON.parse(String(raw)) as Record<string, string>;
  } catch { /* keep undefined */ }

  const heroTitleColor = formData.get("_hero_title_color") ? String(formData.get("_hero_title_color")) : undefined;
  const heroSubtitleColor = formData.get("_hero_subtitle_color") ? String(formData.get("_hero_subtitle_color")) : undefined;
  /* Allow-listed like the colours and the alignment: this one is
     interpolated into a class name on the villa hero
     (property-hero-banner--h-<value>), so an unchecked string lets a
     hand-crafted POST attach arbitrary classes to the element. */
  const rawHeroHeight = String(formData.get("_hero_height") ?? "");
  const heroHeight = ["small", "medium", "large", "full"].includes(rawHeroHeight)
    ? rawHeroHeight
    : undefined;
  // Allow-listed: this value is interpolated into a style attribute.
  const rawHeroAlign = String(formData.get("_hero_align") ?? "");
  const heroAlign = ["left", "center", "right"].includes(rawHeroAlign) ? rawHeroAlign : undefined;
  /* Allow-listed for the same reason as the height beside it: PageHero narrows
     this to a class name. "" is the overlay default and stays expressible, so
     switching back is a real choice rather than an absent key. */
  const rawHeroLayout = String(formData.get("_hero_layout") ?? "");
  const heroLayout = rawHeroLayout === "split" ? "split" : "";

  const existingSettings = (site.settings ?? {}) as Record<string, unknown>;

  // For homepage, store under settings.homepage
  if (pageKey === "homepage") {
    const existingHomepage = (existingSettings.homepage ?? {}) as Record<string, unknown>;
    const payload = buildSitePayload(site, {
      ...existingSettings,
      homepage: { ...existingHomepage, blocks, seo, show_cms_list: showCmsList },
    });
    const result = await adminJsonRequest(`/sites/${siteId}`, payload, "PUT", "Homepage update failed");
    actionRedirect(result, `/admin/sites/${siteId}/pages/${pageKey}`);
    return; // actionRedirect throws, but explicit return for safety
  }

  // For sub-pages, store under settings.pages.{pageKey}
  const existingPages = (existingSettings.pages ?? {}) as Record<string, unknown>;
  const existingPage = (existingPages[pageKey] ?? {}) as Record<string, unknown>;

  const payload = buildSitePayload(site, {
    ...existingSettings,
    pages: {
      ...existingPages,
      [pageKey]: {
        ...existingPage,
        blocks, seo, show_cms_list: showCmsList,
        show_search: showSearch,
        show_tag_row: showTags,
        cards_match_text: cardsMatchText,
        hero_mask_color: heroMaskColor,
        hero_mask_opacity: heroMaskOpacity,
        /* `{}` is truthy, so an empty label object used to overwrite the
           stored name with nothing. Only persist a label that actually
           carries a value. */
        ...(label && Object.values(label).some((v) => String(v ?? "").trim())
          ? { label }
          : {}),
        link_mode: navLinkMode,
        sub_tabs: subTabs,
        /* Written unconditionally: spread over ...existingPage, an omitted key
       leaves the previous anchor in place, so clearing the field in the editor
       kept the nav pointing at the old #tag. */
      anchor: navLinkMode === "anchor" ? navAnchor : "",
        /* All written unconditionally, for the same reason as `anchor` above:
           this object is spread over ...existingPage, so a key the save omits
           keeps whatever was stored before. Every one of these was omitted when
           empty, which meant a hero image, title, subtitle, colour, height or
           alignment could be set but never removed — clearing the field and
           saving put the old value straight back.
           The readers all treat "" and {} as unset, so an emptied field falls
           back to the page's own default exactly as it did before it was set. */
        hero_image: heroImage ?? "",
        hero_title: heroTitle ?? {},
        hero_subtitle: heroSubtitle ?? {},
        hero_title_color: heroTitleColor ?? "",
        hero_subtitle_color: heroSubtitleColor ?? "",
        hero_height: heroHeight ?? "",
        hero_layout: heroLayout,
        hero_align: heroAlign ?? "",
      },
    },
  });

  const result = await adminJsonRequest(`/sites/${siteId}`, payload, "PUT", "Page update failed");
  actionRedirect(result, `/admin/sites/${siteId}/pages/${pageKey}`);
}

/**
 * Add a new custom page to site.settings.pages
 */
export async function addPropertyPageAction(formData: FormData) {
  const siteId = String(formData.get("_site_id") ?? "");
  if (!siteId) return { ok: false, message: "Missing site ID" };

  const site = await loadSite(siteId, formData.get("_site_json"));

  const pageSlug = String(formData.get("page_slug") ?? "").trim().toLowerCase();
  const labelZh = String(formData.get("label_zh") ?? "").trim();
  const labelEn = String(formData.get("label_en") ?? "").trim();

  // Validation
  if (!pageSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pageSlug)) {
    return { ok: false, message: "Invalid slug format (lowercase letters, numbers, hyphens only)" };
  }
  if (!labelZh || !labelEn) {
    return { ok: false, message: "Both labels are required" };
  }

  const existingSettings = (site.settings ?? {}) as Record<string, unknown>;
  const existingPages = (existingSettings.pages ?? {}) as Record<string, unknown>;

  // Check for duplicate — but allow re-adding over a tombstoned (previously deleted) entry
  const existing = existingPages[pageSlug] as Record<string, unknown> | undefined;
  const reservedRootPaths = new Set(["admin", "api", "storage", "stays", "contact", "privacy", "page", "newsletter", "property", "home", "about", "about-us", "blog", "rooms", "villas", "media", "press", "jobs", "faq", "service"]);
  if (pageSlug === "homepage" || (!site.parent_site_id && !existing && reservedRootPaths.has(pageSlug))) {
    return { ok: false, message: "This URL is reserved for a system page" };
  }
  if (existing && existing.deleted !== true) {
    return { ok: false, message: `Page "${pageSlug}" already exists` };
  }

  // Determine sort_order (max + 1)
  const maxOrder = Object.values(existingPages).reduce<number>((max, pg) => {
    const order = (pg as Record<string, unknown>)?.sort_order;
    return typeof order === "number" ? Math.max(max, order) : max;
  }, 10);

  // When resurrecting a tombstone, preserve prior content (blocks, hero, etc.) but clear deleted flag and restore visibility
  const newPage: Record<string, unknown> = {
    ...(existing ?? {}),
    label: { en: labelEn, zh: labelZh },
    sort_order: maxOrder + 1,
    blocks: existing?.blocks ?? [],
    seo: existing?.seo ?? {},
    deleted: false,
    visible: true,
    page_type: existing?.page_type ?? "blocks",
    show_cms_list: existing?.show_cms_list ?? false,
    article_categories: existing?.article_categories ?? [],
  };

  const payload = buildSitePayload(site, {
    ...existingSettings,
    pages: {
      ...existingPages,
      [pageSlug]: newPage,
    },
  });

  const result = await adminJsonRequest(`/sites/${siteId}`, payload, "PUT", "Add page failed");
  return result;
}

/**
 * Delete a custom page from site.settings.pages (also removes from nav)
 */
export async function deletePropertyPageAction(formData: FormData) {
  const siteId = String(formData.get("_site_id") ?? "");
  if (!siteId) stampedRedirect(`/admin/sites?error=Missing+site+ID`);

  const site = await loadSite(siteId, formData.get("_site_json"));

  const pageKey = String(formData.get("_page_key") ?? "").trim();
  if (!pageKey) {
    stampedRedirect(`/admin/sites/${siteId}?error=Missing+page+key`);
  }

  const existingSettings = (site.settings ?? {}) as Record<string, unknown>;
  const existingPages = { ...((existingSettings.pages ?? {}) as Record<string, unknown>) };

  // Remove page
  delete existingPages[pageKey];

  // Also remove from nav if present
  let nav = existingSettings.nav as unknown[] | undefined;
  if (Array.isArray(nav)) {
    nav = nav.filter((item) => (item as Record<string, unknown>)?.key !== pageKey);
  }

  const payload = buildSitePayload(site, {
    ...existingSettings,
    pages: existingPages,
    ...(nav ? { nav } : {}),
  });

  const result = await adminJsonRequest(`/sites/${siteId}`, payload, "PUT", "Delete page failed");
  actionRedirect(result, `/admin/sites/${siteId}`);
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

function buildSitePayload(site: AdminSite, settings: Record<string, unknown>) {
  return {
    name: site.name ?? "",
    slug: site.slug ?? "",
    domain: site.domain ?? "",
    status: site.status ?? "active",
    default_locale: site.default_locale ?? "zh",
    primary_color: site.theme_config?.primaryColor ?? DEFAULT_PRIMARY_COLOR,
    accent_color: site.theme_config?.accentColor ?? DEFAULT_ACCENT_COLOR,
    nav_bg: site.theme_config?.navBg ?? "",
    nav_text: site.theme_config?.navText ?? "",
    footer_bg: site.theme_config?.footerBg ?? "",
    footer_text: site.theme_config?.footerText ?? "",
    button_bg: site.theme_config?.buttonBg ?? "",

    button_text: site.theme_config?.buttonText ?? "",

    /* Carried through: this payload is a full replace, so a field it does
       not name is cleared — saving something unrelated would wipe these. */
    nav_button_bg: site.theme_config?.navButtonBg ?? "",
    nav_button_text: site.theme_config?.navButtonText ?? "",
    footer_button_bg: site.theme_config?.footerButtonBg ?? "",
    footer_button_text: site.theme_config?.footerButtonText ?? "",
    // The PUT replaces theme_config wholesale; omitting page_bg here reset the
    // site background to default on every property-page save (this builder backs
    // five actions incl. drag-reorder and visibility toggle).
    page_bg: site.theme_config?.pageBg ?? "",
    contact_email: site.contact_config?.email ?? "",
    contact_line: site.contact_config?.line ?? "",
    seo_title: site.seo_defaults?.title ?? "",
    seo_description: site.seo_defaults?.description ?? "",
    parent_site_id: site.parent_site_id ?? null,
    template_site_id: site.template_site_id ?? null,
    is_template: site.is_template ?? false,
    template_version: site.template_version ?? "v1",
    settings,
  };
}

"use server";

import { cookies } from "next/headers";
import type { AdminSite } from "./adminApi";
import { siteReplacePayload } from "./sitePayload";
import { adminJsonDataRequest, adminJsonRequest } from "./adminRequest";
import { actionRedirect, stampedRedirect } from "./adminUtils";
import { INQUIRY_SOURCES } from "./blockForms";
import { TYPE_FACES, cjkFaceKey, latinFaceKey, DEFAULT_ACCENT_COLOR, DEFAULT_PRIMARY_COLOR } from "../../modules/fontPresets";
import { isSafeUrl } from "../../modules/safeHtml";

const TYPE_FACE_KEYS = new Set(TYPE_FACES.map((f) => f.key));

/**
 * One of the four site font slots, normalised to a catalogue key.
 *
 * `match` survives untouched — it is not a face but an instruction (draw Latin
 * in the Chinese face), and fontVars reads it before it ever looks a key up.
 * Anything the catalogue and the legacy aliases both refuse falls back rather
 * than being written through, so what the settings hold is always a word the
 * render side can spend.
 */
function parseFaceKey(
  raw: FormDataEntryValue | null,
  resolve: (v: unknown) => string,
  fallback: string,
): string {
  const value = String(raw ?? "").trim();
  if (value === "match") return "match";
  return resolve(value) || fallback;
}

function sitePayload(formData: FormData) {
  // Preserve existing settings (pages, homepage, nav, etc.) — only overwrite keys this form manages
  let existingSettings: Record<string, unknown> = {};
  try {
    const raw = formData.get("_existing_settings_json");
    if (raw) existingSettings = JSON.parse(String(raw)) as Record<string, unknown>;
  } catch { /* keep empty */ }

  // Bilingual site name
  let nameTranslations: Record<string, string> = {};
  try {
    const raw = formData.get("_name_translations_json");
    if (raw) nameTranslations = JSON.parse(String(raw)) as Record<string, string>;
  } catch { /* keep empty */ }

  // Bilingual footer legal notice (zh + en). Always send a structured value
  // so clearing both textareas actually removes the notice — undefined keys
  // disappear during JSON.stringify and the backend never gets a "clear"
  // signal otherwise.
  const noticeZh = String(formData.get("footer_notice_zh") ?? "").trim();
  const noticeEn = String(formData.get("footer_notice_en") ?? "").trim();
  const footerNotice = { zh: noticeZh, en: noticeEn };
  const footerDescription = {
    zh: String(formData.get("footer_description_zh") ?? "").trim(),
    en: String(formData.get("footer_description_en") ?? "").trim(),
  };
  const footerTitle = {
    zh: String(formData.get("footer_title_zh") ?? "").trim(),
    en: String(formData.get("footer_title_en") ?? "").trim(),
  };
  const footerCopyright = {
    zh: String(formData.get("footer_copyright_zh") ?? "").trim(),
    en: String(formData.get("footer_copyright_en") ?? "").trim(),
  };

  // Bilingual cookie + GDPR notices (zh + en), same rationale as footer_notice:
  // always send a structured value so clearing both fields removes the notice.
  const cookieNotice = {
    zh: String(formData.get("cookie_notice_zh") ?? "").trim(),
    en: String(formData.get("cookie_notice_en") ?? "").trim(),
  };
  const gdprNotice = {
    zh: String(formData.get("gdpr_notice_zh") ?? "").trim(),
    en: String(formData.get("gdpr_notice_en") ?? "").trim(),
  };

  // Search chip short labels: one rule per line "keyword=中文|English".
  // keyword is matched case-insensitively against the full amenity string.
  // The 搜尋短詞 editor was removed from the admin (client: 多餘了). The key is
  // still read by the front end, so an absent field means "leave it alone" —
  // `null` (no such field) is not the same as "" (field present and cleared),
  // and treating them alike would wipe a site's saved rules on the next save
  // of any unrelated tab.
  const amenityShortRaw = formData.get("amenity_short");
  const amenityShort = amenityShortRaw === null
    ? (existingSettings.amenity_short ?? [])
    : String(amenityShortRaw)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const eq = line.indexOf("=");
      if (eq < 0) return null;
      const match = line.slice(0, eq).trim();
      const [zh, en] = line.slice(eq + 1).split("|").map((p) => p.trim());
      if (!match || !zh) return null;
      return { match, zh, en: en || zh };
    })
    .filter(Boolean);

  return {
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    domain: String(formData.get("domain") ?? ""),
    status: String(formData.get("status") ?? "active"),
    default_locale: String(formData.get("default_locale") ?? "zh"),
    /* `||`, not `??`: the field is a free-text box now (the `name` moved off the
       `<input type="color">` beside it, which could not hold `transparent` or
       `rgba(…)`), so it can arrive present-but-empty. An empty box means "use
       the default", not "store an empty colour" — theme_config is replaced
       wholesale by this payload, so "" would be written through. */
    primary_color: String(formData.get("primary_color") || DEFAULT_PRIMARY_COLOR),
    accent_color: String(formData.get("accent_color") || DEFAULT_ACCENT_COLOR),
    nav_bg: String(formData.get("nav_bg") ?? ""),
    nav_text: String(formData.get("nav_text") ?? ""),
    footer_bg: String(formData.get("footer_bg") ?? ""),
    footer_text: String(formData.get("footer_text") ?? ""),
    button_bg: String(formData.get("button_bg") ?? ""),
    button_text: String(formData.get("button_text") ?? ""),
    nav_button_bg: String(formData.get("nav_button_bg") ?? ""),
    nav_button_text: String(formData.get("nav_button_text") ?? ""),
    footer_button_bg: String(formData.get("footer_button_bg") ?? ""),
    footer_button_text: String(formData.get("footer_button_text") ?? ""),
    page_bg: String(formData.get("page_bg") ?? ""),
    contact_email: String(formData.get("contact_email") ?? ""),
    contact_line: String(formData.get("contact_line") ?? ""),
    seo_title: String(formData.get("seo_title") ?? ""),
    seo_description: String(formData.get("seo_description") ?? ""),
    parent_site_id: Number(formData.get("parent_site_id") || 0) || null,
    template_site_id: Number(formData.get("template_site_id") || 0) || null,
    is_template: formData.get("is_template") === "on",
    template_version: String(formData.get("template_version") ?? "v1"),
    settings: {
      ...existingSettings,
      ga_id: String(formData.get("ga_id") ?? ""),
      ads_code: String(formData.get("ads_code") ?? ""),
      cookie_notice: cookieNotice,
      gdpr_notice: gdprNotice,
      contact_phone: String(formData.get("contact_phone") ?? ""),
      show_footer_phone: formData.get("show_footer_phone") === "on",
      // The header booking button (wording + destination).
      booking: parseBooking(formData, (existingSettings as Record<string, unknown>).booking),
      // Inquiry types offered on /contact. Kept in settings so staff can retitle
      // or add one (企劃合作, 婚宴…) without a deploy; blank falls back to the
      // built-in list. Malformed JSON keeps whatever was stored rather than
      // wiping the list on a bad save.
      contact_inquiry_types: parseInquiryTypes(
        formData.get("contact_inquiry_types"),
        existingSettings.contact_inquiry_types,
      ),
      // Search filter options. Blank falls back to the bundled lists; county and
      // district are not here because they are derived from the stays themselves.
      search_facilities: parseLabelledList(
        formData.get("search_facilities"),
        existingSettings.search_facilities,
      ),
      search_experiences: parseLabelledList(
        formData.get("search_experiences"),
        existingSettings.search_experiences,
      ),
      search_types: parseLabelledList(
        formData.get("search_types"),
        existingSettings.search_types,
      ),
      search_guest_ranges: parseLabelledList(
        formData.get("search_guest_ranges"),
        existingSettings.search_guest_ranges,
        (value) => /^\d{1,2}$/.test(value),
      ),
      // The unit word the range labels are built from ("人" / "guests"), so a
      // site can say 位 or people without re-typing every label.
      search_guest_ranges_unit: parseUnit(
        formData.get("search_guest_ranges_unit"),
        existingSettings.search_guest_ranges_unit,
      ),
      social_facebook: String(formData.get("social_facebook") ?? ""),
      social_instagram: String(formData.get("social_instagram") ?? ""),
      // Each icon only appears in the header when its URL is filled in, so an
      // unused platform costs nothing.
      social_threads: String(formData.get("social_threads") ?? ""),
      social_tiktok: String(formData.get("social_tiktok") ?? ""),
      // LINE had a field in Contact and another in Social Links, each writing a
      // different key, so the same account had two places to be entered and
      // could disagree with itself. One field remains, under Contact, and it
      // feeds both — the header icon reads the social key, the contact block
      // reads contact_config.line.
      social_line: String(formData.get("contact_line") ?? ""),
      head_code: String(formData.get("head_code") ?? ""),
      body_code: String(formData.get("body_code") ?? ""),
      font_preset: String(formData.get("font_preset") ?? "classic"),
      // Granular content fonts: heading vs body, each split CJK / Latin. When the
      // 4 selects are present we store them so fontVars() uses the granular config.
      // Per-level type scale. Parsed and range-checked in parseTypeScale so a
      // stray value cannot reach a style attribute.
      // The share image a page falls back to when it has none of its own. Kept
      // per site so a link to a villa previews the villa, not the group cover.
      seo_og_image: parseImageUrl(formData.get("seo_og_image"), existingSettings.seo_og_image),
      type_scale: parseTypeScale(formData.get("type_scale"), existingSettings.type_scale),
      layout: parseLayout(formData.get("layout"), existingSettings.layout),
      /* Checked against the catalogue on the way in rather than stored verbatim.
         These four land in an inline font-family on every page of the site, and
         the render side already refuses a key it does not know — but a config
         that stores a word nothing resolves is a site whose font panel shows one
         face and whose pages draw another, which is the harder bug to see. */
      font_config: {
        title_cjk: parseFaceKey(formData.get("font_title_cjk"), cjkFaceKey, "songti"),
        title_latin: parseFaceKey(formData.get("font_title_latin"), latinFaceKey, "cormorant"),
        body_cjk: parseFaceKey(formData.get("font_body_cjk"), cjkFaceKey, "songti"),
        body_latin: parseFaceKey(formData.get("font_body_latin"), latinFaceKey, "ebgaramond"),
      },
      logo_url: String(formData.get("logo_url") ?? ""),
      // Show only the logo in the header (hide the site-name wordmark). The page
      // <title> is unaffected — it comes from SEO metadata, not the header.
      header_logo_only: formData.get("header_logo_only") === "on",
      // Off means the bar stays put at every scroll position, which is the
      // default the client asked for; auto-hide is the opt-in.
      header_auto_hide: formData.get("header_auto_hide") === "on",
      amenity_short: amenityShort,
      ...(Object.keys(nameTranslations).length > 0 ? { name_translations: nameTranslations } : {}),
      footer_notice: footerNotice,
      footer_description: footerDescription,
      footer_title: footerTitle,
      footer_copyright: footerCopyright,
    }
  };
}

export async function createSiteAction(formData: FormData) {
  const result = await adminJsonDataRequest<{ slug: string }>("/sites", sitePayload(formData), "POST", "Site create failed");
  if (!result.ok) stampedRedirect(`/admin/sites/new?error=${encodeURIComponent(result.message)}`);
  const site = result.data;
  if (!site?.slug) stampedRedirect("/admin/sites/new?error=Site create failed");
  const SAFE_SLUG = /^[a-z0-9][a-z0-9-]*$/;
  if (!SAFE_SLUG.test(site!.slug)) throw new Error("Invalid slug");
  // Only switch to the new site if it's NOT a child site — creating a child site
  // should keep the user on the parent site context rather than forcing a switch.
  const isChildSite = Boolean(Number(formData.get("parent_site_id") || 0));
  if (!isChildSite) {
    (await cookies()).set("admin-site", site!.slug, { path: "/", sameSite: "lax", maxAge: 2592000, httpOnly: true });
  }
  actionRedirect(result, "/admin/sites");
}

export async function updateSiteAction(siteId: string, formData: FormData) {
  const result = await adminJsonDataRequest<{ slug: string }>(`/sites/${siteId}`, sitePayload(formData), "PUT", "Site update failed");
  if (!result.ok) stampedRedirect(`/admin/sites/${siteId}?error=${encodeURIComponent(result.message)}`);
  const site = result.data;
  if (!site?.slug) stampedRedirect(`/admin/sites/${siteId}?error=Site update failed`);
  const SAFE_SLUG = /^[a-z0-9][a-z0-9-]*$/;
  if (!SAFE_SLUG.test(site!.slug)) throw new Error("Invalid slug");
  (await cookies()).set("admin-site", site!.slug, { path: "/", sameSite: "lax", maxAge: 2592000, httpOnly: true });
  actionRedirect(result, `/admin/sites/${siteId}`);
}

/** Same delete, addressed by argument rather than by a hidden form field.
 *  ConfirmSubmitButton — the themed dialog every other destructive action in
 *  this admin uses — invokes its action with an empty FormData, so a site id
 *  has to travel as a bound argument. Deleting a site is the most destructive
 *  thing here (it takes the stays, pages, banners, media and enquiries with
 *  it) and it was the one action still asking with a raw window.confirm(). */
export async function deleteSiteByIdAction(siteId: string) {
  const data = new FormData();
  data.set("site_id", siteId);
  await deleteSiteAction(data);
}

export async function deleteSiteAction(formData: FormData) {
  const siteId = String(formData.get("site_id") ?? "");
  if (!siteId) stampedRedirect("/admin/sites?error=Missing+site+ID");
  const result = await adminJsonRequest(`/sites/${siteId}`, {}, "DELETE", "Site delete failed");
  actionRedirect(result, "/admin/sites");
}

export async function updateSiteUserRoleAction(siteId: string, userId: string, formData: FormData) {
  const result = await adminJsonRequest(
    `/sites/${siteId}/users/${userId}`,
    { role: String(formData.get("role") ?? "") || null },
    "PATCH",
    "Permission update failed"
  );
  actionRedirect(result, `/admin/sites/${siteId}`);
}

export async function addSiteUserAction(siteId: string, formData: FormData) {
  const userId = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "editor");
  if (!userId) stampedRedirect(`/admin/sites/${siteId}?error=User+ID+required`);

  // Backend uses a single PATCH endpoint: role=<name> 新增/更新；role=null 移除
  const result = await adminJsonRequest(
    `/sites/${siteId}/users/${userId}`,
    { role },
    "PATCH",
    "Add user failed"
  );
  actionRedirect(result, `/admin/sites/${siteId}`);
}

export async function removeSiteUserAction(siteId: string, userId: string) {
  // 同樣走 PATCH，role: null 代表從此網站移除
  const result = await adminJsonRequest(
    `/sites/${siteId}/users/${userId}`,
    { role: null },
    "PATCH",
    "Remove user failed"
  );
  actionRedirect(result, `/admin/sites/${siteId}`);
}

/**
 * Auto-save page order and visibility without redirect.
 * Called on drag-drop reorder and visibility toggle in SitePageEditor.
 */
export async function updatePageSettingsAction(
  siteId: string,
  pageOverrides: Record<string, Record<string, unknown>>,
) {
  // Fetch current site data first
  const siteRes = await adminJsonDataRequest<{
    settings: Record<string, unknown>;
    name: string;
    slug: string;
    domain: string;
    status: string;
    default_locale: string;
    theme_config: Record<string, string>;
    contact_config: Record<string, string>;
    seo_defaults: Record<string, string>;
    parent_site_id: number | null;
    template_site_id: number | null;
    is_template: boolean;
    template_version: string;
  }>(`/sites/${siteId}`, {}, "GET", "Fetch site failed");

  if (!siteRes.ok || !siteRes.data) return;
  const site = siteRes.data;

  const existingSettings = site.settings ?? {};
  const existingPages = (existingSettings.pages ?? {}) as Record<string, Record<string, unknown>>;

  // Merge overrides into pages
  for (const [key, overrides] of Object.entries(pageOverrides)) {
    existingPages[key] = { ...(existingPages[key] ?? {}), ...overrides };
  }

  const payload = siteReplacePayload(site as unknown as AdminSite, { ...existingSettings, pages: existingPages });

  await adminJsonRequest(`/sites/${siteId}`, payload, "PUT", "Page settings save failed");
}

// NOTE: createPageAction lived here but called a non-existent endpoint.
// Site editor tab2 now uses cmsActions.createPageAction → POST /cms/pages.


/**
 * Read the inquiry-type list posted by the settings form. Entries without a
 * label or with a code the API would reject are dropped, so a typo in the admin
 * cannot produce a form whose every submission 422s.
 */
/**
 * Read a bilingual label + value list posted by the settings form. Rows with no
 * label or an unusable value are dropped, and a payload that will not parse
 * leaves the stored list alone rather than emptying it on one bad save.
 */
const TYPE_LEVELS = ["h1", "h2", "h3", "h4", "body", "small"];

/**
 * Read the type scale posted by the settings form.
 *
 * The values end up in an inline style attribute, so each is checked against
 * the shape it is allowed to have rather than trusted: a length with a unit or
 * a clamp()/calc(), a standard font weight, a bare line-height number. Anything
 * else is dropped, and unparseable JSON leaves the stored scale alone rather
 * than blanking a site's typography on one bad save.
 */
/**
 * Page rhythm. Only the three known keys survive, each against its own
 * allow-list, so nothing typed into the form reaches a CSS variable unchecked —
 * these values are interpolated into a style attribute on every page.
 */
function parseLayout(raw: FormDataEntryValue | null, previous: unknown): unknown {
  const text = String(raw ?? "").trim();
  if (!text) return previous ?? {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return previous ?? {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return previous ?? {};
  const input = parsed as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  const step = (value: unknown, allowed: string[]) => {
    const v = String(value ?? "").trim();
    if (allowed.includes(v)) return v;
    // A plain number of pixels is also accepted, for a site that wants a value
    // between the steps; anything else is dropped rather than passed through.
    return /^\d{1,3}$/.test(v) ? v : "";
  };

  const gutter = step(input.gutter, ["narrow", "normal", "wide"]);
  if (gutter) out.gutter = gutter;
  const gap = step(input.section_gap, ["tight", "normal", "roomy"]);
  if (gap) out.section_gap = gap;

  const scale = Number(input.ui_scale);
  if (Number.isFinite(scale) && scale >= 0.85 && scale <= 1.4) out.ui_scale = scale;

  return out;
}

function parseTypeScale(raw: FormDataEntryValue | null, previous: unknown): unknown {
  const text = String(raw ?? "").trim();
  if (!text) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return previous ?? {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return previous ?? {};
  // The same guard the front-end applies: a url() inside a clamp still fetches,
  // so no CSS function may appear inside the length.
  const isLength = (v: string) =>
    !/(url|image|element|expression|attr|var)\s*\(/i.test(v) &&
    (/^\d{1,3}(\.\d+)?(px|rem|em)$/.test(v) || /^(clamp|calc)\([\d.,\s%a-z()+*/-]{1,80}\)$/i.test(v));
  const out: Record<string, Record<string, string>> = {};
  for (const level of TYPE_LEVELS) {
    const cfg = (parsed as Record<string, unknown>)[level];
    if (!cfg || typeof cfg !== "object") continue;
    const c = cfg as Record<string, unknown>;
    const entry: Record<string, string> = {};
    const size = String(c.size ?? "").trim();
    const weight = String(c.weight ?? "").trim();
    const line = String(c.line ?? "").trim();
    const font = String(c.font ?? "").trim();
    if (size && isLength(size)) entry.size = size;
    if (/^(100|200|300|400|500|600|700|800|900)$/.test(weight)) entry.weight = weight;
    if (/^\d(\.\d+)?$/.test(line)) entry.line = line;
    if (font && TYPE_FACE_KEYS.has(font)) entry.font = font;
    if (Object.keys(entry).length) out[level] = entry;
  }
  return out;
}

/**
 * A URL that ends up inside an og:image meta tag.
 *
 * Checked against the same http(s)-or-site-relative allow-list the block
 * renderers use for hrefs, so a `javascript:` or protocol-relative value typed
 * into the field cannot reach the tag. An absent field means the form did not
 * carry it and the stored value stands; a present but empty one is a real
 * instruction to clear the image.
 */
function parseImageUrl(raw: FormDataEntryValue | null, previous: unknown): string {
  if (raw === null) return typeof previous === "string" ? previous : "";
  const text = String(raw).trim();
  if (!text) return "";
  if (text.length > 500 || !isSafeUrl(text)) return typeof previous === "string" ? previous : "";
  return text;
}

/**
 * The header's 立即預約 button: its wording and where it goes.
 *
 * `settings.booking` has been read by PropertyHeader since the beginning and
 * had no field anywhere in the admin, so the only way to retitle the button or
 * point it somewhere was to edit the settings JSON in the database. That is the
 * whole of 客戶: 「立即預約」可進一步改為「立即訂房」、直接連到正式訂房系統 —
 * once the booking system exists, its URL goes in this field rather than in a
 * deploy.
 *
 * phone and line are carried through untouched: this form does not manage them,
 * and rebuilding the object without them would silently drop the fallbacks the
 * button uses when no href is set.
 */
function parseBooking(formData: FormData, previous: unknown): Record<string, unknown> {
  const prev = (previous && typeof previous === "object" ? previous : {}) as Record<string, unknown>;
  const zh = String(formData.get("booking_cta_label_zh") ?? "").trim().slice(0, 40);
  const en = String(formData.get("booking_cta_label_en") ?? "").trim().slice(0, 40);
  const href = String(formData.get("booking_cta_href") ?? "").trim();
  return {
    ...prev,
    // Both blank means "use the built-in 立即預約 / Book Now", which is what an
    // absent key means to bookingLabel().
    cta_label: zh || en ? { zh, en } : undefined,
    /* Same allow-list as every other admin-typed href. An external booking
       system is https and passes; a `javascript:` value is rejected and the
       stored one stands rather than being replaced with something unsafe. */
    cta_href: href && href.length <= 500 && isSafeUrl(href)
      ? href
      : href
        ? (typeof prev.cta_href === "string" ? prev.cta_href : "")
        : "",
  };
}

function parseLabelledList(
  raw: FormDataEntryValue | null,
  previous: unknown,
  isValidValue: (value: string) => boolean = (value) => value.length > 0,
): unknown {
  const text = String(raw ?? "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) return previous ?? [];
    return parsed.filter((item) => {
      const o = (item ?? {}) as Record<string, unknown>;
      const label = o.label as Record<string, string> | string | undefined;
      const hasLabel = typeof label === "string"
        ? label.trim().length > 0
        : Boolean(label && (label.zh?.trim() || label.en?.trim()));
      return hasLabel && isValidValue(String(o.value ?? "").trim());
    });
  } catch {
    return previous ?? [];
  }
}

/** { zh, en } unit words for the guest-range labels. Length-capped because both
 *  strings end up rendered into a filter label. */
function parseUnit(raw: FormDataEntryValue | null, previous: unknown): unknown {
  if (raw === null) return previous ?? {};
  const text = String(raw).trim();
  if (!text) return previous ?? {};
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return previous ?? {};
    const o = parsed as Record<string, unknown>;
    return { zh: String(o.zh ?? "").trim().slice(0, 12), en: String(o.en ?? "").trim().slice(0, 24) };
  } catch {
    return previous ?? {};
  }
}

function parseInquiryTypes(raw: FormDataEntryValue | null, previous: unknown): unknown {
  // Absent field (the 詢問類型 editor was removed from the admin) means "leave
  // the stored list alone"; an empty one means the editor was there and was
  // cleared, which is a real instruction to fall back to the built-in list.
  if (raw === null) return previous ?? [];
  return parseLabelledList(raw, previous, (value) => INQUIRY_SOURCES.some(([code]: [string, string, string]) => code === value));
}

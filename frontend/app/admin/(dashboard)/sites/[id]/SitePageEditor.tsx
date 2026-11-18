"use client";

import { useState, useMemo, useEffect, useCallback, useRef, type ReactNode } from "react";
import PreviewOverlay, { previewDeviceClass } from "../../../modules/PreviewOverlay";
import SearchOptionsField from "./SearchOptionsField";
import GuestRangeField from "./GuestRangeField";
import { SERVICE_FACILITIES, GUEST_RANGES } from "../../../../modules/searchOptions";
import { ROOT_SITE_DEFAULT_PAGES } from "../../../modules/blockForms";
import { pageLabel } from "../../../../modules/contentTypes";
import LayoutField from "./LayoutField";
import TypeScaleField from "./TypeScaleField";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Circle } from "lucide-react";
import type { AdminSite, AdminSiteUser, AdminPage, AdminProfile } from "../../../modules/adminApi";
import Link from "next/link";
import SafeForm from "../../../modules/SafeForm";
import { useFormDraft } from "../../../modules/useFormDraft";
import { formSnapshot, useUnsavedGuard } from "../../../modules/useUnsavedGuard";
import SubmitButton from "../../../modules/SubmitButton";
import { Badge, Callout, Card, CellTitle, Dialog, DialogActions, Field, Input, ListRow, ListRows, Progress, RowActions, Segmented, Select, Stack, TableFrame, buttonClass, useConfirm } from "../../../ui";
import { cx } from "../../../ui/cx";
import AdminFlash from "../../../modules/AdminFlash";
import HeroImageField from "../../stays/HeroImageField";
import ConfirmSubmitButton from "../../../modules/ConfirmSubmitButton";
import { deleteSiteByIdAction, addSiteUserAction, updateSiteUserRoleAction, removeSiteUserAction, updatePageSettingsAction } from "../../../modules/siteActions";
import { createPageAction } from "../../../modules/cmsActions";
import { addPropertyPageAction, deletePropertyPageAction } from "../../../modules/propertyPagesActions";
import { DEFAULT_PROPERTY_PAGES, type PropertyPageConfig, pageLabel as resolvePageLabel } from "../../../../modules/property/types";
import { canonicalFontConfig, cjkFaceStack, presetToFontConfig, DEFAULT_ACCENT_COLOR, DEFAULT_PRIMARY_COLOR } from "../../../../modules/fontPresets";
import { FontFacePicker } from "../../../modules/FontFacePicker";

type TranslationsMap = Record<string, Record<string, string>>;

/**
 * A page row's name in one language.
 *
 * Split out of the list-building effect so switching 中文 / English recomputes
 * the NAME and nothing else. That effect derives the whole array — order
 * included — from `site.settings`, and `site` is a server prop that does not
 * refresh: reordering a page auto-saves to the server and updates only the
 * local list, so re-deriving from the stale prop put the rows back in the OLD
 * sort_order while the database already held the new one. Clicking a language
 * button silently undid the reorder on screen, with the two now disagreeing and
 * nothing saying so.
 *
 * `homepage` is not a settings entry — it is the site root, shown as a row so
 * the front page is reachable from page management — so its name is fixed here
 * rather than read from a label that does not exist.
 */
function pageDisplayName(key: string, labelSource: unknown, locale: string): string {
  if (key === "homepage") return locale === "zh" ? "首頁" : "Homepage";
  // A label is allowed to be one plain string chosen for both languages; the
  // nav renderers accept that shape too.
  /* One resolver, the same one the public page and the nav use. This had its
     own — `map[locale] || map.en || key` with no bundled default anywhere in
     it — and two of the reported symptoms came straight out of that:

       * 人才招募 and 民宿加盟 are stored as `label: {}`. An empty object is not
         nullish, so `cfg?.label ?? def?.label` at the call site keeps it and
         never reaches the default; then neither `zh` nor `en` is there and the
         row printed the raw key, `career` / `franchise`, in 頁面管理.
       * A category named only in English printed that English name on a
         Chinese screen, because `map.en` was tried before any Chinese default
         (客戶: 為何有些分類標籤只有英文).

     pageLabel puts the bundled Chinese ahead of a foreign-language label and
     treats an absent name as absent however it is spelled. */
  return pageLabel(key, labelSource, locale);
}

/**
 * Re-resolve the page list's names for a language, in place.
 *
 * The whole point is what it does NOT touch. The rows keep their order, their
 * Nav/Footer state and any rename made since the list was built — every one of
 * which the language buttons used to revert, because switching language re-ran
 * the effect that derives the list from `site.settings`, a prop that is not
 * refreshed by the auto-saves the page-management tab performs. A drag reorder
 * went to the server and back into the local list; the settings prop still held
 * the old sort_order; and one click on 中文 / English put the screen back to it
 * while the database kept the new order. Nothing said the two now disagreed.
 *
 * Rows whose name does not change are returned by identity, and so is the array
 * when nothing changed at all, so this cannot cause a render on its own.
 */
function relabelPages<T extends { type: string; labelSource?: unknown; name: string }>(
  pages: T[],
  locale: string,
): T[] {
  let changed = false;
  const next = pages.map((p) => {
    const name = pageDisplayName(p.type, p.labelSource, locale);
    if (name === p.name) return p;
    changed = true;
    return { ...p, name };
  });
  return changed ? next : pages;
}

/**
 * Default category pages for the root (母站) site.
 * These are fixed frontend routes that use CategoryPage.
 * Key = content_type / route slug, value = bilingual label + sort order.
 */
interface SitePageEditorProps {
  action: (siteId: string, formData: FormData) => void | Promise<void>;
  siteId: string;
  site: AdminSite;
  profile: AdminProfile;
  siteUsers: AdminSiteUser[];
  sitePages: AdminPage[];
  copy: any;
  copyZh: any;
  copyEn: any;
  flash?: { error?: string; notice?: string; nonce?: string };
  returnTo?: string;
}

/**
 * What an `<input type="color">` can actually show.
 *
 * The swatch is a picker for the text box beside it, not the field that gets
 * submitted. Handed `transparent`, `rgba(…)` or an empty box it cannot render
 * any of them: the browser falls back to #000000 and logs a format warning. So
 * it is shown the site default instead, and the text box stays the authority.
 */
function swatchValue(raw: string, fallback: string): string {
  const v = raw.trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v : fallback;
}

/** One language's half of a bilingual field. Both halves stay in the form,
 *  because the save reads both; only the language being edited shows. */
function LocaleLabel({ show, span, className, children }: { show: boolean; span?: boolean; className?: string; children: ReactNode }) {
  return <label className={cx(span && "a-u-span", show ? "a-u-block" : "a-u-hidden", className)}>{children}</label>;
}

function splitBilingualSeo(value: unknown, defaultLocale: "zh" | "en"): { zh: string; en: string } {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const map = value as Record<string, unknown>;
    return { zh: String(map.zh ?? ""), en: String(map.en ?? "") };
  }
  const text = String(value ?? "");
  if (text.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      return { zh: String(parsed.zh ?? ""), en: String(parsed.en ?? "") };
    } catch {
      // Legacy plain text continues through the compatibility parser below.
    }
  }
  const separator = text.match(/\s*(?:·|｜|\|)\s*/);
  if (separator?.index !== undefined) {
    return {
      zh: text.slice(0, separator.index).trim(),
      en: text.slice(separator.index + separator[0].length).trim(),
    };
  }
  return defaultLocale === "en" ? { zh: "", en: text } : { zh: text, en: "" };
}

function setBilingualSeo(
  value: unknown,
  locale: "zh" | "en",
  next: string,
  defaultLocale: "zh" | "en",
): string {
  const pair = splitBilingualSeo(value, defaultLocale);
  pair[locale] = next;
  return `${pair.zh} · ${pair.en}`;
}

function cleanBilingualSeo(value: unknown, defaultLocale: "zh" | "en" = "zh"): string {
  const pair = splitBilingualSeo(value, defaultLocale);
  const zh = pair.zh.trim();
  const en = pair.en.trim();
  return zh || en ? JSON.stringify({ zh, en }) : "";
}

export default function SitePageEditor({
  action,
  siteId,
  site,
  profile,
  siteUsers,
  sitePages,
  copy,
  copyZh,
  copyEn,
  flash,
  returnTo = "/admin/sites",
}: SitePageEditorProps) {
  const { ask, tell } = useConfirm();
  const canDeleteSite = profile.permissions?.includes("*") || profile.permissions?.includes("sites:write") || false;
  /* head_code / body_code / ads_code become executable code on this site's
     public pages, which share an origin with /admin — so they are the owner's
     to set, not a site admin's. The backend enforces this (update_site carries
     the stored values forward for anyone else); hiding the fields here is so a
     site admin does not type into a box whose contents are then discarded. */
  const canSetScriptCode = profile.permissions?.includes("*") || false;
  const siteLocale = copy === copyZh ? "zh" : "en";
  // 母站和子站都可以管理頁面
  const isRootSite = !site.parent_site_id;
  const pagesReadonly = false;
  const router = useRouter();
  // Portal mount target — only after mount, otherwise SSR blows up
  const [portalReady, setPortalReady] = useState(false);
  useEffect(() => { setPortalReady(true); }, []);

  const [tab, setTab] = useState(1);
  /** Which search list is open on its panel; null when the list is at rest. */
  const [searchSheet, setSearchSheet] = useState<string | null>(null);
  const [editLocale, setEditLocale] = useState<"zh" | "en">("zh");
  const [status, setStatus] = useState(site?.status ?? "draft");
  const defaultLocale: "zh" | "en" = site?.default_locale === "en" ? "en" : "zh";
  const [seoTitle, setSeoTitle] = useState(() => cleanBilingualSeo(site?.seo_defaults?.title, defaultLocale));
  const [seoDescription, setSeoDescription] = useState(() => cleanBilingualSeo(site?.seo_defaults?.description, defaultLocale));
  // Theme colors — controlled so text field syncs with color picker.
  // The defaults are imported, never retyped: the picker used to open on
  // #2f4638/#b78b58 while the page drew #283d34/#a56d43, so the swatch reported
  // a colour the site had never had and did not have now.
  const [primaryColor, setPrimaryColor] = useState(site?.theme_config?.primaryColor ?? DEFAULT_PRIMARY_COLOR);
  const [accentColor, setAccentColor] = useState(site?.theme_config?.accentColor ?? DEFAULT_ACCENT_COLOR);
  const [navBg, setNavBg] = useState(site?.theme_config?.navBg ?? "");
  const [navText, setNavText] = useState(site?.theme_config?.navText ?? "");
  const [footerBg, setFooterBg] = useState(site?.theme_config?.footerBg ?? "");
  const [footerText, setFooterText] = useState(site?.theme_config?.footerText ?? "");
  const [buttonBg, setButtonBg] = useState(site?.theme_config?.buttonBg ?? "");
  const [buttonText, setButtonText] = useState(site?.theme_config?.buttonText ?? "");
  /* 立即預約 (header) and 訂閱 (footer) are two different buttons in two
     different places, so they get their own colours rather than sharing one
     setting that also repainted every ordinary button on the page. */
  /* The header booking button's own wording/destination, read out of the same
     settings.booking the villa header reads. Flattened here so the three inputs
     below stay uncontrolled like the rest of this form. */
  const bookingCfg = useMemo(() => {
    const b = ((site?.settings as Record<string, unknown> | undefined)?.booking ?? {}) as Record<string, unknown>;
    const label = b.cta_label;
    if (typeof label === "string") return { zh: label, en: label, href: b.cta_href ?? "" };
    const pair = (label ?? {}) as Record<string, unknown>;
    return { zh: pair.zh ?? "", en: pair.en ?? "", href: b.cta_href ?? "" };
  }, [site?.settings]);
  const [navButtonBg, setNavButtonBg] = useState(site?.theme_config?.navButtonBg ?? "");
  const [navButtonText, setNavButtonText] = useState(site?.theme_config?.navButtonText ?? "");
  const [footerButtonBg, setFooterButtonBg] = useState(site?.theme_config?.footerButtonBg ?? "");
  const [footerButtonText, setFooterButtonText] = useState(site?.theme_config?.footerButtonText ?? "");
  const [pageBg, setPageBg] = useState(site?.theme_config?.pageBg ?? "");
  // Granular content fonts (heading / body × CJK / Latin). Start from the saved
  // font_config, else derive sensible defaults from the legacy font_preset.
  /* Both branches go through canonicalFontConfig, because both produce the OLD
     words — a saved config holds `serif`/`sans`, and presetToFontConfig is the
     record of what each legacy preset meant, also in the old words. The four
     menus below list TYPE_FACES, where those faces are called `songti` and
     `heiti`, so an untranslated value would leave the menu showing its first
     option and the next save would post that instead of the site's own face. */
  const initFontCfg = useMemo(() => {
    const s = (site?.settings ?? {}) as Record<string, any>;
    const fc = s.font_config;
    if (fc && fc.title_cjk) return canonicalFontConfig(fc);
    return canonicalFontConfig(presetToFontConfig(typeof s.font_preset === "string" ? s.font_preset : "classic"));
  }, [site]);
  const [fTitleCjk, setFTitleCjk] = useState(initFontCfg.title_cjk);
  const [fTitleLatin, setFTitleLatin] = useState(initFontCfg.title_latin);
  const [fBodyCjk, setFBodyCjk] = useState(initFontCfg.body_cjk);
  const [fBodyLatin, setFBodyLatin] = useState(initFontCfg.body_latin);
  const applyFontPreset = useCallback((preset: string) => {
    const c = canonicalFontConfig(presetToFontConfig(preset));
    setFTitleCjk(c.title_cjk); setFTitleLatin(c.title_latin);
    setFBodyCjk(c.body_cjk); setFBodyLatin(c.body_latin);
  }, []);
  // Per-page live-preview modal (mirrors the homepage editor's preview overlay)
  const [pagePreview, setPagePreview] = useState<{ url: string; name: string } | null>(null);
  const [pagePreviewDevice, setPagePreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const previewPanelRef = useRef<HTMLDivElement>(null);
  const previewFirstControlRef = useRef<HTMLButtonElement>(null);
  const previewCloseControlRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!pagePreview) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    previewPanelRef.current?.focus();
    const previewFrame = previewPanelRef.current?.querySelector("iframe") ?? null;
    const frameFocusable = () => {
      try {
        const frameDocument = previewFrame?.contentDocument;
        if (!frameDocument) return [];
        return Array.from(frameDocument.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )).filter(item => item.getClientRects().length > 0 && getComputedStyle(item).visibility !== "hidden");
      } catch {
        // The preview URL is normally same-origin. If the browser cannot expose
        // its document, the parent controls still provide a safe way out.
        return [];
      }
    };
    const attachFrameKeys = () => {
      try { previewFrame?.contentDocument?.addEventListener("keydown", onFrameKeyDown, true); } catch { /* cross-origin preview */ }
    };
    function onFrameKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setPagePreview(null);
        return;
      }
      if (event.key !== "Tab") return;
      const items = frameFocusable();
      const frameDocument = previewFrame?.contentDocument;
      const active = frameDocument?.activeElement;
      if (!items.length) {
        event.preventDefault();
        (event.shiftKey ? previewCloseControlRef.current : previewFirstControlRef.current)?.focus();
      } else if (event.shiftKey && (active === items[0] || active === frameDocument?.body)) {
        event.preventDefault();
        previewCloseControlRef.current?.focus();
      } else if (!event.shiftKey && active === frameDocument?.body) {
        event.preventDefault();
        items[0].focus();
      } else if (!event.shiftKey && items.length && active === items[items.length - 1]) {
        event.preventDefault();
        previewFirstControlRef.current?.focus();
      }
    }
    attachFrameKeys();
    previewFrame?.addEventListener("load", attachFrameKeys);
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setPagePreview(null);
      }
      if (event.key === "Tab") {
        const controls = previewPanelRef.current?.querySelectorAll<HTMLElement>('button, iframe, [tabindex="0"]');
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === previewPanelRef.current)) {
          event.preventDefault();
          const inFrame = frameFocusable();
          (inFrame[inFrame.length - 1] ?? last).focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previewFrame?.removeEventListener("load", attachFrameKeys);
      try { previewFrame?.contentDocument?.removeEventListener("keydown", onFrameKeyDown, true); } catch { /* cross-origin preview */ }
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [pagePreview]);

  // Bilingual site name
  const existingNameTrans = (site?.settings as any)?.name_translations as Record<string, string> | undefined;
  const [nameTranslations, setNameTranslations] = useState<Record<string, string>>(() => ({
    zh: existingNameTrans?.zh ?? site?.name ?? "",
    en: existingNameTrans?.en ?? site?.name ?? "",
  }));
  // Tab 2: Page list state for dragging
  const [pages, setPages] = useState<any[]>([]);
  /* Reorder by keyboard and by touch.
     The rows are reordered with HTML5 drag and drop, which never fires on a
     touch screen — so page order, and with it the nav and footer order, could
     not be changed at all from a phone or tablet. Same swap and same
     autoSavePages call the drop handler makes. */
  const movePage = (index: number, delta: number) => {
    const to = index + delta;
    if (to < 0 || to >= pages.length) return;
    const next = [...pages];
    [next[index], next[to]] = [next[to], next[index]];
    setPages(next);
    const overrides: Record<string, Record<string, unknown>> = {};
    next.forEach((p, i) => {
      const key = p.type ?? p.slug ?? String(p.id);
      overrides[key] = { sort_order: i };
    });
    setPageSettingsOverrides((prev) => {
      const merged = { ...prev };
      for (const [k, v] of Object.entries(overrides)) {
        merged[k] = { ...(merged[k] ?? {}), ...v };
      }
      return merged;
    });
    autoSavePages(overrides);
  };

  const [draggedPageId, setDraggedPageId] = useState<string | null>(null);
  // Track page settings overrides so they persist into the hidden input on form save
  const [pageSettingsOverrides, setPageSettingsOverrides] = useState<Record<string, Record<string, unknown>>>({});
  // Non-blocking debounced auto-save for drag/visibility/delete changes
  const [savingPages, setSavingPages] = useState(false);
  const pendingOverridesRef = useRef<Record<string, Record<string, unknown>>>({});
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;

  const flushSave = useCallback(async () => {
    if (savingRef.current) return;
    const overrides = pendingOverridesRef.current;
    if (Object.keys(overrides).length === 0) { setSavingPages(false); return; }
    pendingOverridesRef.current = {};
    savingRef.current = true;
    setSavingPages(true);
    try {
      await updatePageSettingsAction(siteId, overrides);
      retryCountRef.current = 0; // Reset on success
    } catch (err) {
      console.error("Auto-save failed:", err);
      retryCountRef.current++;
      if (retryCountRef.current < MAX_RETRIES) {
        // Merge back failed overrides so next flush retries them
        for (const [k, v] of Object.entries(overrides)) {
          pendingOverridesRef.current[k] = { ...(pendingOverridesRef.current[k] ?? {}), ...v };
        }
      } else {
        console.error("Auto-save: max retries reached, dropping overrides");
        retryCountRef.current = 0;
      }
    } finally {
      savingRef.current = false;
      // If more overrides accumulated during save, flush again
      if (Object.keys(pendingOverridesRef.current).length > 0) {
        flushSave();
      } else {
        setSavingPages(false);
      }
    }
  }, [siteId]);

  const autoSavePages = useCallback((overrides: Record<string, Record<string, unknown>>) => {
    // Merge into pending. "homepage" is a display-only row (the site root) — never
    // persist it into settings.pages or it leaks into the front-end nav as /homepage.
    for (const [key, val] of Object.entries(overrides)) {
      if (key === "homepage") continue;
      pendingOverridesRef.current[key] = { ...(pendingOverridesRef.current[key] ?? {}), ...val };
    }
    setSavingPages(true);
    // Debounce: coalesce rapid changes within 300ms
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(flushSave, 300);
  }, [flushSave]);
  // Track slug renames: oldSlug → newSlug. Applied when building _existing_settings_json.
  const [pageSlugRenames, setPageSlugRenames] = useState<Record<string, string>>({});
  // Tab 2: Page edit modal state
  const [showPageEditModal, setShowPageEditModal] = useState(false);
  const [pageModalError, setPageModalError] = useState("");
  const [creatingPage, setCreatingPage] = useState(false);
  /* The kit Dialog owns Escape, focus trap and scroll lock; opening clears the
     previous error. */
  useEffect(() => {
    if (showPageEditModal) setPageModalError("");
  }, [showPageEditModal]);
  const [editingPageId, setEditingPageId] = useState<number | string | null>(null);
  const [editingPageOrigSlug, setEditingPageOrigSlug] = useState<string | null>(null);
  const [pageForm, setPageForm] = useState<{ name: string; slug: string }>({
    name: "",
    slug: "",
  });
  // Tab 3: Permissions / account table state
  const [accountSearch, setAccountSearch] = useState("");
  const [accountRoleFilter, setAccountRoleFilter] = useState("all");
  const [accountStatusFilter, setAccountStatusFilter] = useState("all");
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [accountForm, setAccountForm] = useState<{
    user_id: string;
    name: string;
    email: string;
    role: string;
  }>({ user_id: "", name: "", email: "", role: "editor" });
  type Account = {
    id: number;
    name: string;
    email: string;
    role: string;
    status: string;
  };
  // 直接從 prop 衍生，不存 local state — 否則 useState 會凍結首次的值，
  // router.refresh() 拉到新 siteUsers 也不會反映到表格
  // 後端 /sites/:id/users 回傳所有 admin 使用者；只有 site_role 非空者真正屬於本站
  const accounts: Account[] = (siteUsers ?? [])
    .filter((u) => Boolean(u.site_role))
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.site_role,
      status: u.status || "active",
    }));
  /* Seven tabs of settings, and every save path redirects on failure as well as
     success — so a rejected save used to remount this editor seeded from the
     last saved state and take the whole session's work with it. */
  const { stash: stashDraft, recovered: draftRecovered, registerForm } =
    useFormDraft(`site-draft:${site?.id ?? "new"}`, Boolean(flash?.error));

  /* The unsaved-work guard.
     This form is almost entirely UNCONTROLLED — seven tabs of `defaultValue`
     inputs — so there is no React state to diff against a saved snapshot. What
     it does have is the FormData the save would send, which is the same thing
     the draft rescue above writes down, so that is what gets compared: a
     snapshot taken once the form is on screen against the same snapshot read
     back at unload. Reading it lazily is also why the guard takes a predicate
     here; a boolean would have to be recomputed on every keystroke to be
     current, over a form with a hundred-odd fields.
     Only browser-level exits are covered — see useUnsavedGuard. */
  const formElRef = useRef<HTMLFormElement | null>(null);
  const savedFormRef = useRef<string | null>(null);
  const attachForm = useCallback((form: HTMLFormElement | null) => {
    formElRef.current = form;
    registerForm(form);
  }, [registerForm]);
  useEffect(() => {
    /* Re-baselined after each save round trip, but never after a REJECTED one:
       a rejected save leaves the editor's work on screen and unsaved, and
       re-baselining there would tell the guard everything is fine on exactly
       the exit where it is not. `nonce` changes once per save, so an ordinary
       re-render (router.refresh, a modal closing) cannot re-baseline mid-edit
       and lose the warning. */
    if (flash?.error) return;
    savedFormRef.current = formSnapshot(formElRef.current);
  }, [flash?.nonce, flash?.error]);
  useUnsavedGuard(() => {
    const saved = savedFormRef.current;
    // No baseline means the form never rendered; nothing to compare, and
    // warning about an editor that was never open is the wrong answer.
    return saved !== null && formSnapshot(formElRef.current) !== saved;
  });

  // Local client-side toast (for modal save success, etc.) — independent of server flash.
  // AdminFlash handles its own auto-hide; the unique `id` forces a fresh mount per call.
  const [localFlash, setLocalFlash] = useState<{ id: number; tone: "success" | "error"; message: string } | null>(null);
  const showLocalFlash = (tone: "success" | "error", message: string) => {
    setLocalFlash({ id: Date.now(), tone, message });
  };

  // 可挑選加入此站的全域使用者 = 後端清單中 site_role 為空者
  const availableUsers = (siteUsers ?? []).filter((u) => !u.site_role);


  /** How many entries a search list holds, as last saved. Shown on the row so a
      list can be told apart from an empty one without opening it. */
  const searchCount = useCallback((key: string) => {
    const raw = (site?.settings as Record<string, unknown> | undefined)?.[key];
    const n = Array.isArray(raw)
      ? raw.length
      : typeof raw === "string"
        ? raw.split(String.fromCharCode(10)).filter((l) => l.trim()).length
        : 0;
    if (!n) return editLocale === "zh" ? "預設" : "Default";
    return editLocale === "zh" ? `${n} 項` : `${n}`;
  }, [site, editLocale]);

  // 根据 editLocale 选择合适的 copy
  const currentCopy = editLocale === "zh" ? copyZh : copyEn;

  // 标签页定义 - 新布局
  const tabs = [
    {
      label: editLocale === "zh" ? "基本資料" : "Site Settings",
      num: 1,
      warn: false
    },
    {
      label: editLocale === "zh" ? "頁面管理" : "Pages",
      num: 2,
      warn: false
    },
    {
      label: editLocale === "zh" ? "權限管理" : "Permissions",
      num: 3,
      warn: false
    },
    {
      label: editLocale === "zh" ? "SEO設置" : "SEO",
      num: 4,
      warn: false
    },
    {
      label: editLocale === "zh" ? "字型" : "Typography",
      num: 5,
      warn: false
    },
    {
      label: editLocale === "zh" ? "搜尋" : "Search",
      num: 6,
      warn: false
    },
    {
      label: editLocale === "zh" ? "進階 / 法規" : "Advanced / Legal",
      num: 7,
      warn: false
    },
  ];

  // 完成度检查
  const checks = useMemo(() => {
    const items = [
      {
        label: editLocale === "zh" ? "基本資訊" : "Site Info",
        desc: editLocale === "zh" ? "站點名稱、域名已設定" : "Site name and domain filled",
        ok: Boolean(site?.name && site?.domain),
      },
      {
        label: editLocale === "zh" ? "品牌配置" : "Branding",
        desc: editLocale === "zh" ? "主色、Logo 已上傳" : "Primary color and logo set",
        // primary colour lives in theme_config.primaryColor (not settings); logo in settings.logo_url
        ok: Boolean(site?.theme_config?.primaryColor && (site?.settings as any)?.logo_url),
      },
      {
        label: editLocale === "zh" ? "聯絡資訊" : "Contact Info",
        desc: editLocale === "zh" ? "郵箱、電話或 LINE 已設定" : "Email, phone or LINE set",
        // email/line live in contact_config; phone in settings.contact_phone
        ok: Boolean(site?.contact_config?.email || site?.contact_config?.line || (site?.settings as any)?.contact_phone),
      },
      {
        label: editLocale === "zh" ? "頁面設定" : "Pages",
        desc: editLocale === "zh" ? "至少有首頁設定" : "Homepage configured",
        ok: Boolean(site?.settings?.homepage),
      },
    ];
    const doneCount = items.filter((i) => i.ok).length;
    return { items, doneCount, pct: Math.round((doneCount / items.length) * 100) };
  }, [editLocale, site]);

  // 對應後端 SiteUpdate.status：active | draft | archived
  const statusLabels: Record<string, string> = {
    active: editLocale === "zh" ? "公開" : "Published",
    draft: editLocale === "zh" ? "草稿" : "Draft",
    archived: editLocale === "zh" ? "已歸檔" : "Archived",
  };

  const wrappedAction = (formData: FormData) => {
    // Defence in depth — never call the server action when the site is in
    // read-only mode, even if a stray submit button slipped past the
    // fieldset[disabled] wrapper.
    if (site?._can_edit === false) return;
    return action(siteId, formData);
  };

  // Tab 3: 角色 / 狀態 定義（帳戶表格）— 站點角色: admin / editor（無 owner）
  const ROLE_DEFS: Record<string, { zh: string; en: string; tint: string; ink: string }> = {
    admin: { zh: "站點管理員", en: "Admin", tint: "#dce6df", ink: "#2f4a3c" },
    editor: { zh: "內容編輯", en: "Editor", tint: "#e3e9f3", ink: "#33507f" },
  };
  const roleFallback = { zh: "其他", en: "Other", tint: "#ece6dc", ink: "#6a5c4a" };
  // 對應後端 user.is_active → "active" / "archived"
  const STATUS_DEFS: Record<string, { zh: string; en: string; dot: string; ink: string }> = {
    active: { zh: "啟用", en: "Active", dot: "#3a9d6b", ink: "#2f6b4a" },
    archived: { zh: "已封存", en: "Archived", dot: "#b9b3aa", ink: "#857f76" },
  };
  const filteredAccounts = accounts.filter((a) => {
    const q = accountSearch.trim().toLowerCase();
    const matchQ =
      !q ||
      a.name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q);
    const matchRole = accountRoleFilter === "all" || a.role === accountRoleFilter;
    const matchStatus = accountStatusFilter === "all" || a.status === accountStatusFilter;
    return matchQ && matchRole && matchStatus;
  });
  const initialOf = (name: string) => (name ? name.trim().charAt(0) : "?");

  // 從 site.settings.pages 和默認頁面清單衍生頁面列表
  useEffect(() => {
    const settings = (site?.settings ?? {}) as Record<string, unknown>;
    const settingsPages = (settings.pages ?? {}) as Record<string, Record<string, unknown>>;

    // Root site uses ROOT_SITE_DEFAULT_PAGES static fallback; child sites start clean (no defaults, only homepage + user-added).
    const defaults = isRootSite ? ROOT_SITE_DEFAULT_PAGES : {};

    // Merge: defaults + any settings.pages keys
    const allKeys = new Set([...Object.keys(defaults), ...Object.keys(settingsPages)]);
    // Every site has a homepage, so every site's page list shows a row for it.
    // This was added for child sites only, which left the group site's page
    // management with no way in to its own front page — the one page an editor
    // reaches for most.
    allKeys.add("homepage");
    // Filter out tombstoned (deleted) entries — applies to defaults that user removed
    const merged = Array.from(allKeys).filter((key) => settingsPages[key]?.deleted !== true).map((key) => {
      const def = (defaults as Record<string, any>)[key];
      const cfg = settingsPages[key] as Record<string, unknown> | undefined;

      /* The label is kept on the row, not just the name resolved from it, so
         the language switch below can re-resolve without rebuilding the array
         — which is what used to throw away an unsaved reorder. */
      const labelSource = cfg?.label ?? def?.label;
      const name = pageDisplayName(key, labelSource, editLocale);

      // Sort order
      const sortOrder = typeof cfg?.sort_order === "number" ? cfg.sort_order : (def?.sort_order ?? 99);

      const showInNav = cfg?.nav_hidden !== true;
      const showInFooter = cfg?.footer_hidden !== true;

      // Resolve page type for badge display
      const pageType = cfg?.page_type ?? def?.page_type ?? "blocks";

      return {
        id: `settings-${key}`,
        name,
        labelSource,
        slug: key === "homepage" ? "/" : key,
        visible: showInNav || showInFooter,
        showInNav,
        showInFooter,
        type: key,
        sortOrder,
        pageType,
      };
    });

    merged.sort((a, b) => a.sortOrder - b.sortOrder);
    setPages(merged);
    /* `editLocale` is deliberately NOT a dependency. It used to be, and because
       this effect rebuilds the whole array from `site.settings` — a prop that
       does not refresh after the auto-saves below — switching language reverted
       every local change the effect cannot see: a drag reorder went back to the
       old sort_order, a Nav/Footer tick went back to its saved value, a rename
       went back to its saved label. The database already held the new values,
       so the screen and the data disagreed and nothing said so. The language
       switch is the effect below, which touches names only. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sitePages, site, isRootSite]);

  /* Language switch: re-resolve the names in place, and nothing else. */
  useEffect(() => {
    setPages((prev) => relabelPages(prev, editLocale));
  }, [editLocale]);

  const readOnly = site?._can_edit === false;

  return (
    <>
      {/* 語言切換 */}
      <div className="se-locale-bar">
        <Segmented
          ariaLabel={editLocale === "zh" ? "編輯語言" : "Editing language"}
          onChange={setEditLocale}
          options={[{ value: "zh", label: "中文", title: "繁體中文" }, { value: "en", label: "English", title: "English" }]}
          size="sm"
          value={editLocale}
        />
      </div>

      {readOnly && (
        <div role="status">
          <Callout tone="warning">
            {editLocale === "zh"
            ? "唯讀模式：此網站不在你的可編輯範圍。可瀏覽設定與內容，但無法儲存變更。"
            : "Read-only: this site is outside your edit scope. You can browse the config but not save changes."}
          </Callout>
        </div>
      )}

      <SafeForm
        className={`se-shell${readOnly ? " is-readonly" : ""}`}
        style={tab === 1 || tab === 2 ? { gridTemplateColumns: "1fr" } : undefined}
        action={wrappedAction}
        formRef={attachForm}
        onBeforeSubmit={stashDraft}
      >
        {/* Real submission lockout: a disabled <fieldset> excludes every
            descendant control from the FormData and prevents Enter-to-submit
            from any input inside it. CSS .is-readonly adds visual greying. */}
        {readOnly && <input type="hidden" name="_readonly_blocked" value="1" />}
        <fieldset
          disabled={readOnly}
          style={{ all: "unset", display: "contents" }}
        >
        <input type="hidden" name="return_to" value={returnTo} />
        <input type="hidden" name="_existing_settings_json" value={JSON.stringify((() => {
          const base = { ...(site?.settings ?? {}) } as Record<string, unknown>;
          const existingPages = { ...((base.pages ?? {}) as Record<string, Record<string, unknown>>) };

          // 1. Apply slug renames: copy data from old key to new key, delete old key
          for (const [oldSlug, newSlug] of Object.entries(pageSlugRenames)) {
            if (oldSlug !== newSlug && existingPages[oldSlug]) {
              existingPages[newSlug] = { ...existingPages[oldSlug] };
              delete existingPages[oldSlug];
            }
          }

          // 2. Apply label / config overrides from modal edits
          for (const [key, overrides] of Object.entries(pageSettingsOverrides)) {
            existingPages[key] = { ...(existingPages[key] ?? {}), ...overrides };
          }

          // 3. Update nav references for renamed slugs
          if (Object.keys(pageSlugRenames).length > 0 && Array.isArray(base.nav)) {
            base.nav = (base.nav as Array<Record<string, unknown>>).map((item) => {
              const itemKey = item.key as string | undefined;
              if (itemKey && pageSlugRenames[itemKey]) {
                return { ...item, key: pageSlugRenames[itemKey] };
              }
              return item;
            });
          }

          // "homepage" is a display-only row (the site root) — strip it so a stale
          // snapshot never re-writes it into settings.pages (→ dead /homepage nav).
          delete existingPages.homepage;
          base.pages = existingPages;
          return base;
        })())} />
        <input type="hidden" name="_name_translations_json" value={JSON.stringify(nameTranslations)} />

        <section className="admin-card admin-compact-form">
        {/* 閃現訊息 — key 以 nonce 強制每次儲存後重新掛載 */}
        {flash?.notice && (
          <AdminFlash
            key={`notice-${flash.nonce ?? flash.notice}`}
            closeLabel={currentCopy.admin.adminFlashClose}
            message={flash.notice}
            title={currentCopy.admin.adminFlashSuccess}
            tone="success"
            nonce={flash.nonce}
          />
        )}
        {flash?.error && (
          <AdminFlash
            key={`error-${flash.nonce ?? flash.error}`}
            closeLabel={currentCopy.admin.adminFlashClose}
            message={flash.error}
            title={currentCopy.admin.adminFlashError}
            tone="error"
            nonce={flash.nonce}
          />
        )}
        {/* Silent recovery would be indistinguishable from the save having
            worked, which is the thing that must not be ambiguous here. */}
        {draftRecovered && (
          <AdminFlash
            key="draft-recovered"
            closeLabel={currentCopy.admin.adminFlashClose}
            message={editLocale === "zh"
              ? "儲存失敗，已還原你未儲存的修改。請修正上方錯誤後再存一次。"
              : "The save failed. Your unsaved changes have been restored — fix the error above and save again."}
            title={editLocale === "zh" ? "已還原草稿" : "Draft restored"}
            tone="success"
          />
        )}
        {/* 本地 toast（modal 儲存成功等客戶端動作） */}
        {localFlash && (
          <AdminFlash
            key={`local-${localFlash.id}`}
            closeLabel={currentCopy.admin.adminFlashClose}
            message={localFlash.message}
            title={localFlash.tone === "error" ? currentCopy.admin.adminFlashError : currentCopy.admin.adminFlashSuccess}
            tone={localFlash.tone}
          />
        )}

        {/* 橫向標籤頁導航 */}
        <Segmented
          ariaLabel={editLocale === "zh" ? "網站設定分頁" : "Site settings sections"}
          className="se-kit-tabs"
          onChange={(value) => setTab(Number(value))}
          options={tabs.map((t, i) => ({
            value: String(i),
            label: `${t.num}. ${t.label}`,
            icon: t.warn ? <AlertCircle className="a-icon--warning" /> : undefined
          }))}
          size="tabs"
          value={String(tab)}
        />

        {/* Tab 1: 基本資料 — 永遠保留在 DOM 內，否則切到其他分頁儲存會清空欄位 */}
        <div className="se-panel" style={{ display: tab === 0 ? undefined : "none" }}>
          {/* 保留後端期望但表單未顯示的欄位 */}
          <input type="hidden" name="domain" defaultValue={site?.domain ?? ""} />
          <input type="hidden" name="parent_site_id" defaultValue={String(site?.parent_site_id ?? "")} />
          <input type="hidden" name="template_site_id" defaultValue={String((site as any)?.template_site_id ?? "")} />
          <input type="hidden" name="template_version" defaultValue={String((site as any)?.template_version ?? "v1")} />
          {/* The one field missing from this list. sitePayload reads
              `is_template === "on"`, so with no field to read it wrote `false`
              on every save of every tab: opening a 模板 site, changing a colour
              and saving quietly demoted it — it lost its 模板 badge and its
              place at the top of the site list, /admin/sites/new stopped
              offering it as a template, and sitemap.ts began handing it to
              crawlers. Every other write path (homepageActions,
              propertyPagesActions, updatePageSettingsAction) already carries
              the stored value forward; this one now does too. */}
          {site?.is_template && <input type="hidden" name="is_template" value="on" />}
          <div className="admin-compact-form">
              {/* Section 1: Site Identity (Name, Slug, Logo, Domain, Status) */}
              <section className="admin-card a-u-mb-20">
                <div className="a-u-mb-16">
                  <h3 className="a-u-subhead">
                    {editLocale === "zh" ? "網站識別" : "Site Identity"}
                  </h3>
                  <p className="a-u-note">
                    {editLocale === "zh" ? "設定網站名稱、Slug、Logo 與基本資訊" : "Configure site name, slug, logo, and basic settings"}
                  </p>
                </div>
                <div className="form-grid compact">
                  <label>
                    <span className="required-label">{editLocale === "zh" ? "網站名稱" : "Site Name"} ({editLocale === "zh" ? "中文" : "EN"})</span>
                    <input
                      value={nameTranslations[editLocale] ?? ""}
                      onChange={(e) => setNameTranslations({ ...nameTranslations, [editLocale]: e.target.value })}
                      placeholder={editLocale === "zh" ? "例如：宜蘭度假" : "e.g., Select Yilan"}
                      required
                    />
                    <input type="hidden" name="name" value={nameTranslations.zh || nameTranslations.en || site?.name || ""} />
                  </label>
                  <label>
                    <span className="required-label">{editLocale === "zh" ? "Slug" : "Slug"}</span>
                    <input
                      name="slug"
                      defaultValue={site?.slug ?? ""}
                      placeholder={editLocale === "zh" ? "select-yilan" : "select-yilan"}
                      pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                      required
                    />
                  </label>
                  <label>
                    <span>{editLocale === "zh" ? "狀態" : "Status"}</span>
                    <select name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
                      <option value="active">{statusLabels.active}</option>
                      <option value="draft">{statusLabels.draft}</option>
                      <option value="archived">{statusLabels.archived}</option>
                    </select>
                  </label>
                  <label>
                    <span>{editLocale === "zh" ? "預設語言" : "Default Locale"}</span>
                    <select name="default_locale" defaultValue={site?.default_locale ?? "zh"}>
                      <option value="zh">{editLocale === "zh" ? "繁體中文" : "Traditional Chinese"}</option>
                      <option value="en">{editLocale === "zh" ? "English" : "English"}</option>
                    </select>
                  </label>
                  <div style={{ gridColumn: "1 / -1", display: "grid", gap: "7px" }}>
                    <span style={{
                      color: "var(--muted)",
                      fontFamily: "var(--font-ui)",
                      fontSize: "12px",
                      fontWeight: "700",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase"
                    }}>
                      {editLocale === "zh" ? "Logo 圖片" : "Logo Image"}
                    </span>
                    <HeroImageField
                      defaultValue={String(site?.settings?.logo_url ?? "")}
                      fieldName="logo_url"
                      mediaKind="logo"
                      labels={{
                        added: currentCopy.admin.adminAddedToMedia,
                        failed: currentCopy.admin.adminUploadFailed,
                        imageUrl: editLocale === "zh" ? "圖片網址" : "Image URL",
                        loadingLibrary: currentCopy.admin.adminLoadingLibrary,
                        noLibraryImages: currentCopy.admin.adminNoLibraryImages,
                        selectFromLibrary: editLocale === "zh" ? "從媒體庫選擇" : "Select from media library",
                        useThisImage: currentCopy.admin.adminUseThisImage,
                        upload: editLocale === "zh" ? "從本機上傳" : "Upload from computer",
                        uploading: currentCopy.admin.adminUploading,
                        searchPlaceholder: editLocale === "zh" ? "搜尋..." : "Search..."
                      }}
                    />
                    <label className="a-u-row-mid a-u-mt-10 a-u-fs-13 a-u-pointer">
                      <input className="a-u-check"
                        type="checkbox"
                        name="header_logo_only"
                        defaultChecked={Boolean((site?.settings as any)?.header_logo_only)}
                      />
                      <span>{editLocale === "zh" ? "只顯示 Logo，隱藏網站名稱（網頁標題不受影響）" : "Show logo only, hide site name (page title unaffected)"}</span>
                    </label>
                    <label className="a-u-row-mid a-u-mt-10 a-u-fs-13 a-u-pointer">
                      <input className="a-u-check"
                        type="checkbox"
                        name="header_auto_hide"
                        defaultChecked={Boolean((site?.settings as any)?.header_auto_hide)}
                      />
                      <span>{editLocale === "zh" ? "向下捲動時隱藏導覽列（預設一直顯示）" : "Hide the nav bar on scroll down (default: always visible)"}</span>
                    </label>
                  </div>
                </div>
              </section>

              {/* Section 3: Color Theme */}
              <section className="admin-card a-u-mb-20">
                <div className="a-u-mb-16">
                  <h3 className="a-u-subhead">
                    {editLocale === "zh" ? "主題顏色" : "Theme Colors"}
                  </h3>
                  <p className="a-u-note">
                    {editLocale === "zh" ? "基礎色和各區域細分配色" : "Base colors and per-region overrides"}
                  </p>
                </div>
                {/* Base colors */}
                <p style={{ fontSize: "13px", fontWeight: 600, margin: "0 0 8px", color: "var(--ink)" }}>
                  {editLocale === "zh" ? "基礎配色" : "Base Colors"}
                </p>
                {/* The `name` sits on the TEXT box, as it does on every other
                    colour row here. It used to sit on the swatch, and these two
                    were the only rows where it did: `<input type="color">`
                    cannot hold anything but a hex, so a client who typed
                    `transparent` or `rgba(…)` into the box beside it — which the
                    nav / footer / button rows accept, and whose help text
                    promises — submitted #000000 instead, from a swatch that had
                    silently coerced the value it could not represent. The
                    swatch is now an unnamed picker for the text box, like its
                    siblings. */}
                <div className="form-grid compact">
                  <label>
                    <span>{editLocale === "zh" ? "主色" : "Primary"}</span>
                    <div className="a-u-row">
                      <input className="a-u-swatch" type="color" aria-label={editLocale === "zh" ? "主色（色票）" : "Primary (swatch)"} value={swatchValue(primaryColor, DEFAULT_PRIMARY_COLOR)} onChange={(e) => setPrimaryColor(e.target.value)} />
                      <input className="a-u-grow" type="text" name="primary_color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder={DEFAULT_PRIMARY_COLOR} />
                    </div>
                  </label>
                  <label>
                    <span>{editLocale === "zh" ? "強調色" : "Accent"}</span>
                    <div className="a-u-row">
                      <input className="a-u-swatch" type="color" aria-label={editLocale === "zh" ? "強調色（色票）" : "Accent (swatch)"} value={swatchValue(accentColor, DEFAULT_ACCENT_COLOR)} onChange={(e) => setAccentColor(e.target.value)} />
                      <input className="a-u-grow" type="text" name="accent_color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} placeholder={DEFAULT_ACCENT_COLOR} />
                    </div>
                  </label>
                </div>
                <p className="a-u-hint a-u-hint-below a-u-lh-16">
                  {editLocale === "zh"
                    ? "色碼、rgb()、rgba()、transparent 都接受；留空＝使用預設色。左側色票只能表示純色碼，填了其他寫法它會顯示黑色，以右邊的文字為準。"
                    : "Hex, rgb(), rgba() and transparent are all accepted; blank means the default. The swatch can only show a plain hex — with anything else it reads black, and the text box is what counts."}
                </p>
                {/* Page background */}
                <div className="a-u-row-heading">
                  <p className="a-u-label-strong">
                    {editLocale === "zh" ? "頁面背景" : "Page background"}
                  </p>
                  {pageBg && (
                    <button type="button" onClick={() => setPageBg("")} className={buttonClass({ variant: "ghost", size: "sm" })}>
                      {editLocale === "zh" ? "重置" : "Reset"}
                    </button>
                  )}
                </div>
                <div className="form-grid compact">
                  <label className="a-u-span">
                    <span>{editLocale === "zh" ? "全站背景色（區塊背景可局部覆蓋）" : "Site background (block bg overrides locally)"}</span>
                    <div className="a-u-row">
                      <input className="a-u-swatch" type="color" value={pageBg || "#f7f5ef"} onChange={(e) => setPageBg(e.target.value)} />
                      <input className="a-u-grow" type="text" name="page_bg" value={pageBg} onChange={(e) => setPageBg(e.target.value)} placeholder={editLocale === "zh" ? "預設暖白 #f7f5ef" : "Default #f7f5ef"} />
                    </div>
                  </label>
                </div>
                {/* Nav / Menu */}
                <div className="a-u-row-heading">
                  <p className="a-u-label-strong">
                    {editLocale === "zh" ? "導航列 / 選單" : "Nav / Menu"}
                  </p>
                  {(navBg || navText) && (
                    <button type="button" onClick={() => { setNavBg(""); setNavText(""); }} className={buttonClass({ variant: "ghost", size: "sm" })}>
                      {editLocale === "zh" ? "重置" : "Reset"}
                    </button>
                  )}
                </div>
                <div className="form-grid compact">
                  <label>
                    <span>{editLocale === "zh" ? "背景" : "Background"}</span>
                    <div className="a-u-row">
                      <input className="a-u-swatch" type="color" value={navBg || primaryColor} onChange={(e) => setNavBg(e.target.value)} />
                      <input className="a-u-grow" type="text" name="nav_bg" value={navBg} onChange={(e) => setNavBg(e.target.value)} placeholder={editLocale === "zh" ? "沿用主色" : "Inherit primary"} />
                    </div>
                  </label>
                  <label>
                    <span>{editLocale === "zh" ? "文字" : "Text"}</span>
                    <div className="a-u-row">
                      <input className="a-u-swatch" type="color" value={navText || "#ffffff"} onChange={(e) => setNavText(e.target.value)} />
                      <input className="a-u-grow" type="text" name="nav_text" value={navText} onChange={(e) => setNavText(e.target.value)} placeholder="#ffffff" />
                    </div>
                  </label>
                </div>
                <p className="a-u-hint a-u-hint-below a-u-lh-16">
                  {editLocale === "zh"
                    ? "留空＝沿用原本的設計（頁首在大圖上是透明的）。要固定成透明也可以直接填 transparent；色碼、rgb()、rgba() 都接受。"
                    : "Blank keeps the original design (the header is transparent over the hero). You can also type transparent; hex, rgb() and rgba() are accepted."}
                </p>
                {/* Footer */}
                <div className="a-u-row-heading">
                  <p className="a-u-label-strong">
                    {editLocale === "zh" ? "頁尾" : "Footer"}
                  </p>
                  {(footerBg || footerText) && (
                    <button type="button" onClick={() => { setFooterBg(""); setFooterText(""); }} className={buttonClass({ variant: "ghost", size: "sm" })}>
                      {editLocale === "zh" ? "重置" : "Reset"}
                    </button>
                  )}
                </div>
                <div className="form-grid compact">
                  <label>
                    <span>{editLocale === "zh" ? "背景" : "Background"}</span>
                    <div className="a-u-row">
                      <input className="a-u-swatch" type="color" value={footerBg || primaryColor} onChange={(e) => setFooterBg(e.target.value)} />
                      <input className="a-u-grow" type="text" name="footer_bg" value={footerBg} onChange={(e) => setFooterBg(e.target.value)} placeholder={editLocale === "zh" ? "沿用主色" : "Inherit primary"} />
                    </div>
                  </label>
                  <label>
                    <span>{editLocale === "zh" ? "文字" : "Text"}</span>
                    <div className="a-u-row">
                      <input className="a-u-swatch" type="color" value={footerText || "#ffffff"} onChange={(e) => setFooterText(e.target.value)} />
                      <input className="a-u-grow" type="text" name="footer_text" value={footerText} onChange={(e) => setFooterText(e.target.value)} placeholder="#ffffff" />
                    </div>
                  </label>
                </div>
                {/* 頁尾法律聲明已移至「進階 / 法規」分頁，與 GA / Cookie / GDPR 同區。 */}
                {/* Buttons.
                    Named 「按鈕」 with no qualification, this read as "the colour
                    of the buttons on my site" and on the group site it moves
                    almost nothing: measured on the parent homepage and /contact,
                    --button-bg reaches one element (the footer 訂閱 button, and
                    only because 頁尾按鈕背景 is blank and falls back to it) and
                    --button-text reaches none. The ordinary `.button` is
                    deliberately excluded — see the note above `.header-book` in
                    globals.css (客戶: 按鈕要還原) — and the nav and footer
                    buttons have their own settings below, which win.
                    The exclusion stays; the heading and the hint say what is
                    left, on both kinds of site. */}
                <div className="a-u-row-heading">
                  <p className="a-u-label-strong">
                    {editLocale === "zh" ? "按鈕（預設色）" : "Buttons (default)"}
                  </p>
                  {(buttonBg || buttonText) && (
                    <button type="button" onClick={() => { setButtonBg(""); setButtonText(""); }} className={buttonClass({ variant: "ghost", size: "sm" })}>
                      {editLocale === "zh" ? "重置" : "Reset"}
                    </button>
                  )}
                </div>
                <div className="form-grid compact">
                  <label>
                    <span>{editLocale === "zh" ? "背景" : "Background"}</span>
                    <div className="a-u-row">
                      <input className="a-u-swatch" type="color" value={buttonBg || accentColor} onChange={(e) => setButtonBg(e.target.value)} />
                      <input className="a-u-grow" type="text" name="button_bg" value={buttonBg} onChange={(e) => setButtonBg(e.target.value)} placeholder={editLocale === "zh" ? "沿用強調色" : "Inherit accent"} />
                    </div>
                  </label>
                  <label>
                    <span>{editLocale === "zh" ? "文字" : "Text"}</span>
                    <div className="a-u-row">
                      <input className="a-u-swatch" type="color" value={buttonText || "#ffffff"} onChange={(e) => setButtonText(e.target.value)} />
                      <input className="a-u-grow" type="text" name="button_text" value={buttonText} onChange={(e) => setButtonText(e.target.value)} placeholder="#ffffff" />
                    </div>
                  </label>
                </div>
                <p style={{ fontSize: "12px", color: "var(--muted)", margin: "8px 0 0", lineHeight: 1.6 }}>
                  {editLocale === "zh"
                    ? "只有「訂閱」按鈕會用到這兩個顏色：頁尾的訂閱鈕，以及頁面上的訂閱區塊（聯絡頁的訂閱區塊有自己的配色，不受影響）。民宿站台還會套用到導覽列的「立即預約」。下面的「導覽列按鈕」「頁尾按鈕」有填就以它們為準。內文中一般的按鈕維持主題原色，不會跟著改。"
                    : "Only the subscribe buttons use these two colours: the one in the footer and the one in a 訂閱 block (the contact page's band has a palette of its own and is unaffected). On a villa site they also reach the header 立即預約 button. 導覽列按鈕 and 頁尾按鈕 below win wherever they are filled in. Ordinary buttons in the page body keep the theme's own colours."}
                </p>
                <p className="a-u-label-strong a-u-label-gap">
                  {editLocale === "zh" ? "導覽列按鈕（立即預約）" : "Header button (Reserve)"}
                </p>
                {/* Wording and destination, not only colour. Both have been read
                    from settings.booking since the header was written and
                    neither had a field, so changing either meant editing the
                    database (客戶: 未來直接連到正式訂房系統，「立即預約」可改為
                    「立即訂房」). Left blank, the button keeps its built-in
                    wording and falls back to LINE, then phone, then the villa's
                    contact page — exactly as it does today. */}
                <div className="form-grid compact">
                  <label>
                    <span>{editLocale === "zh" ? "按鈕文字（中文）" : "Button label (Chinese)"}</span>
                    <input
                      type="text"
                      name="booking_cta_label_zh"
                      defaultValue={String(bookingCfg.zh ?? "")}
                      placeholder={editLocale === "zh" ? "立即預約" : "立即預約"}
                    />
                  </label>
                  <label>
                    <span>{editLocale === "zh" ? "按鈕文字（英文）" : "Button label (English)"}</span>
                    <input
                      type="text"
                      name="booking_cta_label_en"
                      defaultValue={String(bookingCfg.en ?? "")}
                      placeholder="Book Now"
                    />
                  </label>
                </div>
                <label style={{ display: "block", marginTop: "8px" }}>
                  <span>{editLocale === "zh" ? "按鈕連結" : "Button link"}</span>
                  <input
                    type="text"
                    name="booking_cta_href"
                    defaultValue={String(bookingCfg.href ?? "")}
                    placeholder="https://booking.example.com"
                  />
                  <small className="a-u-hint-12">
                    {editLocale === "zh"
                      ? "填入訂房系統網址即可直接連過去；留空則依序使用 LINE、電話、民宿聯絡頁。"
                      : "A booking-system URL sends guests straight there; blank falls back to LINE, then phone, then the villa's contact page."}
                  </small>
                </label>
                <div className="form-grid compact" style={{ marginTop: "12px" }}>
                  <label>
                    <span>{editLocale === "zh" ? "背景" : "Background"}</span>
                    <div className="a-u-row">
                      <input className="a-u-swatch" type="color" value={navButtonBg || primaryColor} onChange={(e) => setNavButtonBg(e.target.value)} />
                      <input className="a-u-grow" type="text" name="nav_button_bg" value={navButtonBg} onChange={(e) => setNavButtonBg(e.target.value)} placeholder={editLocale === "zh" ? "沿用主色" : "Inherit"} />
                    </div>
                  </label>
                  <label>
                    <span>{editLocale === "zh" ? "文字" : "Text"}</span>
                    <div className="a-u-row">
                      <input className="a-u-swatch" type="color" value={navButtonText || "#ffffff"} onChange={(e) => setNavButtonText(e.target.value)} />
                      <input className="a-u-grow" type="text" name="nav_button_text" value={navButtonText} onChange={(e) => setNavButtonText(e.target.value)} placeholder="#ffffff" />
                    </div>
                  </label>
                </div>
                <p className="a-u-label-strong a-u-label-gap">
                  {editLocale === "zh" ? "頁尾按鈕（訂閱）" : "Footer button (Subscribe)"}
                </p>
                <div className="form-grid compact">
                  <label>
                    <span>{editLocale === "zh" ? "背景" : "Background"}</span>
                    <div className="a-u-row">
                      <input className="a-u-swatch" type="color" value={footerButtonBg || (buttonBg || accentColor)} onChange={(e) => setFooterButtonBg(e.target.value)} />
                      <input className="a-u-grow" type="text" name="footer_button_bg" value={footerButtonBg} onChange={(e) => setFooterButtonBg(e.target.value)} placeholder={editLocale === "zh" ? "沿用按鈕色" : "Inherit"} />
                    </div>
                  </label>
                  <label>
                    <span>{editLocale === "zh" ? "文字" : "Text"}</span>
                    <div className="a-u-row">
                      <input className="a-u-swatch" type="color" value={footerButtonText || "#ffffff"} onChange={(e) => setFooterButtonText(e.target.value)} />
                      <input className="a-u-grow" type="text" name="footer_button_text" value={footerButtonText} onChange={(e) => setFooterButtonText(e.target.value)} placeholder="#ffffff" />
                    </div>
                  </label>
                </div>
              </section>

              {/* Section 4: Contact Info */}
              <section className="admin-card">
                <div className="a-u-mb-16">
                  <h3 className="a-u-subhead">
                    {editLocale === "zh" ? "聯繫方式" : "Contact Information"}
                  </h3>
                  <p className="a-u-note">
                    {editLocale === "zh" ? "設定網站聯絡資訊和社群鏈接" : "Configure contact details and social links"}
                  </p>
                </div>
                <div className="form-grid compact">
                  <label>
                    <span>{editLocale === "zh" ? "聯絡郵箱" : "Contact Email"}</span>
                    <input type="email" name="contact_email" defaultValue={String(site?.contact_config?.email ?? site?.settings?.contact_email ?? "")} placeholder="hello@example.com" />
                  </label>
                  <label>
                    <span>{editLocale === "zh" ? "聯絡電話" : "Contact Phone"}</span>
                    <input type="tel" name="contact_phone" defaultValue={String(site?.settings?.contact_phone ?? "")} placeholder="+886 123 456 789" />
                  </label>
                  <label>
                    <span>LINE ID</span>
                    <input type="text" name="contact_line" defaultValue={String(site?.contact_config?.line ?? site?.settings?.contact_line ?? "")} placeholder="@example" />
                  </label>
                  <label className="a-u-span">
                    <span>{editLocale === "zh" ? "社群鏈接" : "Social Links"}</span>
                  </label>
                  <label>
                    <span>Instagram</span>
                    <input type="url" name="social_instagram" defaultValue={String(site?.settings?.social_instagram ?? "")} placeholder="https://instagram.com/..." />
                  </label>
                  <label>
                    <span>Facebook</span>
                    <input type="url" name="social_facebook" defaultValue={String(site?.settings?.social_facebook ?? "")} placeholder="https://facebook.com/..." />
                  </label>
                  <label>
                    <span>Threads</span>
                    <input type="url" name="social_threads" defaultValue={String(site?.settings?.social_threads ?? "")} placeholder="https://www.threads.net/@..." />
                  </label>
                  <label>
                    <span>TikTok</span>
                    <input type="url" name="social_tiktok" defaultValue={String(site?.settings?.social_tiktok ?? "")} placeholder="https://www.tiktok.com/@..." />
                  </label>
                </div>
              </section>
            </div>
        </div>

        {/* Tab 3: 權限管理 — 帳戶表格 */}
        {tab === 2 && (
          <div className="se-panel a-u-full-width">
            <div className="a-u-full-width">
              {/* Header + actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "18px", flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", fontWeight: "600" }}>
                    {editLocale === "zh" ? "帳戶權限" : "Account Permissions"}
                  </h3>
                  <p className="a-u-note">
                    {editLocale === "zh" ? "管理此網站的帳戶、角色與存取狀態" : "Manage accounts, roles, and access for this site"}
                  </p>
                </div>
                <div className="a-u-row">
                  <button
                    type="button"
                    onClick={() => {
                      const header = ["id", "name", "email", "role", "status"];
                      const rows = filteredAccounts.map((a) => [a.id, a.name, a.email, a.role, a.status]);
                      const csv = [header, ...rows]
                        .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
                        .join("\n");
                      // BOM for Excel UTF-8
                      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = `${site.slug || "site"}-accounts.csv`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(url);
                    }}
                    className={buttonClass({})}
                  >
                    {editLocale === "zh" ? "匯出清單" : "Export"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAccountId(null);
                      setAccountForm({ user_id: "", name: "", email: "", role: "editor" });
                      setShowAccountModal(true);
                    }}
                    className={buttonClass({ variant: "primary" })}
                  >
                    + {editLocale === "zh" ? "新增帳戶" : "New Account"}
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
                <input
                  type="text"
                  value={accountSearch}
                  onChange={(e) => setAccountSearch(e.target.value)}
                  placeholder={editLocale === "zh" ? "搜尋帳號、姓名或電子郵件…" : "Search account, name, or email…"}
                  style={{ flex: "1 1 240px", minWidth: "200px", width: "auto", padding: "9px 12px", borderRadius: "6px", border: "1px solid var(--line)", fontSize: "13px", boxSizing: "border-box" }}
                />
                <select
                  value={accountRoleFilter}
                  onChange={(e) => setAccountRoleFilter(e.target.value)}
                  style={{ flex: "0 0 auto", width: "160px", padding: "9px 12px", borderRadius: "6px", border: "1px solid var(--line)", fontSize: "13px" }}
                >
                  <option value="all">{editLocale === "zh" ? "所有角色" : "All roles"}</option>
                  {Object.entries(ROLE_DEFS).map(([k, v]) => (
                    <option key={k} value={k}>{editLocale === "zh" ? v.zh : v.en}</option>
                  ))}
                </select>
                <select
                  value={accountStatusFilter}
                  onChange={(e) => setAccountStatusFilter(e.target.value)}
                  style={{ flex: "0 0 auto", width: "140px", padding: "9px 12px", borderRadius: "6px", border: "1px solid var(--line)", fontSize: "13px" }}
                >
                  <option value="all">{editLocale === "zh" ? "所有狀態" : "All statuses"}</option>
                  {Object.entries(STATUS_DEFS).map(([k, v]) => (
                    <option key={k} value={k}>{editLocale === "zh" ? v.zh : v.en}</option>
                  ))}
                </select>
              </div>

              {/* Table */}
              <TableFrame>
                <table className="a-table">
                  <thead>
                    <tr>
                      {[
                        editLocale === "zh" ? "姓名" : "Name",
                        editLocale === "zh" ? "電子郵件" : "Email",
                        editLocale === "zh" ? "角色" : "Role",
                        editLocale === "zh" ? "狀態" : "Status",
                      ].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                      <th className="is-shrink a-u-right">{editLocale === "zh" ? "操作" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAccounts.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: "40px 20px", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
                          {accounts.length === 0
                            ? (editLocale === "zh" ? "此網站尚無帳戶，點擊右上「新增帳戶」邀請使用者" : "No accounts yet. Click \"New Account\" to invite a user.")
                            : (editLocale === "zh" ? "沒有符合條件的帳戶" : "No accounts match your filters")}
                        </td>
                      </tr>
                    ) : (
                      filteredAccounts.map((a) => {
                        const role = ROLE_DEFS[a.role] ?? { ...roleFallback, zh: a.role, en: a.role };
                        const st = STATUS_DEFS[a.status] ?? { zh: a.status, en: a.status, dot: "#b9b3aa", ink: "#857f76" };
                        return (
                          <tr key={a.id}>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <span style={{
                                  width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0,
                                  backgroundColor: role.tint, color: role.ink,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: "13px", fontWeight: "700"
                                }}>{initialOf(a.name)}</span>
                                <span style={{ fontSize: "13px", fontWeight: "500" }}>{a.name}</span>
                              </div>
                            </td>
                            <td className="a-field__hint">{a.email}</td>
                            <td>
                              <span style={{ backgroundColor: role.tint, color: role.ink, padding: "3px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: "700", whiteSpace: "nowrap" }}>
                                {editLocale === "zh" ? role.zh : role.en}
                              </span>
                            </td>
                            <td>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "600", color: st.ink }}>
                                <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: st.dot, display: "inline-block" }} />
                                {editLocale === "zh" ? st.zh : st.en}
                              </span>
                            </td>
                            <td className="is-shrink a-u-right">
                              <button
                                type="button"
                                className={buttonClass({ size: "sm" })}
                                onClick={() => {
                                  setEditingAccountId(a.id);
                                  setAccountForm({ user_id: String(a.id), name: a.name, email: a.email, role: a.role });
                                  setShowAccountModal(true);
                                }}
                              >
                                {editLocale === "zh" ? "編輯角色" : "Edit Role"}
                              </button>{" "}
                              <button
                                type="button"
                                className={buttonClass({ variant: "danger-ghost", size: "sm" })}
                                disabled={false}
                                onClick={async () => {
                                  if (!(await ask({ tone: "danger", title: editLocale === "zh"
                                      ? `從此網站刪除「${a.name}」嗎？\n（使用者帳戶會保留在「系統 → 帳號權限」中。）`
                                      : `Delete "${a.name}" from this site?\n(The user account stays in System → Users.)` }))) return;
                                  try {
                                    await removeSiteUserAction(siteId, String(a.id));
                                    router.refresh();
                                    showLocalFlash("success", editLocale === "zh" ? `已刪除「${a.name}」` : `Removed "${a.name}"`);
                                  } catch (err: any) {
                                    if (err?.digest?.startsWith?.("NEXT_REDIRECT")) {
                                      router.refresh();
                                      showLocalFlash("success", editLocale === "zh" ? `已刪除「${a.name}」` : `Removed "${a.name}"`);
                                      return;
                                    }
                                    console.error("Remove user error:", err);
                                    showLocalFlash("error", editLocale === "zh" ? "刪除失敗" : "Delete failed");
                                  }
                                }}
                                style={undefined}
                              >
                                {editLocale === "zh" ? "刪除" : "Delete"}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </TableFrame>

              {/* Footer / pagination */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px", flexWrap: "wrap", gap: "8px" }}>
                <span className="a-u-hint-12">
                  {editLocale === "zh" ? `共 ${filteredAccounts.length} 筆帳戶` : `${filteredAccounts.length} accounts`}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="a-u-hint-12">{editLocale === "zh" ? "每頁 20 筆" : "20 / page"}</span>
                  <button type="button" disabled className={buttonClass({ size: "sm" })}>
                    {editLocale === "zh" ? "上一頁" : "Prev"}
                  </button>
                  <button type="button" disabled className={buttonClass({ size: "sm" })}>
                    {editLocale === "zh" ? "下一頁" : "Next"}
                  </button>
                </div>
              </div>
            </div>

            {/* Account modal — Portal 出 form 外，避免任何冒泡/驗證副作用
                (into the admin shell, so the kit's tokens still apply) */}
            {portalReady && createPortal(
              <Dialog
                dismissible={false}
                onClose={() => setShowAccountModal(false)}
                open={showAccountModal}
                title={editingAccountId
                  ? (editLocale === "zh" ? "編輯角色" : "Edit Role")
                  : (editLocale === "zh" ? "新增帳戶" : "Add Account to Site")}
                description={<>
                    {editingAccountId
                      ? editLocale === "zh"
                        ? "變更此使用者在本網站的角色。姓名與電子郵件需在「系統 → 帳號權限」修改。"
                        : "Change this user's role for this site. Name and email can only be edited in System → Users."
                      : editLocale === "zh"
                        ? "從既有帳號中挑選並加入此網站。沒看到要找的人？"
                        : "Pick an existing account to add to this site. Don't see them?"}
                    {!editingAccountId && (
                      <>
                        {" "}
                        <Link href="/admin/users">
                          {editLocale === "zh" ? "前往帳號權限新增" : "Create one in Users"}
                        </Link>
                        。
                      </>
                    )}
                </>}
              >
                <Stack>
                    {!editingAccountId && (
                      <Field label={editLocale === "zh" ? "選擇帳號" : "Select Account"}>
                        {availableUsers.length === 0 ? (
                          <Callout tone="neutral">
                            {editLocale === "zh"
                              ? "所有既有帳號都已在此網站中。請先到「系統 → 帳號權限」建立新使用者。"
                              : "All existing users are already in this site. Create a new user in System → Users first."}
                          </Callout>
                        ) : (
                          <Select
                            value={accountForm.user_id}
                            onChange={(e) => {
                              const id = e.target.value;
                              const u = availableUsers.find((x) => String(x.id) === id);
                              setAccountForm({
                                ...accountForm,
                                user_id: id,
                                name: u?.name ?? "",
                                email: u?.email ?? "",
                              });
                            }}
                          >
                            <option value="">{editLocale === "zh" ? "— 選擇一位使用者 —" : "— Pick a user —"}</option>
                            {availableUsers.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name} · {u.email}
                              </option>
                            ))}
                          </Select>
                        )}
                      </Field>
                    )}
                    {editingAccountId && (
                      <Card>
                        <CellTitle title={accountForm.name} sub={accountForm.email} />
                      </Card>
                    )}
                    <Field label={editLocale === "zh" ? "角色" : "Role"}>
                      <Select
                        value={accountForm.role}
                        onChange={(e) => setAccountForm({ ...accountForm, role: e.target.value })}
                      >
                        {Object.entries(ROLE_DEFS).map(([k, v]) => (
                          <option key={k} value={k}>{editLocale === "zh" ? v.zh : v.en}</option>
                        ))}
                      </Select>
                    </Field>

                  <DialogActions>
                    <button
                      type="button"
                      onClick={() => setShowAccountModal(false)}
                      className={buttonClass({ variant: "ghost" })}
                    >
                      {editLocale === "zh" ? "取消" : "Cancel"}
                    </button>
                    <button
                      type="button"
                      className={buttonClass({ variant: "primary" })}
                      disabled={!editingAccountId && (!accountForm.user_id || availableUsers.length === 0)}
                      onClick={async () => {
                        if (!editingAccountId && !accountForm.user_id) {
                          await tell({ title: editLocale === "zh" ? "請選擇一位使用者" : "Please pick a user" });
                          return;
                        }
                        // 關閉 modal 後再 await — server action 透過 throw NEXT_REDIRECT 觸發
                        // 導航，client-invoke 時 await 不會自然 resolve，所以要先收 UI
                        setShowAccountModal(false);
                        const wasNew = !editingAccountId;
                        const displayName = accountForm.name || accountForm.user_id;
                        try {
                          const fd = new FormData();
                          fd.append("role", accountForm.role);
                          if (editingAccountId) {
                            await updateSiteUserRoleAction(siteId, String(editingAccountId), fd);
                          } else {
                            fd.append("user_id", accountForm.user_id);
                            await addSiteUserAction(siteId, fd);
                          }
                          // NEXT_REDIRECT 在 catch 觸發；reaching here means action returned normally
                          router.refresh();
                          showLocalFlash("success", wasNew
                            ? editLocale === "zh" ? `已加入「${displayName}」` : `Added "${displayName}"`
                            : editLocale === "zh" ? `已更新角色` : `Role updated`);
                        } catch (err: any) {
                          // NEXT_REDIRECT 不算錯誤 — 也要 refresh 抓回最新狀態
                          if (err?.digest?.startsWith?.("NEXT_REDIRECT")) {
                            router.refresh();
                            showLocalFlash("success", wasNew
                              ? editLocale === "zh" ? `已加入「${displayName}」` : `Added "${displayName}"`
                              : editLocale === "zh" ? `已更新角色` : `Role updated`);
                            return;
                          }
                          console.error("Account save error:", err);
                          showLocalFlash("error", editLocale === "zh" ? "操作失敗" : "Operation failed");
                        }
                      }}
                    >
                      {editingAccountId
                        ? (editLocale === "zh" ? "保存角色" : "Save Role")
                        : (editLocale === "zh" ? "加入網站" : "Add to Site")}
                    </button>
                  </DialogActions>
                </Stack>
              </Dialog>,
              document.querySelector(".admin-shell") ?? document.body
            )}
          </div>
        )}

        {/* Tab 2: 頁面管理 */}
        {tab === 1 && (
          <div className="se-panel a-u-full-width">
            <div className="article-placement-preview">
              <h3>{editLocale === "zh" ? "先選擇要更新的內容" : "Choose what to update"}</h3>
              <p>{editLocale === "zh" ? "區塊頁：編輯整頁文字、圖片與版面。文章列表頁：版面在這裡設定，每篇文章到文章工作台編輯。網站名稱、配色與權限在上方分頁。" : "Block pages contain page copy, images and layout. Article listing pages have layout settings here; individual articles are edited in the article workspace. Site identity, colors and access have separate tabs above."}</p>
              <Link className={buttonClass({ size: "sm" })} href="/admin/cms?tab=pages">{editLocale === "zh" ? "前往文章工作台" : "Open article workspace"}</Link>
            </div>
            <div className="a-u-full-width">
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <h3 className="a-u-subhead">
                    {editLocale === "zh" ? "網站頁面" : "Site Pages"}
                  </h3>
                  <p style={{ margin: 0, color: "var(--muted)", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
                    {editLocale === "zh" ? "管理所有頁面、顯示狀態與類型" : "Manage all pages, status, and types"}
                    {savingPages && (
                      <span style={{ fontSize: "11px", color: "var(--accent)", fontWeight: 600 }}>
                        {editLocale === "zh" ? "儲存中…" : "Saving…"}
                      </span>
                    )}
                  </p>
                </div>
                {!pagesReadonly && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPageId(null);
                      setPageForm({ name: "", slug: "" });
                      setShowPageEditModal(true);
                    }}
                    className={buttonClass({ variant: "primary" })}
                  >
                    + {editLocale === "zh" ? "新增頁面" : "New Page"}
                  </button>
                )}
              </div>

              {/* Table */}
              <TableFrame>
                <table className="a-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>{editLocale === "zh" ? "頁面名稱" : "Page Name"}</th>
                      <th>Slug</th>
                      <th>
                        {editLocale === "zh" ? "類型" : "Type"}
                      </th>
                      <th>
                        {editLocale === "zh" ? "導航顯示" : "Nav / Footer"}
                      </th>
                      <th className="a-u-right">{editLocale === "zh" ? "操作" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pages.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: "40px 20px", textAlign: "center", color: "var(--muted)" }}>
                          <p style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "500" }}>
                            {editLocale === "zh" ? "暫無頁面" : "No pages yet"}
                          </p>
                          <p style={{ margin: 0, fontSize: "13px" }}>
                            {editLocale === "zh"
                              ? "點擊「新增頁面」開始建立網站頁面"
                              : "Click \"New Page\" to start creating pages"}
                          </p>
                        </td>
                      </tr>
                    ) : null}
                    {pages.map((page, index) => (
                      <tr
                        key={page.id}
                        draggable
                        onDragStart={() => setDraggedPageId(page.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (draggedPageId && draggedPageId !== page.id) {
                            const draggedIndex = pages.findIndex(p => p.id === draggedPageId);
                            const newPages = [...pages];
                            [newPages[draggedIndex], newPages[index]] = [newPages[index], newPages[draggedIndex]];
                            setPages(newPages);
                            // Build overrides and auto-save immediately
                            const overrides: Record<string, Record<string, unknown>> = {};
                            newPages.forEach((p, i) => {
                              const key = p.type ?? p.slug ?? String(p.id);
                              overrides[key] = { sort_order: i };
                            });
                            setPageSettingsOverrides(prev => {
                              const next = { ...prev };
                              for (const [k, v] of Object.entries(overrides)) {
                                next[k] = { ...(next[k] ?? {}), ...v };
                              }
                              return next;
                            });
                            autoSavePages(overrides);
                          }
                          setDraggedPageId(null);
                        }}
                        onDragEnd={() => setDraggedPageId(null)}
                        style={{
                          backgroundColor: draggedPageId === page.id ? "var(--a-brand-soft)" : undefined,
                          opacity: draggedPageId === page.id ? 0.5 : 1,
                          transition: "all 0.2s"
                        }}
                      >
                        <td className="is-shrink" style={{ textAlign: "center", cursor: "grab" }}>⋮⋮</td>
                        <td><strong>{page.name}</strong></td>
                        <td className="a-field__hint a-u-font-mono">{page.slug || "/"}</td>
                        <td>
                          <span style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "10px",
                            fontWeight: "700",
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                            backgroundColor: page.pageType === "cms_list" ? "#e3e9f3" : "#dce6df",
                            color: page.pageType === "cms_list" ? "#33507f" : "#2f4a3c",
                          }}>
                            {page.pageType === "cms_list" ? "CMS" : (editLocale === "zh" ? "區塊" : "Blocks")}
                          </span>
                        </td>
                        <td>
                          {page.type === "homepage" ? (
                            <span style={{ fontSize: "11px", color: "var(--muted)" }}>—</span>
                          ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", fontSize: "12px", minHeight: 24, padding: "3px 0", color: page.showInNav ? "var(--forest)" : "var(--muted)" }}>
                              <input className="a-u-accent"
                                type="checkbox"
                                checked={page.showInNav}
                                onChange={() => {
                                  const newVal = !page.showInNav;
                                  const newPages = pages.map(p =>
                                    p.id === page.id ? { ...p, showInNav: newVal, visible: newVal || p.showInFooter } : p
                                  );
                                  setPages(newPages);
                                  const key = page.type ?? page.slug ?? String(page.id);
                                  const patch: Record<string, unknown> = { nav_hidden: !newVal };
                                  if (newVal) patch.visible = true;
                                  setPageSettingsOverrides(prev => ({
                                    ...prev,
                                    [key]: { ...(prev[key] ?? {}), ...patch },
                                  }));
                                  autoSavePages({ [key]: patch });
                                }}
                              />
                              Nav
                            </label>
                            <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", fontSize: "12px", minHeight: 24, padding: "3px 0", color: page.showInFooter ? "var(--forest)" : "var(--muted)" }}>
                              <input className="a-u-accent"
                                type="checkbox"
                                checked={page.showInFooter}
                                onChange={() => {
                                  const newVal = !page.showInFooter;
                                  const newPages = pages.map(p =>
                                    p.id === page.id ? { ...p, showInFooter: newVal, visible: p.showInNav || newVal } : p
                                  );
                                  setPages(newPages);
                                  const key = page.type ?? page.slug ?? String(page.id);
                                  const patch: Record<string, unknown> = { footer_hidden: !newVal };
                                  if (newVal) patch.visible = true;
                                  setPageSettingsOverrides(prev => ({
                                    ...prev,
                                    [key]: { ...(prev[key] ?? {}), ...patch },
                                  }));
                                  autoSavePages({ [key]: patch });
                                }}
                              />
                              Footer
                            </label>
                          </div>
                          )}
                        </td>
                        <td><RowActions>
                          {/* Order. The drag handle above is mouse-only. */}
                          <button
                            type="button"
                            className={buttonClass({ variant: "ghost", size: "sm" })}
                            disabled={index === 0}
                            title={editLocale === "zh" ? "上移" : "Move up"}
                            aria-label={editLocale === "zh" ? "上移" : "Move up"}
                            onClick={() => movePage(index, -1)}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className={buttonClass({ variant: "ghost", size: "sm" })}
                            disabled={index === pages.length - 1}
                            title={editLocale === "zh" ? "下移" : "Move down"}
                            aria-label={editLocale === "zh" ? "下移" : "Move down"}
                            onClick={() => movePage(index, 1)}
                          >
                            ↓
                          </button>
                          {/* Preview — opens an in-app modal (same as the homepage editor) */}
                          <button
                            type="button"
                            className={buttonClass({ variant: "ghost", size: "sm" })}
                            title={editLocale === "zh" ? "即時預覽" : "Live preview"}
                            onClick={() => {
                              const url = isRootSite
                                ? (page.type === "homepage" ? `/` : `/${page.type}`)
                                : (page.type === "homepage" ? `/stays/${site?.slug}` : `/stays/${site?.slug}/${page.type}`);
                              setPagePreviewDevice("desktop");
                              setPagePreview({ url, name: page.name });
                            }}
                          >
                            {editLocale === "zh" ? "預覽" : "Preview"}
                          </button>
                          <Link
                            href={
                              // The group site's front page is edited by the
                              // homepage editor, not the per-page one — its
                              // blocks live in settings.homepage, which the page
                              // route knows nothing about.
                              isRootSite && page.type === "homepage"
                                ? "/admin/homepage"
                                : `/admin/sites/${siteId}/pages/${page.type}`
                            }
                            className={buttonClass({ size: "sm" })}
                          >
                            {editLocale === "zh" ? "編輯版面" : "Edit layout"}
                          </Link>
                          {page.pageType === "cms_list" && <Link className={buttonClass({ variant: "ghost", size: "sm" })} href={`/admin/cms?tab=pages&category=${encodeURIComponent(page.type ?? page.slug ?? "")}`}>
                            {editLocale === "zh" ? "管理文章" : "Manage articles"}
                          </Link>}
                          {/* Homepage cannot be deleted; every other page (incl. defaults) can. Defaults persist as a tombstone {deleted:true}; customs are fully removed. */}
                          {page.type !== "homepage" && (
                          <button
                            type="button"
                            className={buttonClass({ variant: "danger-ghost", size: "sm" })}
                            onClick={async () => {
                              if (!(await ask({ tone: "danger", title: editLocale === "zh"
                                  ? `確認刪除「${page.name}」嗎？此操作會立即生效。`
                                  : `Delete "${page.name}"? This takes effect immediately.` }))) return;
                              // Remove from local state immediately
                              setPages(pages.filter(p => p.id !== page.id));
                              // Persist deletion via server action
                              const pageKey = page.type ?? page.slug ?? String(page.id);
                              const isDefault = !!(isRootSite ? ROOT_SITE_DEFAULT_PAGES : DEFAULT_PROPERTY_PAGES)[pageKey];
                              try {
                                if (isDefault) {
                                  // Tombstone via auto-save so the default stays hidden but key is preserved
                                  autoSavePages({ [pageKey]: { deleted: true, visible: false } });
                                } else {
                                  const fd = new FormData();
                                  fd.set("_site_id", siteId);
                                  fd.set("_site_json", JSON.stringify(site));
                                  fd.set("_page_key", pageKey);
                                  await deletePropertyPageAction(fd);
                                }
                                showLocalFlash("success", editLocale === "zh" ? `已刪除「${page.name}」` : `Deleted "${page.name}"`);
                              } catch (err: any) {
                                if (err?.digest?.startsWith?.("NEXT_REDIRECT")) {
                                  showLocalFlash("success", editLocale === "zh" ? `已刪除「${page.name}」` : `Deleted "${page.name}"`);
                                  return;
                                }
                                console.error("Delete page error:", err);
                                showLocalFlash("error", editLocale === "zh" ? "刪除頁面失敗" : "Failed to delete page");
                              }
                            }}
                          >
                            {editLocale === "zh" ? "刪除" : "Delete"}
                          </button>
                          )}
                        </RowActions></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableFrame>
            </div>

            {/* 頁面即時預覽（與首頁編輯相同的 modal 預覽） */}
            {pagePreview && portalReady && (
              <PreviewOverlay
                zh={editLocale === "zh"}
                title={editLocale === "zh" ? `即時預覽 — ${pagePreview.name}` : `Live preview — ${pagePreview.name}`}
                titleId="site-page-preview-title"
                onClose={() => setPagePreview(null)}
                device={pagePreviewDevice}
                onDevice={setPagePreviewDevice}
                panelRef={previewPanelRef}
                firstControlRef={previewFirstControlRef}
                closeRef={previewCloseControlRef}
              >
                    <iframe
                      src={pagePreview.url}
                      title={pagePreview.name}
                      className={`hpb-overlay__frame${previewDeviceClass(pagePreviewDevice)}`}
                    />
              </PreviewOverlay>
            )}

            {/* 页面编辑模态框 */}
            {portalReady && createPortal(
              <Dialog
                dismissible={false}
                onClose={() => { if (!creatingPage) setShowPageEditModal(false); }}
                open={showPageEditModal}
                title={editingPageId ? (editLocale === "zh" ? "編輯頁面" : "Edit Page") : (editLocale === "zh" ? "新增頁面" : "Create Page")}
              >
                <Stack>
                  {pageModalError && <Callout live="alert" tone="danger">{pageModalError}</Callout>}
                  <Field label={editLocale === "zh" ? "頁面名稱" : "Page Name"}>
                    <Input
                      value={pageForm.name}
                      onChange={(e) => setPageForm({ ...pageForm, name: e.target.value })}
                      placeholder={editLocale === "zh" ? "例如：慢域體驗" : "e.g., Experience"}
                    />
                  </Field>
                  {(() => {
                    const defaults = isRootSite ? ROOT_SITE_DEFAULT_PAGES : DEFAULT_PROPERTY_PAGES;
                    const origType = editingPageOrigSlug || "";
                    const slugFixed = Boolean(editingPageId) && (Boolean((defaults as Record<string, unknown>)[origType]) || origType === "homepage");
                    return (
                      <Field
                        hint={slugFixed ? (editLocale === "zh" ? "（預設頁面無法更改 slug）" : "(default page slug is fixed)") : undefined}
                        label="Slug"
                      >
                        <Input className="a-u-font-mono"
                          value={pageForm.slug}
                          onChange={(e) =>
                            setPageForm({
                              ...pageForm,
                              slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                            })
                          }
                          placeholder="experience"
                          readOnly={slugFixed}
                        />
                      </Field>
                    );
                  })()}

                  <DialogActions>
                    <button
                      type="button"
                      disabled={creatingPage}
                      onClick={() => setShowPageEditModal(false)}
                      className={buttonClass({ variant: "ghost" })}
                    >
                      {editLocale === "zh" ? "取消" : "Cancel"}
                    </button>
                    <button
                      type="button"
                      disabled={creatingPage}
                      onClick={async () => {
                        if (!pageForm.name.trim() || !pageForm.slug) {
                          setPageModalError(editLocale === "zh" ? "請填寫頁面名稱和 Slug" : "Please fill in page name and slug");
                          return;
                        }
                        if (editingPageId) {
                          const origSlug = editingPageOrigSlug || "";
                          const newSlug = pageForm.slug;
                          const slugChanged = newSlug !== origSlug;

                          // Validate slug format
                          if (slugChanged && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(newSlug)) {
                            await tell({ title: editLocale === "zh" ? "Slug 僅允許小寫英文、數字和連字號" : "Slug must be lowercase letters, numbers, and hyphens only" });
                            return;
                          }

                          // Check for slug conflict with existing pages
                          if (slugChanged) {
                            const existingKeys = new Set(pages.map((p) => p.type));
                            if (existingKeys.has(newSlug)) {
                              await tell({ title: editLocale === "zh" ? `Slug「${newSlug}」已被其他頁面使用` : `Slug "${newSlug}" is already used by another page` });
                              return;
                            }
                          }

                          // Resolve the effective key — if this slug was already renamed, chain it
                          const effectiveOldSlug = Object.entries(pageSlugRenames).find(([, v]) => v === origSlug)?.[0] || origSlug;

                          const settings = (site?.settings ?? {}) as Record<string, unknown>;
                          const existingPages = (settings.pages ?? {}) as Record<string, Record<string, unknown>>;
                          const existingCfg = existingPages[effectiveOldSlug] ?? existingPages[origSlug] ?? {};

                          // Update label as bilingual object
                          const prevLabel = (existingCfg.label ?? {}) as Record<string, string>;
                          const newLabel = { ...prevLabel, [editLocale]: pageForm.name };

                          // The overrides key should be the FINAL slug (after rename)
                          const targetSlug = slugChanged ? newSlug : origSlug;
                          setPageSettingsOverrides((prev) => {
                            const next = { ...prev };
                            // If slug changed, remove override on old key
                            if (slugChanged && next[origSlug]) delete next[origSlug];
                            next[targetSlug] = { ...existingCfg, ...(next[targetSlug] ?? {}), label: newLabel };
                            return next;
                          });

                          // Track slug rename
                          if (slugChanged) {
                            setPageSlugRenames((prev) => ({ ...prev, [effectiveOldSlug]: newSlug }));
                          }

                          /* Update local UI state.
                             `labelSource` goes with the name: it is what the
                             language switch re-resolves from, so a row renamed
                             in 中文 and then switched to English would otherwise
                             snap back to the label as last SAVED — the rename
                             looking undone while the auto-save below has
                             already written it. */
                          setPages((prev) =>
                            prev.map((p) =>
                              p.id === editingPageId
                                ? { ...p, name: pageForm.name, labelSource: newLabel, slug: newSlug, type: newSlug, id: `settings-${newSlug}` }
                                : p
                            )
                          );

                          // Auto-save the label change (non-blocking)
                          const labelOverrides = { [targetSlug]: { label: newLabel } };
                          autoSavePages(labelOverrides);

                          const msg = slugChanged
                            ? (editLocale === "zh" ? `已更新頁面設定（slug: ${origSlug} → ${newSlug}）` : `Page updated (slug: ${origSlug} → ${newSlug})`)
                            : (editLocale === "zh" ? "已更新頁面名稱" : "Page name updated");
                          showLocalFlash("success", msg);
                          setShowPageEditModal(false);
                          return;
                        }
                        const newName = pageForm.name;
                        setCreatingPage(true);
                        setPageModalError("");
                        try {
                          // Website pages always live in site settings, independently of articles.
                          const fd = new FormData();
                          fd.set("_site_id", siteId);
                          fd.set("_site_json", JSON.stringify(site));
                          fd.set("page_slug", pageForm.slug);
                          fd.set("label_zh", pageForm.name);
                          fd.set("label_en", pageForm.name);
                          const result = await addPropertyPageAction(fd);
                          if (!result.ok) {
                            setPageModalError(editLocale === "zh" ? (result.message?.includes("already exists") ? "此網址已被使用，請換一個 Slug。" : result.message?.includes("reserved") ? "此網址為系統保留，請換一個 Slug。" : "新增未完成，請檢查欄位後再試。") : result.message || "Could not create page.");
                            return;
                          }
                          setShowPageEditModal(false);
                          router.refresh();
                          showLocalFlash("success", editLocale === "zh" ? `已新增頁面「${newName}」` : `Created page "${newName}"`);
                        } catch (err: any) {
                          console.error("Create page error:", err);
                          setPageModalError(editLocale === "zh" ? "新增頁面失敗，請稍後再試。" : "Failed to create page. Please try again.");
                        } finally {
                          setCreatingPage(false);
                        }
                      }}
                      className={buttonClass({ variant: "primary" })}
                    >
                      {editingPageId ? (editLocale === "zh" ? "保存" : "Save") : (editLocale === "zh" ? "創建" : "Create")}
                    </button>
                  </DialogActions>
                </Stack>
              </Dialog>,
              document.querySelector(".admin-shell") ?? document.body
            )}
          </div>
        )}

        {/* Tab 4: SEO 設置 — 永遠保留在 DOM 內以確保儲存時送出 */}
        <div className="se-panel" style={{ display: tab === 3 ? undefined : "none" }}>
          <div className="admin-compact-form">
              <section className="admin-card">
                <div className="a-u-mb-16">
                  <h3 className="a-u-subhead">
                    {editLocale === "zh" ? "SEO 設置" : "SEO Settings"}
                  </h3>
                  <p className="a-u-note">
                    {editLocale === "zh" ? "設定網站搜尋引擎優化" : "Configure search engine optimization"}
                  </p>
                </div>
                <div className="form-grid compact">
                  <input type="hidden" name="seo_title" value={cleanBilingualSeo(seoTitle)} />
                  <input type="hidden" name="seo_description" value={cleanBilingualSeo(seoDescription)} />
                  <p className="so-language-hint a-u-span">
                    {editLocale === "zh"
                      ? "中文與英文 SEO 需分別填寫；切換上方語言後可編輯另一版本。Canonical URL 由各頁網址自動產生。"
                      : "Fill Chinese and English SEO separately. Switch the language above to edit the other version. Canonical URLs are generated from each page URL."}
                  </p>
                  <label className="a-u-span">
                    <span>{editLocale === "zh" ? "Meta 標題" : "Meta Title"}</span>
                    <input
                      value={splitBilingualSeo(seoTitle, defaultLocale)[editLocale]}
                      onChange={(event) => setSeoTitle(setBilingualSeo(seoTitle, editLocale, event.target.value, defaultLocale))}
                      placeholder={editLocale === "zh" ? "例如：思選旅宿｜宜蘭精品包棟" : "e.g. Slowfield Stays | Yilan Private Villas"}
                    />
                  </label>
                  <label className="a-u-span">
                    <span>{editLocale === "zh" ? "Meta 描述" : "Meta Description"}</span>
                    <textarea
                      value={splitBilingualSeo(seoDescription, defaultLocale)[editLocale]}
                      onChange={(event) => setSeoDescription(setBilingualSeo(seoDescription, editLocale, event.target.value, defaultLocale))}
                      placeholder={editLocale === "zh" ? "建議 120–160 字，說明網站與主要服務。" : "Aim for 120–160 characters describing the site and its main offering."}
                      rows={3}
                    />
                  </label>
                  <label className="a-u-span">
                    <span>{editLocale === "zh" ? "預設分享圖片（og:image）" : "Default share image (og:image)"}</span>
                    <input
                      name="seo_og_image"
                      defaultValue={String((site?.settings as Record<string, unknown> | undefined)?.seo_og_image ?? "")}
                      placeholder={editLocale === "zh" ? "https://… 或 /uploads/…（建議 1200×630）" : "https://… or /uploads/… (1200×630 recommended)"}
                    />
                    <small className="a-u-hint-12">
                      {editLocale === "zh"
                        ? "分享到 LINE、Facebook 時，沒有自己圖片的頁面會使用這張。"
                        : "Used when a page shared to LINE or Facebook has no image of its own."}
                    </small>
                  </label>
                </div>
              </section>
            </div>
        </div>

        {/* Tab 5: 字型 — 字體與字級。兩者原本一個在「基本資料」、一個在「進階 / 法規」，
            分屬兩張表卻是同一件事。永遠保留在 DOM 內（display:none）以確保儲存時一併送出。 */}
        <div className="se-panel" style={{ display: tab === 4 ? undefined : "none" }}>
          {(() => { const adv = (site?.settings ?? {}) as Record<string, unknown>; const advStr = (k: string) => String(adv[k] ?? ""); return (
          <div className="admin-compact-form">
              {/* 字體設定 */}
              <section className="admin-card a-u-mb-20">
                <div className="a-u-mb-16">
                  <h3 className="a-u-subhead">
                    {editLocale === "zh" ? "網站字體" : "Site Typography"}
                  </h3>
                  <p className="a-u-note">
                    {editLocale === "zh"
                      ? "套用後，此站所有頁面（含首頁與內容頁／CMS）的字體都會變更。母站與子站各自獨立設定，互不影響。"
                      : "Applies to every page of this site (incl. homepage and CMS content). Parent and child sites are configured independently."}
                  </p>
                </div>
                <div className="form-grid compact">
                  {/* Quick preset — fills the four granular selects below. Still saved
                      as font_preset so un-migrated fallback + "last preset" works. */}
                  <label className="a-u-span">
                    <span>{editLocale === "zh" ? "快速套用範本（可再微調）" : "Quick preset (then fine-tune)"}</span>
                    <select name="font_preset" defaultValue={advStr("font_preset") || "classic"}
                      onChange={(e) => applyFontPreset(e.target.value)}>
                      <option value="classic">{editLocale === "zh" ? "經典 — 宋體 ＋ Cormorant" : "Classic — serif + Cormorant"}</option>
                      <option value="editorial">{editLocale === "zh" ? "雜誌 — 宋體 ＋ Playfair" : "Editorial — serif + Playfair"}</option>
                      <option value="modern">{editLocale === "zh" ? "現代 — 全黑體" : "Modern — all sans"}</option>
                      <option value="warm">{editLocale === "zh" ? "溫潤 — 黑體 ＋ Cormorant 標題" : "Warm — sans + Cormorant"}</option>
                      <option value="resort">{editLocale === "zh" ? "渡假 — 宋體 ＋ Marcellus" : "Resort — serif + Marcellus"}</option>
                      <option value="coastal">{editLocale === "zh" ? "海岸 — 黑體 ＋ Fraunces 標題" : "Coastal — sans + Fraunces"}</option>
                      <option value="boutique">{editLocale === "zh" ? "精品 — 宋體 ＋ Fraunces" : "Boutique — serif + Fraunces"}</option>
                      <option value="elegant">{editLocale === "zh" ? "優雅 — 宋體 ＋ EB Garamond" : "Elegant — serif + EB Garamond"}</option>
                      <option value="script">{editLocale === "zh" ? "書寫 — 黑體 ＋ Pinyon 花體標題" : "Script — sans + Pinyon"}</option>
                      <option value="kai">{editLocale === "zh" ? "手寫楷書 — 全楷書" : "Kai — all kaisho"}</option>
                    </select>
                  </label>

                  {/* All four read TYPE_FACES — the same catalogue the 字級 panel
                      and a block's per-role 字體 read. They used to hold three
                      Chinese faces, seven Latin heading faces and two Latin body
                      faces, three lists that agreed with nothing (客戶: 站群的
                      字體的選單也是要很多的 font 字體，中英都要，要 30+ 選項).
                      No label wrapper here: the picker brings its own label tied
                      by htmlFor, and a second one around it would claim the
                      control and mis-aim every click on the group. */}
                  <FontFacePicker
                    zh={editLocale === "zh"}
                    name="font_title_cjk"
                    label={editLocale === "zh" ? "標題 — 中文字體" : "Heading — Chinese"}
                    value={fTitleCjk}
                    onChange={setFTitleCjk}
                  />
                  <FontFacePicker
                    zh={editLocale === "zh"}
                    name="font_title_latin"
                    label={editLocale === "zh" ? "標題 — 英文／數字" : "Heading — Latin"}
                    value={fTitleLatin}
                    onChange={setFTitleLatin}
                    fallbackStack={fTitleLatin === "match" ? cjkFaceStack(fTitleCjk) : ""}
                  >
                    <optgroup label={editLocale === "zh" ? "跟隨中文" : "Follow the Chinese face"}>
                      {/* Only 黑體 had a Latin twin before this, so a site on
                          宋體 or 楷書 could not ask for one face throughout. */}
                      <option value="match">{editLocale === "zh" ? "與中文字體相同" : "Same as Chinese"}</option>
                    </optgroup>
                  </FontFacePicker>

                  <FontFacePicker
                    zh={editLocale === "zh"}
                    name="font_body_cjk"
                    label={editLocale === "zh" ? "內文（全站內容）— 中文字體" : "Body — Chinese"}
                    value={fBodyCjk}
                    onChange={setFBodyCjk}
                  />
                  <FontFacePicker
                    zh={editLocale === "zh"}
                    name="font_body_latin"
                    label={editLocale === "zh" ? "內文 — 英文／數字" : "Body — Latin"}
                    value={fBodyLatin}
                    onChange={setFBodyLatin}
                    fallbackStack={fBodyLatin === "match" ? cjkFaceStack(fBodyCjk) : ""}
                  >
                    <optgroup label={editLocale === "zh" ? "跟隨中文" : "Follow the Chinese face"}>
                      <option value="match">{editLocale === "zh" ? "與中文字體相同" : "Same as Chinese"}</option>
                    </optgroup>
                  </FontFacePicker>

                  <span className="field-hint" style={{ gridColumn: "1 / -1", display: "block", marginTop: 2, fontSize: 12, opacity: 0.7 }}>
                    {editLocale === "zh"
                      ? "標題與內文可分開設定，中文／英文也各自選擇（中文欄選中文字體；英文欄只排英文與數字，不影響中文）。英文若選「與中文字體相同」，就會用上面那個中文字體來排英文，中英文看起來一致。每個選單下方的範例會以選到的字體顯示。中文字體只有前三個需要下載，其餘為系統內建；讀者電腦沒有的字體會自動退回思源宋體／黑體。套用到此站所有頁面的內容；導覽列／選單／頁尾固定用黑體，不受影響。先選上方範本可一次帶入，再微調。"
                      : "Headings and body are set separately, and Chinese / Latin each have their own choice — the Latin menu styles English and numbers only and never touches Chinese. Choose \"Same as Chinese\" for Latin to draw English in the Chinese face, so both read as one typeface. The sample line under each menu is drawn in the face you picked. Only the first three Chinese faces are downloaded; the rest are already on the reader's machine and fall back to Noto Serif / Sans TC when they are not. Applies to all page content on this site; the header / menu / footer always stay sans. Pick a preset above to fill all four, then fine-tune."}
                  </span>
                </div>
              </section>

            {/* 字級：標題與內文各層級的大小、字重、行高 */}
            <section className="admin-card a-u-mb-20">
              <div className="a-u-mb-16">
                <h3 className="a-u-subhead">
                  {editLocale === "zh" ? "字級" : "Type Scale"}
                </h3>
                <p className="a-u-note">
                  {editLocale === "zh"
                    ? "每個層級的大小、字重與行高，套用到全站所有內容區塊（含 CMS 文章）。留空則沿用主題預設。"
                    : "Size, weight and line height per level, applied to every content block on the site including CMS articles. Blank keeps the theme default."}
                </p>
              </div>
                  <TypeScaleField
                    initial={(site?.settings as Record<string, unknown> | undefined)?.type_scale}
                    zh={editLocale === "zh"}
                  />

              <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--line)" }}>
                <h3 className="a-u-subhead">
                  {editLocale === "zh" ? "版面" : "Layout"}
                </h3>
                <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: "13px" }}>
                  {editLocale === "zh"
                    ? "留白、區塊間距與介面元素大小，套用到全站每一頁。"
                    : "Gutters, spacing and the size of interface elements, applied to every page on the site."}
                </p>
                <LayoutField
                  initial={(site?.settings as Record<string, unknown> | undefined)?.layout}
                  zh={editLocale === "zh"}
                />
              </div>
            </section>
          </div>
          ); })()}
        </div>

        {/* Tab 6: 搜尋 — 五份清單編輯器。攤開來的話這一頁要捲很久，而其中四份
            大多數時候是空的（留空就用內建值）。這裡只列出它們和目前的項數，
            編輯開在面板上。面板用 display 切換而非卸載：這張表一次送出所有分頁，
            卸載的欄位會被存成空值。 */}
        <div className="se-panel" style={{ display: tab === 5 ? undefined : "none" }}>
          <div className="admin-compact-form">
            <div className="se-srows">
              <button type="button" className="se-srow" onClick={() => setSearchSheet("search_facilities")}>
                <span className="se-srow__name">{editLocale === "zh" ? "服務設施" : "Facilities"}</span>
                <span className="se-srow__where">{editLocale === "zh" ? "搜尋列第 2 欄" : "Search bar, 2nd field"}</span>
                <span className="se-srow__count">{searchCount("search_facilities")}</span>
                <span className="se-srow__go" aria-hidden="true">›</span>
              </button>
              <button type="button" className="se-srow" onClick={() => setSearchSheet("search_experiences")}>
                <span className="se-srow__name">{editLocale === "zh" ? "慢域體驗" : "Select Experiences"}</span>
                <span className="se-srow__where">{editLocale === "zh" ? "搜尋列：服務設施之後" : "Search bar, after facilities"}</span>
                <span className="se-srow__count">{searchCount("search_experiences")}</span>
                <span className="se-srow__go" aria-hidden="true">›</span>
              </button>
              <button type="button" className="se-srow" onClick={() => setSearchSheet("search_types")}>
                <span className="se-srow__name">{editLocale === "zh" ? "民宿類型" : "Villa Types"}</span>
                <span className="se-srow__where">{editLocale === "zh" ? "搜尋列第 3 欄" : "Search bar, 3rd field"}</span>
                <span className="se-srow__count">{searchCount("search_types")}</span>
                <span className="se-srow__go" aria-hidden="true">›</span>
              </button>
              <button type="button" className="se-srow" onClick={() => setSearchSheet("search_guest_ranges")}>
                <span className="se-srow__name">{editLocale === "zh" ? "人數級距" : "Party Sizes"}</span>
                <span className="se-srow__where">{editLocale === "zh" ? "搜尋列第 4 欄" : "Search bar, 4th field"}</span>
                <span className="se-srow__count">{searchCount("search_guest_ranges")}</span>
                <span className="se-srow__go" aria-hidden="true">›</span>
              </button>
            </div>
            {/* These settings only reach a search bar the site actually
                renders, and a villa (child) site has no search block — its
                pages are the property renderer, which has no such block type.
                Editing them here therefore changes nothing on the front end,
                which is invisible without saying so. */}
            {site?.parent_site_id != null && (
              <p className="se-srows__warn">
                {editLocale === "zh"
                  ? "這個站是子站，前台沒有搜尋列，這裡的設定不會有任何效果。首頁那條搜尋列屬於母站，請切到母站再設定。"
                  : "This is a child site with no search bar on the front end, so nothing here will take effect. The homepage search bar belongs to the parent site — switch to it to configure these."}
              </p>
            )}
            <p className="se-srows__note">
              {editLocale === "zh"
                ? "縣市與地區不在這裡 —— 它們直接從住宿資料產生並自動去重，沒有東西可以設定。"
                : "County and district are not here: they come from the stays and de-duplicate themselves, so there is nothing to set."}
            </p>
            <Dialog
              keepMounted
              size="lg"
              className="se-search-sheet"
              open={searchSheet === "search_facilities"}
              onClose={() => setSearchSheet(null)}
              closeLabel={editLocale === "zh" ? "關閉" : "Close"}
              title={editLocale === "zh" ? "服務設施" : "Facilities"}
              description={editLocale === "zh" ? "留空 = 使用內建清單" : "Blank = built-in list"}
            >
                  <SearchOptionsField
                    name="search_facilities"
                    initial={(site?.settings as Record<string, unknown> | undefined)?.search_facilities}
                    defaults={SERVICE_FACILITIES.map((s) => ({ value: s.value, zh: s.zh, en: s.en }))}
                    zh={editLocale === "zh"}
                    zhPlaceholder="戲水池"
                    enPlaceholder="Pool"
                    addLabel={editLocale === "zh" ? "+ 新增設施" : "+ Add facility"}
                  />
            </Dialog>
            <Dialog
              keepMounted
              size="lg"
              className="se-search-sheet"
              open={searchSheet === "search_experiences"}
              onClose={() => setSearchSheet(null)}
              closeLabel={editLocale === "zh" ? "關閉" : "Close"}
              title={editLocale === "zh" ? "慢域體驗" : "Select Experiences"}
              description={editLocale === "zh" ? "留空 = 搜尋列不顯示" : "Blank = field hidden"}
            >
                  <SearchOptionsField
                    name="search_experiences"
                    initial={(site?.settings as Record<string, unknown> | undefined)?.search_experiences}
                    defaults={[]}
                    zh={editLocale === "zh"}
                    zhPlaceholder="在地餐桌"
                    enPlaceholder="Local dining"
                    addLabel={editLocale === "zh" ? "+ 新增體驗" : "+ Add experience"}
                  />
            </Dialog>
            <Dialog
              keepMounted
              size="lg"
              className="se-search-sheet"
              open={searchSheet === "search_types"}
              onClose={() => setSearchSheet(null)}
              closeLabel={editLocale === "zh" ? "關閉" : "Close"}
              title={editLocale === "zh" ? "民宿類型" : "Villa Types"}
              description={editLocale === "zh" ? "留空 = 這一欄不顯示" : "Blank = field hidden"}
            >
                  <p className="se-section-hint">
                    {editLocale === "zh"
                      ? "民宿類型是可自訂的搜尋列第三欄，例如「包棟」或「泳池 Villa」。新增後，請在住宿編輯的標籤填入相同值；留空則前台不顯示這一欄。"
                      : "Villa Types is an optional custom third search field, such as \"Whole villa\" or \"Pool villa\". After adding a type, use the same value in the stay tags. Leave it blank to hide this field on the public site."}
                  </p>
                  <SearchOptionsField
                    name="search_types"
                    initial={(site?.settings as Record<string, unknown> | undefined)?.search_types}
                    defaults={[]}
                    zh={editLocale === "zh"}
                    zhPlaceholder="泳池villa"
                    enPlaceholder="Pool villa"
                    addLabel={editLocale === "zh" ? "+ 新增類型" : "+ Add type"}
                  />
            </Dialog>
            <Dialog
              keepMounted
              size="lg"
              className="se-search-sheet"
              open={searchSheet === "search_guest_ranges"}
              onClose={() => setSearchSheet(null)}
              closeLabel={editLocale === "zh" ? "關閉" : "Close"}
              title={editLocale === "zh" ? "人數級距" : "Party Sizes"}
              description={editLocale === "zh" ? "留空 = 使用內建級距" : "Blank = built-in ranges"}
            >
                  <GuestRangeField
                    name="search_guest_ranges"
                    initial={(site?.settings as Record<string, unknown> | undefined)?.search_guest_ranges}
                    initialUnit={(site?.settings as Record<string, unknown> | undefined)?.search_guest_ranges_unit}
                    defaults={GUEST_RANGES.map((g) => {
                      // "3–5 人" → min 3, max 5; "13 人以上" → min 13, no cap.
                      const m = g.zh.match(/(\d+)\D+(\d+)/);
                      return m ? { min: m[1], max: m[2] } : { min: g.value, max: "" };
                    })}
                    zh={editLocale === "zh"}
                  />
            </Dialog>
            {/* 搜尋短詞 and 詢問類型 used to have sheets here (client: 多餘了).
                Their stored settings are left untouched — see the null checks
                in siteActions, which keep a value the form no longer posts. */}
          </div>
        </div>

        {/* Tab 7: 進階 / 法規 — 字體、GA、Cookie/GDPR、自訂程式碼、頁尾法律聲明。
            永遠保留在 DOM 內（display:none）以確保儲存時一併送出，避免欄位被清空。 */}
        <div className="se-panel" style={{ display: tab === 6 ? undefined : "none" }}>
          {(() => { const adv = (site?.settings ?? {}) as Record<string, unknown>; const advStr = (k: string) => String(adv[k] ?? ""); return (
          <div className="admin-compact-form">


              {/* 數據分析與廣告 */}
              <section className="admin-card a-u-mb-20">
                <div className="a-u-mb-16">
                  <h3 className="a-u-subhead">
                    {editLocale === "zh" ? "數據分析與廣告" : "Analytics & Ads"}
                  </h3>
                  <p className="a-u-note">
                    {editLocale === "zh" ? "設定後才會在前台輸出對應追蹤碼。" : "Tracking scripts only render on the public site when set."}
                  </p>
                </div>
                <div className="form-grid compact">
                  <label>
                    <span>{editLocale === "zh" ? "Google Analytics ID" : "Google Analytics ID"}</span>
                    <input name="ga_id" defaultValue={advStr("ga_id")} placeholder="G-XXXXXXXXXX" />
                  </label>
                  {canSetScriptCode && (
                    <label>
                      <span>{editLocale === "zh" ? "廣告轉換碼" : "Ads conversion"}</span>
                      <input name="ads_code" defaultValue={advStr("ads_code")} placeholder="AW-XXXXXXXXX" />
                    </label>
                  )}
                </div>
              </section>

              {/* 法規 / 隱私 */}
              <section className="admin-card a-u-mb-20">
                <div className="a-u-mb-16">
                  <h3 className="a-u-subhead">
                    {editLocale === "zh" ? "法規 / 隱私" : "Legal / Privacy"}
                  </h3>
                  <p className="a-u-note">
                    {editLocale === "zh" ? "Cookie 提示、GDPR 告知與頁尾法律聲明。" : "Cookie banner, GDPR notice, and footer legal statement."}
                  </p>
                </div>
                {(() => {
                  const biln = (key: string): { zh: string; en: string } => {
                    const v = (site?.settings as Record<string, unknown> | undefined)?.[key];
                    if (v && typeof v === "object") {
                      const o = v as { zh?: string; en?: string };
                      return { zh: o.zh ?? "", en: o.en ?? "" };
                    }
                    // legacy: a plain string was stored under zh
                    return { zh: typeof v === "string" ? v : "", en: "" };
                  };
                  const cookie = biln("cookie_notice");
                  const gdpr = biln("gdpr_notice");
                  const footerDescription = biln("footer_description");
                  const footerTitle = biln("footer_title");
                  const footerCopyright = biln("footer_copyright");
                  return (
                    <div className="form-grid compact">
                      <LocaleLabel show={editLocale === "zh"} span>
                        <span>頁尾品牌標題（中文）</span>
                        <input name="footer_title_zh" defaultValue={footerTitle.zh} placeholder="留空使用站點名稱" />
                      </LocaleLabel>
                      <LocaleLabel show={editLocale === "en"} span>
                        <span>Footer brand title (English)</span>
                        <input name="footer_title_en" defaultValue={footerTitle.en} placeholder="Leave blank to use the site name" />
                      </LocaleLabel>
                      <LocaleLabel show={editLocale === "zh"} span>
                        <span>頁尾左側文字（中文）</span>
                        <textarea name="footer_description_zh" defaultValue={footerDescription.zh} rows={2} placeholder="在此輸入頁尾品牌文字；留空使用系統預設。" />
                      </LocaleLabel>
                      <LocaleLabel show={editLocale === "en"} span>
                        <span>Footer left copy (English)</span>
                        <textarea name="footer_description_en" defaultValue={footerDescription.en} rows={2} placeholder="Footer brand copy; leave blank to use the default." />
                      </LocaleLabel>
                      <LocaleLabel show={editLocale === "zh"} span>
                        <span>頁尾版權文字（中文）</span>
                        <input name="footer_copyright_zh" defaultValue={footerCopyright.zh} placeholder="留空使用 © 年份＋站點名稱" />
                      </LocaleLabel>
                      <LocaleLabel show={editLocale === "en"} span>
                        <span>Footer copyright line (English)</span>
                        <input name="footer_copyright_en" defaultValue={footerCopyright.en} placeholder="Leave blank to use © year + site name" />
                      </LocaleLabel>
                      <label className="admin-switch-row a-u-span">
                        <input
                          type="checkbox"
                          name="show_footer_phone"
                          defaultChecked={(site?.settings as Record<string, unknown> | undefined)?.show_footer_phone !== false}
                        />
                        <span className="admin-switch-track" aria-hidden="true"><span /></span>
                        <span>{editLocale === "zh" ? "在頁尾顯示聯絡電話" : "Show contact phone in the footer"}</span>
                      </label>
                      <LocaleLabel show={editLocale === "zh"} span>
                        <span>Cookie 提示文案（中文）</span>
                        <input name="cookie_notice_zh" defaultValue={cookie.zh} placeholder="本網站使用 Cookie 以提升瀏覽體驗。" />
                      </LocaleLabel>
                      <LocaleLabel show={editLocale === "en"} span>
                        <span>Cookie notice (English)</span>
                        <input name="cookie_notice_en" defaultValue={cookie.en} placeholder="This site uses cookies to improve your experience." />
                      </LocaleLabel>
                      <LocaleLabel show={editLocale === "zh"} span>
                        <span>GDPR / 隱私告知（中文）</span>
                        <textarea name="gdpr_notice_zh" defaultValue={gdpr.zh} rows={2} placeholder="隱私與資料使用告知。" />
                      </LocaleLabel>
                      <LocaleLabel show={editLocale === "en"} span>
                        <span>GDPR / privacy notice (English)</span>
                        <textarea name="gdpr_notice_en" defaultValue={gdpr.en} rows={2} placeholder="Privacy and data-use notice." />
                      </LocaleLabel>
                    </div>
                  );
                })()}
                {/* 頁尾法律聲明（自主題顏色搬移至此，與法規同區） */}
                {(() => {
                  const fn = (site?.settings as { footer_notice?: { zh?: string; en?: string } | string } | undefined)?.footer_notice;
                  const fnZh = typeof fn === "object" && fn ? (fn.zh ?? "") : (typeof fn === "string" ? fn : "");
                  const fnEn = typeof fn === "object" && fn ? (fn.en ?? "") : "";
                  return (
                    <div style={{ margin: "4px 0" }}>
                      <LocaleLabel show={editLocale === "zh"} className="a-u-mb-8">
                        <span className="a-u-caption">頁尾法律聲明</span>
                        <textarea className="a-u-full-width" name="footer_notice_zh" rows={3} defaultValue={fnZh} placeholder="本官網相關圖文皆為..." />
                      </LocaleLabel>
                      <LocaleLabel show={editLocale === "en"}>
                        <span className="a-u-caption">Footer legal notice</span>
                        <textarea className="a-u-full-width" name="footer_notice_en" rows={3} defaultValue={fnEn} placeholder="All content and images on this site are the intellectual property of..." />
                      </LocaleLabel>
                    </div>
                  );
                })()}
              </section>

              {/* 自訂程式碼 */}
              <section className="admin-card">
                <div className="a-u-mb-16">
                  <h3 className="a-u-subhead">
                    {editLocale === "zh" ? "自訂程式碼" : "Custom Code"}
                  </h3>
                  <p className="a-u-note">
                    {editLocale === "zh" ? "插入 <head> 與頁尾的自訂腳本（請僅貼信任來源）。" : "Custom scripts injected into <head> and footer (trusted sources only)."}
                  </p>
                </div>
                <div className="form-grid compact">
                  {canSetScriptCode ? (
                    <>
                      <label className="a-u-span">
                        <span>{editLocale === "zh" ? "Head 程式碼" : "Head code"}</span>
                        <textarea className="a-u-mono" name="head_code" defaultValue={advStr("head_code")} rows={4} placeholder={'<script src="..."></script>'} />
                      </label>
                      <label className="a-u-span">
                        <span>{editLocale === "zh" ? "Body 程式碼" : "Body code"}</span>
                        <textarea className="a-u-mono" name="body_code" defaultValue={advStr("body_code")} rows={4} placeholder={'<script>...</script>'} />
                      </label>
                    </>
                  ) : (
                    <p style={{ gridColumn: "1 / -1", margin: 0, color: "var(--muted)", fontSize: "13px" }}>
                      {editLocale === "zh"
                        ? "自訂程式碼會在網站頁面上執行，只有網站擁有者可以設定。需要加入追蹤碼請聯絡擁有者。"
                        : "Custom code runs on the site's pages, so only the site owner can set it. Ask them to add a tracking snippet."}
                    </p>
                  )}
                </div>
              </section>
            </div>
          ); })()}
        </div>

      </section>

      {/* 側邊欄 (頁面管理 / 權限管理 時隱藏) */}
      {tab !== 1 && tab !== 2 && <aside className="se-sidebar">
        {/* 發布卡片 */}
        <Card
          title={editLocale === "zh" ? "發布設定" : "Publishing"}
          actions={<Badge tone={status === "active" ? "success" : status === "draft" ? "warning" : "neutral"} dot>{statusLabels[status]}</Badge>}
        >
          <div className="a-stack a-stack--md">
            <Field label={editLocale === "zh" ? "當前狀態" : "Status"}>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="active">{statusLabels.active}</option>
                <option value="draft">{statusLabels.draft}</option>
                <option value="archived">{statusLabels.archived}</option>
              </Select>
            </Field>

            {/* status 由 tab1 的 <select name="status"> 提供，這裡不重複輸出 */}

            <SubmitButton className={buttonClass({ variant: "primary", block: true })}>
              {editLocale === "zh" ? "儲存網站" : "Save Site"}
            </SubmitButton>

            {canDeleteSite && site.parent_site_id && (
              /* The themed dialog, like every other destructive action here. A
                 raw window.confirm() on the one action that also deletes the
                 site's stays, pages, banners, media and enquiries was the odd
                 one out, and browsers style it as a page-level alert rather than
                 as something this admin is asking. */
              <ConfirmSubmitButton
                className={buttonClass({ variant: "danger-ghost", block: true })}
                action={deleteSiteByIdAction.bind(null, String(site.id))}
                body={
                  editLocale === "zh"
                    ? `確定要刪除「${site.name}」嗎？這個站點的住宿、內容頁、Banner、媒體與表單聯絡紀錄都會一併移除，且無法復原。`
                    : `Delete "${site.name}"? Its stays, pages, banners, media and enquiries go with it, and this cannot be undone.`
                }
                cancelLabel={editLocale === "zh" ? "取消" : "Cancel"}
                confirmLabel={editLocale === "zh" ? "刪除網站" : "Delete site"}
                title={editLocale === "zh" ? "確認刪除網站" : "Confirm site deletion"}
              >
                {editLocale === "zh" ? "刪除網站" : "Delete Site"}
              </ConfirmSubmitButton>
            )}
          </div>
        </Card>

        {/* 進度卡片 */}
        <Card title={editLocale === "zh" ? "設置完成度" : "Setup Progress"}>
          <div className="a-stack a-stack--md">
            <Progress label={editLocale === "zh" ? "完成度" : "Complete"} tone={checks.pct === 100 ? "success" : "brand"} value={checks.pct} />
            <ListRows>
              {checks.items.map((c) => (
                <ListRow
                  aside={c.ok ? <CheckCircle2 className="a-icon--success" /> : <Circle />}
                  key={c.label}
                  meta={c.desc}
                  title={c.label}
                />
              ))}
            </ListRows>
          </div>
        </Card>
      </aside>}
        </fieldset>
    </SafeForm>
    </>
  );
}

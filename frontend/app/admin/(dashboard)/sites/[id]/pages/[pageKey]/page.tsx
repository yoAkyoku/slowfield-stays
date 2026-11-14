import { AdminSiteProvider } from "../../../../../modules/AdminSiteContext";
import { ArrowLeft } from "lucide-react";
import { ButtonLink, Page, PageHeader } from "../../../../../ui";
import { notFound } from "next/navigation";
import { AdminForbiddenError, getAdminContentTags, getAdminProfile, getAdminSite, hasPermission } from "../../../../../modules/adminApi";
import AdminFlash from "../../../../../modules/AdminFlash";
import { getLocale, t } from "../../../../../../modules/i18n";
import { updatePropertyPageAction } from "../../../../../modules/propertyPagesActions";
import PropertyBlockEditor from "./PropertyBlockEditor";
import AdminAccessNotice from "../../../../../modules/AdminAccessNotice";
import { SetAdminSiteCookie } from "../../../../../modules/SetAdminSiteCookie";
import { pageLabel as resolvePageLabel, DEFAULT_PROPERTY_PAGES, type PropertyBlock, type PropertyPageConfig } from "../../../../../../modules/property/types";

export default async function PropertyPageEditorPage(
  props: {
    params: Promise<{ id: string; pageKey: string }>;
    searchParams: Promise<{ error?: string; notice?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const locale = await getLocale();
  const copy = t(locale);
  const zh = locale === "zh";
  const site = await getAdminSite(params.id);
  if (!site) notFound();
  const [profile, contentTags] = await Promise.all([getAdminProfile(site.slug), getAdminContentTags(true,site.slug)]);
  if (!hasPermission(profile.permissions, "cms:read")) throw new AdminForbiddenError();
  const canWrite = site._can_edit !== false && hasPermission(profile.permissions, "site_users:write");
  if (!site) notFound();

  const settings = (site.settings ?? {}) as Record<string, unknown>;
  const pageKey = params.pageKey;

  // Read existing blocks
  let rawBlocks: PropertyBlock[] = [];
  let existingSeo: Record<string, unknown> = {};
  let showCmsList: boolean | undefined;

  if (pageKey === "homepage") {
    const hp = (settings.homepage ?? {}) as Record<string, unknown>;
    rawBlocks = Array.isArray(hp.blocks) ? (hp.blocks as PropertyBlock[]) : [];
    existingSeo = (hp.seo ?? {}) as Record<string, unknown>;
    showCmsList = hp.show_cms_list === true ? true : hp.show_cms_list === false ? false : undefined;
  } else {
    const pages = (settings.pages ?? {}) as Record<string, Record<string, unknown>>;
    const pg = pages[pageKey] ?? {};
    rawBlocks = Array.isArray(pg.blocks) ? (pg.blocks as PropertyBlock[]) : [];
    /* 精選住宿 synthesises a search block when its stored list has none — the
       page used to render the bar in its own JSX, so no site has one saved and
       without this the author opens 頁面編輯 → 精選住宿, sees an empty list, and
       cannot move, restyle or remove a bar the page is plainly showing. That is
       the opposite of the request the block exists for (客戶: 我需要這個區塊在頁
       面編輯中添加至精品Villa，移除默認的搜尋列).

       First, matching the page's own `[search, ...stored]`: the editor's order
       and the page's synthesis have to agree, or dragging a block above the bar
       in here does nothing out there. The homepage editor seeds the same way and
       carries the same note. */
    if (pageKey === "stays" && !rawBlocks.some((b) => b.type === "search")) {
      rawBlocks = [{ id: "search-bar", type: "search", enabled: true, config: {} } as PropertyBlock, ...rawBlocks];
    }
    existingSeo = (pg.seo ?? {}) as Record<string, unknown>;
    showCmsList = pg.show_cms_list === true ? true : pg.show_cms_list === false ? false : undefined;
  }

  // Read existing page-level settings
  const pgForMeta = (() => {
    if (pageKey === "homepage") return { label: { zh: "首頁", en: "Homepage" } } as Record<string, unknown>;
    const pages = (settings.pages ?? {}) as Record<string, Record<string, unknown>>;
    return pages[pageKey] ?? {};
  })();

  const existingLabel = (() => {
    const lbl = pgForMeta.label;
    const defaultLabel = DEFAULT_PROPERTY_PAGES[pageKey]?.label;
    const fallbackLabel = typeof defaultLabel === "string"
      ? { zh: defaultLabel, en: defaultLabel }
      : defaultLabel ?? {};
    if (lbl && typeof lbl === "object" && !Array.isArray(lbl)) {
      const labels = lbl as Record<string, string>;
      return labels.zh || labels.en ? labels : fallbackLabel;
    }
    /* A page label is allowed to be a plain string — one name the admin chose
       for both languages — and the nav renderers handle that shape. This
       returned {} for it, so opening such a page and saving anything at all
       wrote the empty object back over the name. The parent nav hid the damage
       behind its bundled default; a villa fell through to the raw page key and
       showed a slug like "about". */
    if (typeof lbl === "string" && lbl.trim()) {
      const one = lbl.trim();
      return { zh: one, en: one };
    }
    return fallbackLabel;
  })();
  // Hero fields (page-level)
  const existingHeroImage = typeof pgForMeta.hero_image === "string" ? pgForMeta.hero_image : undefined;
  const existingHeroTitle = (() => {
    const v = pgForMeta.hero_title;
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, string>;
    return undefined;
  })();
  const existingHeroSubtitle = (() => {
    const v = pgForMeta.hero_subtitle;
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, string>;
    return undefined;
  })();
  const existingHeroTitleColor = typeof pgForMeta.hero_title_color === "string" ? pgForMeta.hero_title_color : undefined;
  const existingHeroSubtitleColor = typeof pgForMeta.hero_subtitle_color === "string" ? pgForMeta.hero_subtitle_color : undefined;
  const existingHeroHeight = typeof pgForMeta.hero_height === "string" ? pgForMeta.hero_height : undefined;
  const existingHeroLayout = typeof pgForMeta.hero_layout === "string" ? pgForMeta.hero_layout : undefined;

  /* The id fallback is derived from the position, not random.
     A random one was minted afresh on every render of this server component, so
     a block saved without an id got a different id each time the page was
     re-fetched — which the editor's unsaved-work guard reads as the page having
     changed under it, and would have warned about on every exit. The id is only
     a client-side handle and a React key; the position is unique within the
     list, which is all either use needs. */
  /* Deduped, because these fallbacks are persisted: the editor submits
     JSON.stringify(blocks), ids included, so `block-0` comes back as a real id
     next time. A block arriving later without one — an import, an older row —
     would then be handed an id already in use, and `key`, select, move, toggle
     and remove all address a block by id, so two blocks sharing one makes every
     one of them act on the wrong block. Deterministic for a given input, which
     a server component re-rendered per request needs. */
  const initialBlocks = rawBlocks.map((b, index, all) => {
    let id = b.id;
    if (!id) {
      // Distinct per position among the id-less blocks; the loop only has to
      // clear the ids already saved on this page.
      id = `block-${index}`;
      while (all.some((other) => other.id === id)) id = `${id}-b`;
    }
    return {
      id,
      type: b.type,
      enabled: b.enabled !== false,
      config: (b.config ?? {}) as Record<string, unknown>,
    };
  });

  return (
    <Page width="wide">
      <AdminAccessNotice permissions={profile.permissions} zh={zh} siteName={site.name} siteId={site.id} target />
      <SetAdminSiteCookie slug={site.slug} parentSiteId={site.parent_site_id} />
      <PageHeader
        eyebrow={site.name}
        title={pageKey === "homepage" ? (zh ? "首頁" : "Homepage") : resolvePageLabel(pageKey, { ...DEFAULT_PROPERTY_PAGES, ...(settings.pages ?? {}) as Record<string, PropertyPageConfig> }, locale)}
        description={canWrite ? (zh ? "先編輯內容，再切換到調整順序；儲存後更新網站。" : "Edit content, then switch to arranging sections. Saving updates the site.") : (zh ? "檢視目前的頁面內容與區塊。" : "View the current page content and sections.")}
        actions={
          <ButtonLink href={hasPermission(profile.permissions,"site_users:read") ? `/admin/sites/${params.id}` : "/admin/cms"} icon={<ArrowLeft />} variant="ghost">
            {zh ? "返回工作台" : "Back to workspace"}
          </ButtonLink>
        }
      />

      <AdminFlash
        closeLabel={copy.admin.adminFlashClose}
        message={searchParams.notice}
        title={copy.admin.adminFlashSuccess}
        tone="success"
      />
      <AdminFlash
        closeLabel={copy.admin.adminFlashClose}
        message={searchParams.error}
        title={copy.admin.adminFlashError}
        tone="error"
      />

      <AdminSiteProvider slug={site.slug} permissions={profile.permissions}>
      <PropertyBlockEditor
        action={updatePropertyPageAction}
        initialBlocks={initialBlocks}
        initialSeo={existingSeo}
        initialShowCmsList={showCmsList}
        initialLabel={existingLabel}
        initialHeroImage={existingHeroImage}
        initialHeroTitle={existingHeroTitle}
        initialHeroSubtitle={existingHeroSubtitle}
        initialHeroTitleColor={existingHeroTitleColor}
        initialHeroSubtitleColor={existingHeroSubtitleColor}
        initialHeroHeight={existingHeroHeight}
        initialHeroLayout={existingHeroLayout}
        locale={locale}
        site={site}
        contentTags={contentTags}
        pageKey={pageKey}
        canWrite={canWrite}
        /* Every save path here redirects on failure as well as on success, so
           the editor comes back holding the last SAVED page. This is the flag
           that tells it to put the rejected attempt back instead. */
        saveFailed={Boolean(searchParams.error)}
      />
      </AdminSiteProvider>
    </Page>
  );
}

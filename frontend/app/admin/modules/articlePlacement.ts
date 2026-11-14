import type { AdminPage, AdminSite } from "./adminApi";
import { contentFilterTags, hasContentFilterTag } from "../../modules/contentFilter";
import { siteContentTypesFromConfig } from "./siteContentTypes";
import { blockPurpose } from "./contentVocabulary";
import { listingCategoriesForPage, resolveSubTabs } from "../../modules/contentRoutes";

export type CollectionLocation = { key: string; pageKey: string; label: string; config: Record<string, unknown> };
export function siteCollections(site: AdminSite | undefined, zh: boolean): CollectionLocation[] {
  const settings = site?.settings ?? {};
  const pages = (settings.pages ?? {}) as Record<string, Record<string, unknown>>;
  const home = (settings.homepage ?? {}) as Record<string, unknown>;
  const result: CollectionLocation[] = [];
  const collect = (raw: unknown, pageKey: string) => {
    if (!Array.isArray(raw)) return;
    raw.forEach((block, index) => {
      if (!block || block.type !== "stays" || block.enabled === false) return;
      const config = block.config ?? {};
      if (!config.source || config.source === "stays") return;
      const key = `${pageKey}:${block.id ?? index}`;
      if (result.some((entry) => entry.key === key)) return;
      const pageLabel = pageKey === "homepage" ? (zh ? "首頁" : "Homepage") : localized(pages[pageKey]?.label, zh) || pageKey;
      result.push({ key, pageKey, label: `${pageLabel} / ${blockPurpose("stays", config, zh, zh ? "文章集合" : "Article collection")}`, config });
    });
  };
  collect(home.blocks ?? pages.homepage?.blocks ?? settings.homepage_blocks, "homepage");
  Object.entries(pages).forEach(([key, page]) => { if (key !== "homepage" && page.deleted !== true) collect(page.blocks, key); });
  return result;
}
export function localized(raw: unknown, zh: boolean): string {
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object") { const value = (raw as Record<string, unknown>)[zh ? "zh" : "en"]; return typeof value === "string" ? value : ""; }
  return "";
}
export function articleCategories(page: Pick<AdminPage, "content_type" | "categories">): string[] {
  return Array.from(new Set([page.content_type, ...(page.categories ?? [])].filter(Boolean))) as string[];
}
export function topicWords(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map(String).map(s => s.trim()).filter(Boolean) : typeof raw === "string" ? raw.split(/[,，、\n]/).map(s => s.trim()).filter(Boolean) : [];
}
/** Mirrors the public collection's per-source newest-first limit and manual order. */
export function collectedArticles(config: Record<string, unknown>, pages: AdminPage[], zh: boolean): AdminPage[] {
  const published = pages.filter(page => !page.deleted_at && page.status === "published");
  const ids = Array.isArray(config.picked_ids) ? config.picked_ids.map(Number).filter(Number.isFinite) : [];
  if (config.pick_mode === "manual" && ids.length) return ids.map(id => published.find(page => page.id === id)).filter(Boolean) as AdminPage[];
  const sources = Array.from(new Set([String(config.source ?? "stays"), ...(Array.isArray(config.extra_sources) ? config.extra_sources.map(String) : [])]));
  const filters = contentFilterTags(config);
  const parsedLimit = Number(config.limit ?? 6);
  const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.floor(parsedLimit)) : 6;
  const perSource = sources.flatMap(source => published.filter(page => articleCategories(page).includes(source)
    && (hasContentFilterTag(page.tags, filters) || hasContentFilterTag(topicWords(page.translations?.[zh ? "zh" : "en"]?.tags), filters)))
    .sort((a,b) => b.id - a.id).slice(0,limit));
  return Array.from(new Map(perSource.sort((a,b) => b.id - a.id).map(page => [page.id,page])).values());
}
export function articleCollectionPlacements(page: AdminPage, pages: AdminPage[], site: AdminSite | undefined, zh: boolean) {
  // Preview a draft as published without implying that it is already public.
  const candidates = pages.filter(item => item.id !== page.id).concat({...page,status:"published",deleted_at:null});
  return siteCollections(site,zh).filter(location => collectedArticles(location.config,candidates,zh).some(item => item.id === page.id));
}
export function listingFilterLocations(site: AdminSite | undefined, categories: string[], zh: boolean, aliases: string[] = []) {
  const pages = (site?.settings?.pages ?? {}) as Record<string, Record<string, unknown>>;
  const catalogue = siteContentTypesFromConfig(site);
  return Object.entries(pages).filter(([key,page]) => page.deleted !== true && page.show_tag_row !== false
    && listingCategoriesForPage(key,page).some(category => categories.includes(category))
    && (!resolveSubTabs(page.sub_tabs,zh ? "zh" : "en")?.length || resolveSubTabs(page.sub_tabs,zh ? "zh" : "en")!.some(tab => aliases.includes(tab.tag.trim().toLocaleLowerCase()))))
    .map(([key,page]) => localized(page.label,zh) || catalogue.find(item => item.pageKey === key)?.label[zh ? "zh" : "en"] || (zh ? "文章列表" : "Article listing"));
}

export function articleListingLocations(site: AdminSite | undefined, categories: string[], zh: boolean): string[] {
  const pages = (site?.settings?.pages ?? {}) as Record<string, Record<string, unknown>>;
  return Object.entries(pages)
    .filter(([pageKey, config]) => listingCategoriesForPage(pageKey, config).some(category => categories.includes(category)))
    .map(([pageKey, config]) => localized(config.label, zh) || pageKey);
}

import type { AdminContentTag, AdminPage, AdminSite } from "./adminApi";
import { siteContentTypesFromConfig } from "./siteContentTypes";
import { collectedArticles, listingFilterLocations, siteCollections } from "./articlePlacement";

const words = (raw: unknown): string[] => Array.isArray(raw) ? raw.map(String) : typeof raw === "string" ? raw.split(/[,，、\n]/).map((s) => s.trim()).filter(Boolean) : [];
const norm = (s: string) => s.trim().toLocaleLowerCase();

/** Only the current site's already-authorized records are passed here. */
export function tagUsage(tag: AdminContentTag, pages: AdminPage[], site?: AdminSite, zh = true, tags: AdminContentTag[] = []) {
  const aliases = [tag.slug, tag.name_zh, tag.name_en].filter(Boolean).map(norm);
  const matches = (raw: unknown) => words(raw).some((s) => aliases.includes(norm(s)));
  const activePages = pages.filter((page) => !page.deleted_at);
  const topicArticles = activePages.filter((page) => matches(page.tags) || Object.values(page.translations ?? {}).some((tr) => matches(tr.tags)));
  const cardArticles = activePages.filter((page) => Object.values(page.translations ?? {}).some((tr) => matches(tr.card_tags)));
  const relatedArticles = Array.from(new Map([...topicArticles, ...cardArticles].map((page) => [page.id, page])).values());
  const catalogue = siteContentTypesFromConfig(site);
  const placements = Array.from(new Set(topicArticles.flatMap((page) => [page.content_type, ...(page.categories ?? [])]).filter(Boolean))) as string[];
  const filterBlocks: string[] = [];
  const settings = site?.settings as Record<string, unknown> | undefined;
  const collect = (raw: unknown, place: string) => {
    if (!Array.isArray(raw)) return;
    for (const block of raw) {
      if (!block || typeof block !== "object" || block.enabled === false) continue;
      const cfg = block.config ?? {};
      if (matches(cfg.filter_tags) || matches(cfg.filter_tag)) filterBlocks.push(place);
      const sources = [cfg.source, ...(Array.isArray(cfg.extra_sources) ? cfg.extra_sources : [])];
      const filtersTopics = cfg.filter_by === "tags" || (cfg.filter_by !== "category" && sources.length === 1);
      if (filtersTopics && (cfg.show_filter === true || cfg.variant === "news") && topicArticles.some((page) => [page.content_type, ...(page.categories ?? [])].some((category) => sources.includes(category)))) filterBlocks.push(place);
    }
  };
  collect(settings?.homepage_blocks, "homepage");
  collect((settings?.homepage as Record<string, unknown> | undefined)?.blocks, "homepage");
  for (const [key, cfg] of Object.entries((settings?.pages ?? {}) as Record<string, Record<string, unknown>>)) {
    if (cfg.deleted !== true) collect(cfg.blocks, key);
  }
  const publicCollections = siteCollections(site,zh).filter(location => {
    const cfg = location.config;
    const multiple = Array.isArray(cfg.extra_sources) && cfg.extra_sources.length > 0;
    const topicFilter = cfg.filter_by === "tags" || (cfg.filter_by !== "category" && !multiple);
    return topicFilter && (cfg.show_filter === true || cfg.variant === "news") && collectedArticles(cfg,pages,zh).some(page => matches(page.tags) || matches(page.translations?.[zh ? "zh" : "en"]?.tags));
  });
  const publicListings = listingFilterLocations(site, topicArticles.filter(page => page.status === "published").flatMap(page => [page.content_type,...(page.categories ?? [])]).filter((key): key is string => Boolean(key)),zh,aliases);
  const duplicate = pages.some(page => !page.deleted_at && words(page.tags).filter(word => aliases.includes(norm(word))).length > 1);
  const namedAsPage = catalogue.some(entry => [entry.key,entry.label.zh,entry.label.en].some(name => aliases.includes(norm(name))));
  const sharedName = tags.some(other => other.id !== tag.id && [other.slug,other.name_zh,other.name_en].filter(Boolean).some(name => aliases.includes(norm(name))));
  const needsReview = /^\d+$/.test(tag.name_zh.trim()) || /^(test|測試)(\b|\d|$)/i.test(tag.name_zh.trim()) || duplicate || namedAsPage || sharedName;
  return { topicArticles, cardArticles, relatedArticles, placements, filterBlocks: Array.from(new Set(filterBlocks)), catalogue, publicCollections, publicListings, needsReview };
}

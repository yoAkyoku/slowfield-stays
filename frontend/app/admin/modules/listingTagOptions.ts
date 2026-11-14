import { tagKey, tagsT } from "../../modules/tr";

export type ListingArticle = {
  id: number;
  title: string;
  status: string;
  content_type: string;
  categories?: string[];
  deleted_at?: string | null;
  tags?: string[] | null;
  translations?: Record<string, Record<string, unknown>>;
};

/** Match the public listing's configured sources, independently of its URL. */
export function listingArticles(articles: ListingArticle[], config: Record<string, unknown>, pageKey: string): ListingArticle[] {
  const sources = Array.isArray(config.article_categories)
    ? config.article_categories
    : [String(config.content_type || pageKey), ...(Array.isArray(config.extra_content_types) ? config.extra_content_types : [])];
  return Array.from(new Map(articles.filter(article => article.status === "published" && !article.deleted_at
    && [article.content_type, ...(article.categories ?? [])].some(category => sources.includes(category)))
    .map(article => [article.id, article])).values());
}

export function matchingTagArticles(articles: ListingArticle[], tag: string, locale: "zh" | "en"): ListingArticle[] {
  const key = tagKey(tag);
  return key ? articles.filter(article => tagsT(article, locale).some(value => tagKey(value) === key)) : [];
}

export function listingTagOptions(articles: ListingArticle[]): Array<{ zh: string; en: string }> {
  const pairs = new Map<string, { zh: string; en: string }>();
  for (const article of articles) {
    const zh = tagsT(article, "zh");
    const en = tagsT(article, "en");
    for (let i = 0; i < Math.max(zh.length, en.length); i++) {
      const z = zh[i] ?? en[i] ?? "";
      const e = en[i] ?? zh[i] ?? "";
      if (z && !pairs.has(tagKey(z))) pairs.set(tagKey(z), { zh: z, en: e });
    }
  }
  return Array.from(pairs.values()).sort((a, b) => a.zh.localeCompare(b.zh, "zh"));
}

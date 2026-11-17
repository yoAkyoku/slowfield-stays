import type { Page } from "../api";
import { buildContentHref, CONTENT_TYPE_TO_CATEGORY } from "../contentRoutes";
import type { Locale } from "../i18n";
import { cardTagsT, trs } from "../tr";
import { ContentCard } from "../content/cards";

const SECTION_LABELS: Record<string, { en: string; zh: string }> = {
  activity: { en: "Recommended Activities", zh: "推薦景點" },
  news: { en: "Latest News", zh: "最新消息" },
  journal: { en: "Travel Journal", zh: "慢域旅誌" },
  experience: { en: "Curated Experiences", zh: "慢域體驗" },
  dining: { en: "Dining", zh: "餐飲推薦" },
  brand: { en: "Brand Stories", zh: "品牌故事" }
};

export default function StayRelatedContent({
  pages,
  locale
}: {
  pages: Page[];
  locale: Locale;
}) {
  if (pages.length === 0) return null;

  // Group by content_type
  const groups = new Map<string, Page[]>();
  for (const page of pages) {
    const ct = page.content_type || "page";
    if (!groups.has(ct)) groups.set(ct, []);
    groups.get(ct)!.push(page);
  }

  return (
    <section className="stay-related-section">
      {Array.from(groups.entries()).map(([ct, items]) => {
        const label = SECTION_LABELS[ct]?.[locale] || CONTENT_TYPE_TO_CATEGORY[ct] || ct;
        return (
          <div key={ct} className="stay-related-group">
            <h3 className="stay-related-heading">{label}</h3>
            <div className="stay-related-grid">
              {items.slice(0, 4).map((page) => (
                <ContentCard
                  key={page.id}
                  heading="h4"
                  href={buildContentHref(page)}
                  title={trs(page, "title", locale)}
                  summary={trs(page, "summary", locale)}
                  cover={page.cover_image_url}
                  meta={cardTagsT(page, locale)[0] || label}
                  placeholder={label}
                />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

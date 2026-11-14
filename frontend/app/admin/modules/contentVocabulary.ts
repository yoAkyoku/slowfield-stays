/** Public placement, reusable topics and visible labels are separate decisions. */
export const contentVocabulary = {
  zh: {
    category: "文章分類", categoryHelp: "選擇文章所屬分類，可複選；前台列表頁依收錄分類顯示文章。",
    topic: "主題標籤", topicHelp: "描述文章主題，供搜尋與前台篩選使用。",
    card: "卡片顯示標籤", cardHelp: "從文章標籤選擇卡片上要顯示的文字；留白表示不顯示。",
  },
  en: {
    category: "Article categories", categoryHelp: "Choose one or more categories. Website listing pages include articles from their selected categories.",
    topic: "Topic tags", topicHelp: "Describe the article's topics for search and public filters.",
    card: "Card labels", cardHelp: "Choose the article tags printed on cards. An empty selection hides labels.",
  },
};

export function blockPurpose(type: string, config: Record<string, unknown>, zh: boolean, fallback: string): string {
  for (const key of ["headline", "title", "heading"]) {
    const raw = config[key];
    const text = typeof raw === "string" ? raw : raw && typeof raw === "object" ? (raw as Record<string, unknown>)[zh ? "zh" : "en"] : "";
    if (typeof text === "string" && text.trim()) return text.trim().replace(/\s+/g, " ");
  }
  const names: Record<string, [string, string]> = {
    hero: ["首頁主視覺", "Hero image"], search: ["住宿搜尋", "Stay search"],
    about: ["品牌故事", "Brand story"], newsletter: ["電子報訂閱", "Newsletter signup"],
    map: ["地圖與位置", "Map and location"],
  };
  if (type === "stays" && config.source === "stays") return zh ? "慢域旅宿" : "Selected stays";
  if (type === "stays") {
    const sources: Record<string,[string,string]> = {news:["最新消息","News"],journal:["慢域旅誌","Journal"],experience:["慢域體驗","Experiences"],dining:["慢域饗宴","Dining"],media:["媒體報導","Press"],curation:["慢域選物","Curation"]};
    return sources[String(config.source)]?.[zh ? 0 : 1] ?? (zh ? "文章集合" : "Article collection");
  }
  return names[type]?.[zh ? 0 : 1] ?? fallback;
}

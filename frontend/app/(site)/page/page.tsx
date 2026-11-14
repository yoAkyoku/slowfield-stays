import { getCurrentSite } from "../../modules/api";
import ContentListPage from "../../modules/content/ContentListPage";
import { getLocale } from "../../modules/i18n";
import { buildMetadata, pageSettingsSeo } from "../../modules/seo";

/* Shared by the metadata and the page body: this index had a title but no
   description of its own, so it inherited the site-wide one and read as a
   duplicate of every other listing page. */
const COPY = {
  zh: { title: "一般頁面", intro: "瀏覽所有一般 CMS 內容頁。", empty: "目前沒有一般頁面內容。" },
  en: { title: "Pages", intro: "Browse all general CMS content pages.", empty: "No general pages yet." },
};

export async function generateMetadata() {
  const locale = await getLocale();
  const site = await getCurrentSite();
  const copy = COPY[locale === "zh" ? "zh" : "en"];
  const override = pageSettingsSeo(site, "page", locale);
  return buildMetadata({
    title: override.title || copy.title,
    description: override.description || copy.intro,
    image: override.image,
    noIndex: override.noIndex,
    canonical: override.canonical,
    path: "/page",
    site
  });
}

export default async function GenericPageIndex() {
  return <ContentListPage contentType="page" copyOverride={COPY[(await getLocale()) === "zh" ? "zh" : "en"]} />;
}

import { getCurrentSite } from "../../modules/api";
import ContentListPage from "../../modules/content/ContentListPage";
import { getLocale, publicUiText } from "../../modules/i18n";
import { buildMetadata, pageSettingsSeo } from "../../modules/seo";
import { isServableThroughSiteOverride } from "../../modules/siteVisibility";
import { isAdminPreview } from "../../modules/adminPreview";

/* Shared by the metadata and the page body: the description a crawler is shown
   used to be the site-wide default, so this index was indistinguishable from
   every other listing page. One source keeps them from drifting apart. */
const COPY = {
  zh: { title: "隱私政策", intro: "查看所有隱私與資料使用相關頁面。", empty: "目前沒有隱私相關內容。" },
  en: { title: "Privacy", intro: "Browse privacy and data usage pages.", empty: "No privacy pages yet." },
};

export async function generateMetadata() {
  const locale = await getLocale();
  const site = await getCurrentSite();
  // Route metadata runs outside the layout's ?site= gate; a draft villa reached
  // through the override must not leak its content here either.
  if (!isServableThroughSiteOverride(site) && !(await isAdminPreview())) {
    return buildMetadata({ title: publicUiText(locale).notFound, noIndex: true, path: "/privacy" });
  }
  const copy = COPY[locale === "zh" ? "zh" : "en"];
  const override = pageSettingsSeo(site, "privacy", locale);
  return buildMetadata({
    title: override.title || copy.title,
    description: override.description || copy.intro,
    image: override.image,
    noIndex: override.noIndex,
    canonical: override.canonical,
    path: "/privacy",
    site
  });
}

export default async function PrivacyPage() {
  return <ContentListPage contentType="privacy" copyOverride={COPY[(await getLocale()) === "zh" ? "zh" : "en"]} />;
}

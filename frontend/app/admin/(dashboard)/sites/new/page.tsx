import { getLocale, t } from "../../../../modules/i18n";
import { getAdminSites } from "../../../modules/adminApi";
import NewSiteForm from "./NewSiteForm";

export default async function NewSitePage(props: { searchParams: Promise<{ error?: string }> }) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();
  const copyZh = t("zh");
  const copyEn = t("en");
  const sites = await getAdminSites();

  return (
    <NewSiteForm
      searchParams={searchParams}
      copyZh={copyZh}
      copyEn={copyEn}
      sites={sites}
      initialLocale={locale}
    />
  );
}
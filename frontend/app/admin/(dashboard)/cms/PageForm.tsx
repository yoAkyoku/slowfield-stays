import { ArrowLeft } from "lucide-react";
import { ButtonLink, Page, PageHeader } from "../../ui";
import "./cms.css";
import { getAdminProfile, hasPermission, type AdminContentTag, type AdminPage, type AdminSite } from "../../modules/adminApi";
import { adminUiText, getLocale, t } from "../../../modules/i18n";
import { AdminFlashes } from "../../modules/AdminFlash";
import PageFormEditor from "./PageFormEditor";

export default async function PageForm({
  action,
  deleteAction,
  flash,
  isDeleted,
  page,
  restoreAction,
  returnTo,
  stays,
  submitLabel,
  title,
  siteContentTypes,
  siteDefaultLocale,
  contentTags,
  site,
  allPages,
}: {
  action: (formData: FormData) => void;
  deleteAction?: (formData: FormData) => void;
  flash?: { error?: string; notice?: string };
  isDeleted?: boolean;
  page?: AdminPage | null;
  restoreAction?: (formData: FormData) => void;
  returnTo: string;
  stays?: { id: number; name: string; destination: string; hero_image_url: string }[];
  submitLabel?: string;
  title: string;
  siteContentTypes?: Array<{ key: string; label: { zh: string; en: string } }>;
  /** The site's `default_locale`. Decides which locale slot the page's canonical
   *  title/body belong to — see PageFormEditor. */
  siteDefaultLocale?: string;
  contentTags?: AdminContentTag[];
  site?: AdminSite;
  allPages?: AdminPage[];
}) {
  const locale = await getLocale();
  const canWrite = hasPermission((await getAdminProfile()).permissions,"cms:write");
  const copy = t(locale);
  const ui = adminUiText(locale);
  const copyZh = t("zh");
  const copyEn = t("en");
  const uiZh = adminUiText("zh");
  const uiEn = adminUiText("en");

  const errorMessage = (() => {
    if (!flash?.error) return undefined;
    if (flash.error.includes("Page requires body")) return copy.admin.qualityMissingBody;
    return flash.error;
  })();

  return (
    <Page>
      <PageHeader
        eyebrow={locale === "zh" ? "文章" : "Article"}
        title={canWrite ? title : locale === "zh" ? "檢視文章" : "View article"}
        description={canWrite ? (locale === "zh" ? "選擇文章分類、撰寫內容，再預覽與發布文章。" : "Choose placement, write content, then preview and publish your article.") : (locale === "zh" ? "目前帳號可查看內容與預覽；修改和發布需編輯權限。" : "You can view content and previews. Editing and publishing require editor access.")}
        actions={
          <ButtonLink href="/admin/cms" icon={<ArrowLeft />} variant="ghost">
            {copy.admin.adminBackToCms}
          </ButtonLink>
        }
      />
      <AdminFlashes notice={flash?.notice} error={errorMessage} copy={copy.admin} />
      <PageFormEditor
        action={action}
        saveFailed={Boolean(flash?.error)}
        canWrite={canWrite}
        deleteAction={canWrite ? deleteAction : undefined}
        isDeleted={isDeleted}
        locale={locale}
        siteDefaultLocale={siteDefaultLocale}
        page={page}
        restoreAction={canWrite ? restoreAction : undefined}
        returnTo={returnTo}
        stays={stays}
        submitLabel={submitLabel}
        title={title}
        copy={copy}
        ui={ui}
        copyZh={copyZh}
        copyEn={copyEn}
        uiZh={uiZh}
        uiEn={uiEn}
        siteContentTypes={siteContentTypes}
        contentTags={contentTags}
        site={site}
        allPages={allPages}
      />
    </Page>
  );
}

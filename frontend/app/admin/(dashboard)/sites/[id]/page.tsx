import { AdminSiteProvider } from "../../../modules/AdminSiteContext";
import { ArrowLeft } from "lucide-react";
import { ButtonLink, Page, PageHeader } from "../../../ui";
import "../sites.css";
import { notFound } from "next/navigation";
import { getLocale, t } from "../../../../modules/i18n";
import { AdminForbiddenError, getAdminPagesAll, getAdminProfile, getAdminSite, getAdminSiteUsers, hasPermission } from "../../../modules/adminApi";
import AdminSopButton from "../../../modules/AdminSopButton";
import { updateSiteAction } from "../../../modules/siteActions";
import { SetAdminSiteCookie } from "../../../modules/SetAdminSiteCookie";
import SitePageEditor from "./SitePageEditor";
import AdminAccessNotice from "../../../modules/AdminAccessNotice";

export default async function SiteEditPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ error?: string; notice?: string; _t?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const site = await getAdminSite(params.id);
  if (!site) notFound();
  const profile = await getAdminProfile(site.slug);
  const [siteUsers,sitePages] = await Promise.all([
    hasPermission(profile.permissions,"site_users:read") ? getAdminSiteUsers(params.id) : Promise.resolve([]),
    hasPermission(profile.permissions,"cms:read") ? getAdminPagesAll("active",site.slug) : Promise.resolve([]),
  ]);

  if (!hasPermission(profile.permissions, "site_users:read")) {
    throw new AdminForbiddenError();
  }

  if (!site) {
    notFound();
  }

  const locale = await getLocale();
  const i18nCopy = t(locale);

  // Placeholder copy data
  const defaultCopy = {
    admin: {
      adminFlashClose: "Close",
      adminFlashSuccess: "Success",
      adminFlashError: "Error",
      adminAddedToMedia: "Added to media library",
      adminUploadFailed: "Upload failed",
      adminLoadingLibrary: "Loading library...",
      adminNoLibraryImages: "No images in library",
      adminSelectFromLibrary: "Select from library",
      adminUseThisImage: "Use this image",
      adminUploadFromComputer: "Upload from computer",
      adminUploading: "Uploading...",
      adminHeroImageUrl: "Hero image URL",
      statusLabels: {
        active: "Active",
        draft: "Draft",
        archived: "Archived"
      }
    }
  };

  const defaultCopyZh = {
    admin: {
      adminFlashClose: "關閉",
      adminFlashSuccess: "成功",
      adminFlashError: "錯誤",
      adminAddedToMedia: "已添加到媒體庫",
      adminUploadFailed: "上傳失敗",
      adminLoadingLibrary: "加載庫...",
      adminNoLibraryImages: "庫中沒有圖像",
      adminSelectFromLibrary: "從庫中選擇",
      adminUseThisImage: "使用此圖像",
      adminUploadFromComputer: "從計算機上傳",
      adminUploading: "上傳中...",
      adminHeroImageUrl: "Hero 圖像 URL",
      statusLabels: {
        active: "活躍",
        draft: "草稿",
        archived: "已歸檔"
      }
    }
  };

  const copy = defaultCopy;
  const copyZh = defaultCopyZh;
  const copyEn = defaultCopy;

  return (
    <Page width="wide">
      <AdminAccessNotice permissions={profile.permissions} zh={locale === "zh"} siteName={site.name} siteId={site.id} target />
      <SetAdminSiteCookie slug={site.slug} parentSiteId={site.parent_site_id} />

      <PageHeader
        eyebrow={site.parent_site_id ? (locale === "zh" ? "子站設定" : "Child site") : (locale === "zh" ? "母站設定" : "Root site")}
        title={site.name || (locale === "zh" ? `網站 #${params.id}` : `Site #${params.id}`)}
        description={i18nCopy.admin.adminEditSiteText}
        actions={
          <>
            <AdminSopButton label={i18nCopy.admin.adminEditSiteGuideTitle}>
              <ol>
                {i18nCopy.admin.adminEditSiteGuideSteps.map(([step, title, text]) => (
                  <li key={step}>
                    <strong>{title}</strong>
                    <p>{text}</p>
                  </li>
                ))}
              </ol>
            </AdminSopButton>
            <ButtonLink href="/admin/sites" icon={<ArrowLeft />} variant="ghost">
              {i18nCopy.admin.adminBackToSites}
            </ButtonLink>
          </>
        }
      />

      <AdminSiteProvider slug={site.slug} permissions={profile.permissions}>
      <SitePageEditor
        action={updateSiteAction}
        siteId={params.id}
        site={site}
        profile={profile}
        siteUsers={siteUsers}
        sitePages={sitePages}
        copy={copy}
        copyZh={copyZh}
        copyEn={copyEn}
        flash={{
          error: searchParams.error,
          notice: searchParams.notice,
          nonce: searchParams._t,
        }}
        returnTo="/admin/sites"
      />
      </AdminSiteProvider>
    </Page>
  );
}

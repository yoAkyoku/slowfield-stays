import { ArrowLeft } from "lucide-react";
import { ButtonLink, Page, PageHeader } from "../../ui";
import "./cms.css";
import type { Banner } from "../../../modules/api";
import { getLocale, t } from "../../../modules/i18n";
import AdminFlash from "../../modules/AdminFlash";
import BannerFormEditor from "./BannerFormEditor";
import { getAdminProfile, hasPermission } from "../../modules/adminApi";

export default async function BannerForm({
  action,
  banner,
  deleteAction,
  flash,
  isDeleted,
  restoreAction,
  returnTo,
  submitLabel,
  title
}: {
  action: (formData: FormData) => void;
  banner?: Partial<Banner> | null;
  deleteAction?: (formData: FormData) => void;
  flash?: { error?: string; notice?: string };
  isDeleted?: boolean;
  restoreAction?: (formData: FormData) => void;
  returnTo: string;
  submitLabel?: string;
  title: string;
}) {
  const locale = await getLocale();
  const canWrite = hasPermission((await getAdminProfile()).permissions,"cms:write");
  const copy = t(locale);

  const errorMessage = (() => {
    if (!flash?.error) return undefined;
    if (flash.error.includes("Banner requires an image")) return copy.admin.qualityMissingImage;
    return flash.error;
  })();

  return (
    <Page>
      <PageHeader
        eyebrow={locale === "zh" ? "首頁橫幅" : "Homepage banner"}
        title={canWrite ? title : locale === "zh" ? "檢視首頁橫幅" : "View homepage banner"}
        description={copy.admin.cmsText}
        actions={
          <ButtonLink href="/admin/cms" icon={<ArrowLeft />} variant="ghost">
            {copy.admin.adminBackToCms}
          </ButtonLink>
        }
      />
      <AdminFlash
        closeLabel={copy.admin.adminFlashClose}
        message={flash?.notice}
        title={copy.admin.adminFlashSuccess}
        tone="success"
      />
      <AdminFlash
        closeLabel={copy.admin.adminFlashClose}
        message={errorMessage}
        title={copy.admin.adminFlashError}
        tone="error"
      />
      <BannerFormEditor
        action={action}
        banner={banner}
        canWrite={canWrite}
        deleteAction={canWrite ? deleteAction : undefined}
        isDeleted={isDeleted}
        locale={locale}
        restoreAction={canWrite ? restoreAction : undefined}
        returnTo={returnTo}
        submitLabel={submitLabel}
        title={title}
        copy={copy}
      />
    </Page>
  );
}

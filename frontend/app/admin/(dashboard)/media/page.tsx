import { Film, Images, Layers } from "lucide-react";
import { getLocale, t } from "../../../modules/i18n";
import { getAdminMediaOverview, getAdminProfile, hasPermission } from "../../modules/adminApi";
import AdminSopButton from "../../modules/AdminSopButton";
import AdminFlash from "../../modules/AdminFlash";
import { Grid, Page, PageHeader, StatCard } from "../../ui";
import MediaLibraryView from "./MediaLibraryView";
import MediaUploadModal from "./MediaUploadModal";
import "./media.css";

export default async function AdminMediaPage(
  props: {
    searchParams: Promise<{ error?: string; notice?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();
  const copy = t(locale);
  const [overview, profile] = await Promise.all([
    getAdminMediaOverview(48),
    getAdminProfile(),
  ]);
  const { media, summary } = overview;
  const canWrite = hasPermission(profile.permissions, "media:write");

  return (
    <Page>
      <PageHeader
        title={copy.admin.mediaTitle}
        help={
          <AdminSopButton label={copy.admin.mediaWorkflowTitle}>
            <ol>
              {copy.admin.mediaWorkflowSteps.map(([step, title, text]) => (
                <li key={step}>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
          </AdminSopButton>
        }
        description={copy.admin.mediaText}
        actions={
          canWrite ? (
            <MediaUploadModal
              copy={{
                mediaUploadTitle: copy.admin.mediaUploadTitle,
                mediaUploadText: copy.admin.mediaUploadText,
                mediaUploadAction: copy.admin.mediaUploadAction,
                mediaUploadStart: copy.admin.mediaUploadStart,
                mediaUploading: copy.admin.mediaUploading,
                mediaUploadProgress: copy.admin.mediaUploadProgress,
                mediaUploadDone: copy.admin.mediaUploadDone,
                mediaUploadError: copy.admin.mediaUploadError,
                mediaUploadDragHint: copy.admin.mediaUploadDragHint,
                mediaUploadMinimized: copy.admin.mediaUploadMinimized,
              }}
            />
          ) : null
        }
      />
      <AdminFlash
        closeLabel={copy.admin.adminFlashClose}
        message={searchParams.notice}
        title={copy.admin.adminFlashSuccess}
        tone="success"
      />
      <AdminFlash
        closeLabel={copy.admin.adminFlashClose}
        message={searchParams.error}
        title={copy.admin.adminFlashError}
        tone="error"
      />

      <Grid cols={3}>
        <StatCard icon={<Layers />} label={copy.admin.mediaTotalAssets} tone="brand" value={summary.total} />
        <StatCard icon={<Images />} label={copy.admin.mediaImages} tone="info" value={summary.images} />
        <StatCard icon={<Film />} label={copy.admin.mediaVideos} tone="neutral" value={summary.videos} />
      </Grid>

      <MediaLibraryView
        media={media}
        totalCount={summary.total}
        imageCount={summary.images}
        videoCount={summary.videos}
        copy={copy.admin}
        canWrite={canWrite}
        zh={locale === "zh"}
      />
    </Page>
  );
}

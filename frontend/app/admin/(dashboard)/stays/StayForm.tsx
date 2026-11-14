import { ArrowLeft } from "lucide-react";
import type { Stay } from "../../../modules/api";
import { getLocale, t } from "../../../modules/i18n";
import { getAdminSites, getCurrentAdminSiteSlug } from "../../modules/adminApi";
import { experienceOptions, serviceOptions, type SearchOpt } from "../../../modules/searchOptions";
import AdminFlash from "../../modules/AdminFlash";
import { ButtonLink, Page, PageHeader } from "../../ui";
import StayEditor from "./StayEditor";

type StayFormValue = Partial<Stay & { status: string }>;

type EditorSearchOpt = SearchOpt & {
  labels: { zh: string; en: string };
};

/** Keep both display labels with each canonical value for StayEditor's
 * client-side language toggle. */
function editorSearchOptions(
  current: SearchOpt[],
  zhOptions: SearchOpt[],
  enOptions: SearchOpt[],
): EditorSearchOpt[] {
  return current.map((option) => ({
    ...option,
    labels: {
      zh: zhOptions.find((candidate) => candidate.value === option.value)?.label || option.label,
      en: enOptions.find((candidate) => candidate.value === option.value)?.label || option.label,
    },
  }));
}

export default async function StayForm({
  action,
  deleteAction,
  flash,
  isDeleted,
  restoreAction,
  returnTo,
  stay,
  title,
  subtitle
}: {
  action: (formData: FormData) => void;
  deleteAction?: (formData: FormData) => void;
  flash?: { error?: string; notice?: string };
  isDeleted?: boolean;
  restoreAction?: (formData: FormData) => void;
  returnTo: string;
  stay?: StayFormValue | null;
  title: string;
  subtitle: string;
}) {
  const locale = await getLocale();
  const copy = t(locale);
  const zh = locale === "zh";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const statusLabels = (copy.admin.statusLabels ?? {}) as Record<string, string>;

  // The 服務設施 tick list comes from the site's own search settings, so adding
  // a filter option in 站點設定 makes it tickable here. It used to be a list
  // hardcoded in the editor, which meant a new filter option could never be
  // ticked on any villa and therefore always returned nothing.
  const sites = await getAdminSites();
  const currentSlug = await getCurrentAdminSiteSlug();
  const site = sites.find((s) => s.slug === currentSlug) ?? sites[0] ?? null;
  const settings = site?.settings as Record<string, unknown> | undefined;
  const facilityOptions = editorSearchOptions(
    serviceOptions(locale, settings),
    serviceOptions("zh", settings),
    serviceOptions("en", settings),
  );
  const managedExperienceOptions = editorSearchOptions(
    experienceOptions(locale, settings),
    experienceOptions("zh", settings),
    experienceOptions("en", settings),
  );

  const errorMessage = (() => {
    if (!flash?.error) return undefined;
    if (flash.error.includes("hero image")) return copy.admin.qualityMissingHero;
    if (flash.error.includes("summary")) return copy.admin.qualityMissingSummary;
    if (flash.error.includes("room type")) return copy.admin.qualityMissingRooms;
    return flash.error;
  })();

  const heroLabels = {
    added: copy.admin.adminAddedToMedia,
    failed: copy.admin.adminUploadFailed,
    imageUrl: copy.admin.adminHeroImageUrl,
    loadingLibrary: copy.admin.adminLoadingLibrary,
    noLibraryImages: copy.admin.adminNoLibraryImages,
    selectFromLibrary: copy.admin.adminSelectFromLibrary,
    useThisImage: copy.admin.adminUseThisImage,
    upload: copy.admin.adminUploadFromComputer,
    uploading: copy.admin.adminUploading
  };

  return (
    <Page>
      <PageHeader
        actions={
          <ButtonLink href="/admin/stays" icon={<ArrowLeft />}>
            {copy.admin.adminBackToStays}
          </ButtonLink>
        }
        description={subtitle}
        title={title}
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
      <StayEditor
        action={action}
        saveFailed={Boolean(flash?.error)}
        copy={copy.admin as unknown as Record<string, unknown>}
        deleteAction={deleteAction}
        heroLabels={heroLabels}
        isDeleted={isDeleted}
        restoreAction={restoreAction}
        returnTo={returnTo}
        siteUrl={siteUrl}
        stay={stay}
        facilityOptions={facilityOptions}
        experienceOptions={managedExperienceOptions}
        statusLabels={statusLabels}
        title={title}
        subtitle={subtitle}
        zh={zh}
      />
    </Page>
  );
}

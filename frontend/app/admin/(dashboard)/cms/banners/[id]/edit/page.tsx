import { notFound } from "next/navigation";
import { getLocale, t } from "../../../../../../modules/i18n";
import { getAdminBanner } from "../../../../../modules/adminApi";
import { deleteBannerAction, restoreBannerAction, updateBannerAction } from "../../../../../modules/cmsActions";
import BannerForm from "../../../BannerForm";

export default async function EditBannerPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ error?: string; notice?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const copy = t(await getLocale());
  const banner = await getAdminBanner(params.id);

  if (!banner) {
    notFound();
  }

  return (
    <BannerForm
      action={updateBannerAction.bind(null, params.id)}
      banner={banner}
      deleteAction={deleteBannerAction.bind(null, params.id, `/admin/cms/banners/${params.id}/edit`)}
      flash={searchParams}
      isDeleted={Boolean(banner?.deleted_at)}
      restoreAction={restoreBannerAction.bind(null, params.id, `/admin/cms/banners/${params.id}/edit`)}
      returnTo={`/admin/cms/banners/${params.id}/edit`}
      submitLabel={copy.admin.adminSaveBanner}
      title={copy.admin.adminEditBanner}
    />
  );
}

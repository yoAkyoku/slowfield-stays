import { getLocale, t } from "../../../../../modules/i18n";
import { createBannerAction } from "../../../../modules/cmsActions";
import BannerForm from "../../BannerForm";

export default async function NewBannerPage(props: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const searchParams = await props.searchParams;
  const copy = t(await getLocale());

  return (
    <BannerForm
      action={createBannerAction}
      flash={searchParams}
      returnTo="/admin/cms/banners/new"
      title={copy.admin.adminCreateBanner}
    />
  );
}

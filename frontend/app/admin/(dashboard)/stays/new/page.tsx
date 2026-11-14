import { getLocale, t } from "../../../../modules/i18n";
import { createStayAction } from "../../../modules/stayActions";
import StayForm from "../StayForm";

export default async function NewStayPage(props: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const searchParams = await props.searchParams;
  const copy = t(await getLocale());
  return (
    <StayForm
      action={createStayAction}
      flash={searchParams}
      returnTo="/admin/stays/new"
      title={copy.admin.adminCreateStay}
      subtitle={copy.admin.adminCreateStaySubtitle}
    />
  );
}

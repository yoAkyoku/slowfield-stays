import { getLocale, t } from "../../../../../modules/i18n";
import { getAdminStay } from "../../../../modules/adminApi";
import { deleteStayAction, restoreStayAction, updateStayAction } from "../../../../modules/stayActions";
import StayForm from "../../StayForm";

export default async function EditStayPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ error?: string; notice?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const stay = await getAdminStay(params.id);
  const copy = t(await getLocale());

  return (
    <StayForm
      action={updateStayAction.bind(null, params.id)}
      deleteAction={deleteStayAction.bind(null, params.id, `/admin/stays/${params.id}/edit`)}
      flash={searchParams}
      isDeleted={Boolean(stay?.deleted_at)}
      restoreAction={restoreStayAction.bind(null, params.id, `/admin/stays/${params.id}/edit`)}
      returnTo={`/admin/stays/${params.id}/edit`}
      stay={stay}
      title={copy.admin.adminEditStay}
      subtitle={copy.admin.adminEditStaySubtitle}
    />
  );
}

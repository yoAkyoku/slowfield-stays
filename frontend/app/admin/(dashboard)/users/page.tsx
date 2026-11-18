import { Search, UserCheck, UserPlus, UserX } from "lucide-react";
import { getLocale, t } from "../../../modules/i18n";
import { roleLabel } from "../../../modules/roleLabel";
import { getAdminProfile, getAdminRoles, getAdminUsers, hasPermission, type AdminUser } from "../../modules/adminApi";
import { AdminFlashes } from "../../modules/AdminFlash";
import AdminSopButton from "../../modules/AdminSopButton";
import AdminTable from "../../modules/AdminTable";
import AdminTablePagination from "../../modules/AdminTablePagination";
import { getPageSlice } from "../../modules/paginationUtils";
import ConfirmSubmitButton from "../../modules/ConfirmSubmitButton";
import DeletedBadge from "../../modules/DeletedBadge";
import StatusBadge from "../../modules/StatusBadge";
import SubmitButton from "../../modules/SubmitButton";
import UserPermissionLink from "./UserPermissionLink";
import UserRoleEditor from "./UserRoleEditor";
import { Badge, Button, ButtonLink, Card, Chips, Grid, Page, PageHeader, RowActions, SearchInput, Select, StatCard, Toolbar, buttonClass } from "../../ui";
import {
  deleteAdminUserAction,
  purgeAdminUserAction,
  restoreAdminUserAction,
  updateAdminUserRoleAction,
  updateAdminUserStatusAction
} from "../../modules/userActions";
import { formatDateTime } from "../../../modules/datetime";
import { grantedPermissionGroups } from "../../modules/permissionGroups";

/** For the tables that are not `roleLabels` — permission keys like
 *  `sites:read`, which have their own tables and are not role names. */
/**
 * 超級管理者 by what the role can DO, never by what it is called.
 *
 * `roleLabels` maps "super_admin" AND "owner" to the same two words, and a
 * bespoke role can be given "*" from the 角色 screen — so a check by name reads
 * the owner as nobody. `_super_admin_role_ids` on the server counts the same
 * way, and the two have to agree or this screen offers a button the API
 * refuses. See test_an_owner_counts_as_another_super_admin.
 */
function isSuperAdmin(user: { permissions?: string[] }) {
  return (user.permissions ?? []).includes("*");
}

/**
 * True when deleting *user* would leave the network with nobody to administer it.
 *
 * The mirror of `_is_last_super_admin`: an account that is 停用 or already in
 * 已刪除 is not cover, because neither can sign in, and reactivating one is
 * itself super-admin work. `others` is the live list the page already loaded —
 * `visibility=active`, so every row in it is a non-deleted account.
 */
function isLastSuperAdmin(user: AdminUser, others: AdminUser[]) {
  if (!isSuperAdmin(user)) return false;
  return !others.some(
    (other) => other.id !== user.id && isSuperAdmin(other) && other.status === "active" && !other.deleted_at
  );
}

/**
 * Why the API would refuse 刪除 on this row, or "" when it would not.
 *
 * The server is still the authority — it re-checks both of these and its answer
 * is what the flash shows. This is here so the screen does not put up a button
 * whose only possible outcome is an error dialog, which is how an operator
 * learns to distrust the whole column.
 */
function deleteRefusal(user: AdminUser, others: AdminUser[], callerId: number): "" | "last" | "self" {
  if (user.id === callerId) return "self";
  if (isLastSuperAdmin(user, others)) return "last";
  return "";
}

/** Keep the empty row honest about whether the list is truly empty or filtered out. */
function getAdminUsersEmptyState(locale: string, showDeleted: boolean, hasFilters: boolean): [string, string] {
  const zh = locale === "zh";
  if (hasFilters) {
    return showDeleted
      ? zh
        ? ["找不到符合條件的已刪除帳號", "請調整關鍵字，或清除篩選條件。"]
        : ["No deleted accounts match", "Change the keyword or clear the filter."]
      : zh
        ? ["沒有符合條件的帳號", "請調整關鍵字或狀態，或按「重設」清除篩選。"]
        : ["No accounts match", "Change the keyword or status, or reset the filters."];
  }
  return showDeleted
    ? zh
      ? ["「已刪除」中沒有帳號", "從列表刪除的管理員帳號會收在這裡，可以復原或永久刪除。"]
      : ["Nothing in the deleted list", "Admin accounts deleted from the list are kept here, to restore or delete for good."]
    : zh
      ? ["尚未有管理員帳號", "新增第一個管理員，並確認角色與站台權限。"]
      : ["No admin users yet", "Create the first admin account, then confirm its role and site access."];
}
export default async function AdminUsersPage(
  props: {
    searchParams: Promise<{ error?: string; keyword?: string; notice?: string; page?: string; status?: string; visibility?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();
  const copy = t(locale);
  const zh = locale === "zh";
  /* 已刪除 is its own view rather than a row state mixed into the list, and it
     rides on the 狀態 control the same way 表單聯絡's does — as a separate link
     it wrapped onto its own row and read as a stray button. `visibility=deleted`
     is honoured too so the redirect targets in userActions.ts and any bookmark
     keep working. */
  const showDeleted = searchParams.status === "deleted" || searchParams.visibility === "deleted";
  const visibility = showDeleted ? "deleted" : "active";
  /* "deleted" names a view, not an account status, so it must not also narrow
     the list — every row in the bin is 啟用 or 停用 and would fail the filter. */
  const statusFilter = searchParams.status === "deleted" ? "" : (searchParams.status ?? "");
  const [users, roles, profile] = await Promise.all([getAdminUsers(visibility), getAdminRoles(), getAdminProfile()]);
  const canWrite = hasPermission(profile.permissions, "global_users:write");
  const canChangeSiteRoles = hasPermission(profile.permissions, "site_users:write");
  /* 刪除 / 復原 / 永久刪除 are super-admin work and nothing less — the routes ask
     `_is_super_admin`, not the permission on their own gate, precisely because
     `global_users:write` is grantable to a bespoke role from the 角色 screen.
     `hasPermission(…, "global_users:write")` is true for that role, so it is
     not the question to ask here: /auth/me answers ["*"] for a super-admin and
     for nobody else. */
  const canRemove = (profile.permissions ?? []).includes("*");
  const deletedLabel = zh ? "已刪除" : "Deleted";
  const keyword = searchParams.keyword?.trim().toLowerCase() ?? "";
  const rows = users
    .filter((user) => !statusFilter || user.status === statusFilter)
    .filter((user) => {
      if (!keyword) return true;
      return [user.name, user.email, user.role, ...(user.permissions ?? [])].join(" ").toLowerCase().includes(keyword);
    });
  const emptyTable = getAdminUsersEmptyState(locale, showDeleted, Boolean(searchParams.keyword?.trim() || statusFilter));
  const pageSize = 20;
  const currentPage = Math.max(1, Number(searchParams.page) || 1);
  const paginatedRows = getPageSlice(rows, currentPage, pageSize);
  const activeCount = users.filter((user) => user.status === "active").length;
  const archivedCount = users.filter((user) => user.status === "archived").length;
  /* Keyed by `name`, not by `label`. `roleLabels` maps "super_admin" and
     "owner" to the SAME two words, so a network carrying both handed React
     超級管理者 twice — the duplicate-key defect adminTableRowKeys.test.mts
     exists for, one list over. The name is what is unique here. */
  const roleCounts = roles.map((role) => ({
    label: roleLabel(copy.admin.roleLabels, role.name),
    name: role.name,
    value: users.filter((user) => user.role === role.name).length
  }));

  return (
    <Page className="users-console">
      <PageHeader
        title={copy.admin.usersTitle}
        description={copy.admin.usersText}
        actions={
          <>
            <AdminSopButton label={copy.admin.usersAccessMapTitle}>
              <p>{copy.admin.usersAccessMapText}</p>
              <ol>
                {copy.admin.usersAccessMapItems.map(([role, text]) => (
                  <li key={role}>
                    <strong>{role}</strong>
                    <span>{text}</span>
                  </li>
                ))}
              </ol>
            </AdminSopButton>
            {canWrite ? (
              <ButtonLink href="/admin/users/new" icon={<UserPlus />} variant="primary">
                {copy.admin.adminCreateUser}
              </ButtonLink>
            ) : null}
          </>
        }
      />
      <AdminFlashes notice={searchParams.notice} error={searchParams.error} copy={copy.admin} />
      <Grid cols={3}>
        <StatCard icon={<UserCheck />} label={copy.admin.usersActiveAccounts} tone="success" value={activeCount} />
        <StatCard icon={<UserX />} label={copy.admin.usersArchivedAccounts} value={archivedCount} />
        <Card title={copy.admin.usersRoleMix}>
          <Chips>
            {roleCounts.map((role) => (
              <Badge key={role.name} tone={role.value > 0 ? "brand" : "neutral"}>
                {role.label} · {role.value}
              </Badge>
            ))}
          </Chips>
        </Card>
      </Grid>
      <Card title={copy.admin.usersWorkbenchTitle} description={copy.admin.usersWorkbenchText} flush>
      <div className="a-card__body">
      <form key={`${searchParams.keyword ?? ""}:${searchParams.status ?? ""}:${searchParams.visibility ?? ""}`}>
        <Toolbar
          end={
            <>
              <Button type="submit">{copy.admin.adminFilter}</Button>
              <ButtonLink href="/admin/users" variant="ghost">{copy.admin.adminResetFilters}</ButtonLink>
            </>
          }
        >
          <SearchInput icon={<Search />} name="keyword" aria-label={copy.admin.adminKeyword} placeholder={copy.admin.adminKeyword} defaultValue={searchParams.keyword} />
          <Select name="status" aria-label={copy.admin.adminStatus} defaultValue={showDeleted ? "deleted" : (searchParams.status ?? "")}>
            <option value="">{copy.admin.adminAllStatuses}</option>
            <option value="active">{copy.admin.statusLabels.active}</option>
            <option value="archived">{copy.admin.statusLabels.archived}</option>
            {/* The bin, as one more thing the list can be filtered to. */}
            <option value="deleted">{deletedLabel}</option>
          </Select>
        </Toolbar>
      </form>
      </div>
      <AdminTable
        rows={paginatedRows}
        emptyTitle={emptyTable[0]}
        emptyText={emptyTable[1]}
        columns={[
          { key: "name", label: copy.admin.adminName },
          { key: "email", label: copy.admin.adminEmail },
          {
            key: "role",
            label: copy.admin.adminRole,
            render: (row) => {
              const globalRole = String(row.role);
              const globalRoleDefinition = roles.find((r) => r.name === globalRole);
              const displayRole = globalRoleDefinition && isSuperAdmin(globalRoleDefinition)
                ? globalRole
                : String(row.site_role || globalRole);
              const currentRoleName = roleLabel(copy.admin.roleLabels, displayRole);
              /* By the wildcard, not by the name. "super_admin" is one of TWO
                 names for the role that holds everything — `owner` is the other,
                 and the roles screen can grant `*` to a role called anything at
                 all. Judged by name, an `owner` row stayed editable and could be
                 demoted out of `*`, which is the one change nobody left can undo.
                 The backend counts the same way (_super_admin_role_ids). */
              const rowRole = globalRoleDefinition;
              if (!canChangeSiteRoles || (rowRole && isSuperAdmin(rowRole))) return currentRoleName;
              return (
                <UserRoleEditor
                  cancelLabel={copy.admin.adminConfirmCancel}
                  confirmLabel={copy.admin.adminSave}
                  currentRole={displayRole}
                  currentRoleLabel={currentRoleName}
                  roles={[
                    { name: "site_member", label: roleLabel(copy.admin.roleLabels, "site_member") },
                    ...roles.filter((r) => r.name === "admin" || r.name === "editor").map((r) => ({
                      label: roleLabel(copy.admin.roleLabels, r.name),
                      name: r.name
                    }))
                  ]}
                  title={copy.admin.adminChangeRole}
                  updateAction={updateAdminUserRoleAction}
                  userId={String(row.id)}
                  userName={String(row.name || row.email)}
                />
              );
            }
          },
          {
            key: "permissions",
            label: copy.admin.adminPermissions,
            render: (row) => {
              const perms = (row.permissions as string[] | undefined) ?? [];
              if (perms.length === 0) return <span>-</span>;
              const permGroups = grantedPermissionGroups(zh, perms, copy.admin.permissionLabels, copy.admin.permissionDescriptions);
              return (
                <UserPermissionLink
                  closeLabel={zh ? "關閉權限" : "Close permissions"}
                  groups={permGroups}
                  roleLabel={roleLabel(copy.admin.roleLabels, String(row.role))}
                  title={copy.admin.adminPermissions}
                  triggerLabel={zh ? "查看" : "View"}
                  userName={String(row.name || row.email)}
                />
              );
            }
          },
          { key: "created_at", label: copy.admin.adminCreatedAt, render: (row) => formatDateTime(String(row.created_at ?? "")) },
          {
            key: "status",
            label: copy.admin.adminStatus,
            render: (row) => (
              /* 停用 and 已刪除 are two different axes — an account can be
                 either, both, or neither — so the bin badge sits BESIDE the
                 status badge rather than replacing it. Laid out inline, the way
                 the header above does it, so this adds no new stylesheet rule. */
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                <StatusBadge labels={copy.admin.statusLabels} status={String(row.status)} />
                {row.deleted_at ? <DeletedBadge label={deletedLabel} /> : null}
              </div>
            )
          },
          {
            key: "actions",
            label: copy.admin.adminActions,
            render: (row) => {
              if (!canWrite) return <span className="admin-public-state">-</span>;
              const isActive = row.status === "active";
              const nextStatus = isActive ? "archived" : "active";
              const label = isActive ? copy.admin.adminDeactivateUser : copy.admin.adminActivateUser;
              const deleted = Boolean(row.deleted_at);
              /* What the two dialogs call this row. An admin list is a column of
                 near-identical rows — same role words, same 啟用 badge — and the
                 email is the only thing on it that is unique, so it is what a
                 dialog has to carry for "確定?" to be answerable. The name comes
                 with it when there is one, because that is what the operator
                 was reading down the first column. */
              const accountName = String(row.name ?? "").trim();
              const accountEmail = String(row.email ?? "").trim();
              const account = accountName ? `${accountName}（${accountEmail}）` : accountEmail;
              const accountEn = accountName ? `${accountName} (${accountEmail})` : accountEmail;
              /* Only a super-admin: the routes ask `_is_super_admin`, not the
                 permission on their own gate. See `canRemove` above. */
              const refusal = canRemove ? deleteRefusal(row, users, profile.id) : "";
              /* 停用 refuses the same two rows, one door along: the API answers
                 422 for your own account — deactivating yourself locks you out
                 between this request and the next — and it will not take the
                 last super-admin out of service either, for the same reason
                 deleting one is refused. Only when going ACTIVE → 停用; putting
                 an account back is never the refusal. */
              const statusRefusal = isActive ? deleteRefusal(row, users, profile.id) : "";
              return (
                <RowActions align="start">
                  {/* A row in 已刪除 offers only the way back and the way out.
                      停用 / 啟用 on it is a 400 from the server — filing a badge
                      on an account nobody can sign in to — so it is not drawn. */}
                  {deleted ? (
                    canRemove ? (
                      <>
                        <form action={restoreAdminUserAction.bind(null, String(row.id))}>
                          <SubmitButton className={buttonClass({ size: "sm" })}>{zh ? "復原" : "Restore"}</SubmitButton>
                        </form>
                        {/* The second delete. Both ask; this is the one that
                            keeps no copy, so it says so. */}
                        <ConfirmSubmitButton
                          action={purgeAdminUserAction.bind(null, String(row.id))}
                          body={
                            zh
                              ? `確定要永久刪除管理員帳號「${account}」嗎？它會從資料庫中移除，且無法還原。登入紀錄會保留，但不再連到這個帳號。`
                              : `Permanently delete the admin account "${accountEn}"? It will be removed from the database and cannot be restored. Its sign-in history is kept, but no longer linked to the account.`
                          }
                          cancelLabel={copy.admin.adminConfirmCancel}
                          className={buttonClass({ variant: "danger-ghost", size: "sm" })}
                          confirmLabel={zh ? "永久刪除" : "Delete permanently"}
                          title={zh ? "永久刪除" : "Delete permanently"}
                        >
                          {zh ? "永久刪除" : "Delete permanently"}
                        </ConfirmSubmitButton>
                      </>
                    ) : (
                      <span className="admin-public-state">-</span>
                    )
                  ) : (
                    <>
                      {statusRefusal ? (
                        <span className="admin-public-state">
                          {statusRefusal === "self"
                            ? zh
                              ? "本人帳號，無法停用"
                              : "You cannot deactivate your own account"
                            : zh
                              ? "唯一的超級管理者，無法停用"
                              : "The last super admin cannot be deactivated"}
                        </span>
                      ) : (
                        <form action={updateAdminUserStatusAction.bind(null, String(row.id), nextStatus)}>
                          <ConfirmSubmitButton
                            className={buttonClass({ size: "sm" })}
                            body={isActive ? copy.admin.adminConfirmDeactivateUser : copy.admin.adminConfirmActivateUser}
                            cancelLabel={copy.admin.adminConfirmCancel}
                            confirmLabel={label}
                            title={copy.admin.adminConfirmTitle}
                          >
                            {label}
                          </ConfirmSubmitButton>
                        </form>
                      )}
                      {/* 刪除, and the two rows that do not get one. The server
                          refuses both with a sentence of its own; what it cannot
                          do is stop the button from being there to press, and a
                          control whose only outcome is an error dialog is how an
                          operator learns to distrust the column it sits in. So
                          the reason takes the button's place — as text, not as a
                          disabled button or a tooltip, because a finger gets
                          nothing from either. */}
                      {canRemove && refusal ? (
                        <span className="admin-public-state">
                          {refusal === "self"
                            ? zh
                              ? "本人帳號，無法刪除"
                              : "You cannot delete your own account"
                            : zh
                              ? "唯一的超級管理者，無法刪除"
                              : "The last super admin cannot be deleted"}
                        </span>
                      ) : null}
                      {canRemove && !refusal ? (
                        <ConfirmSubmitButton
                          action={deleteAdminUserAction.bind(null, String(row.id))}
                          body={
                            zh
                              ? `確定要刪除管理員帳號「${account}」嗎？該帳號會立即登出並移到「已刪除」，可在該處復原；復原後需要重新登入。`
                              : `Delete the admin account "${accountEn}"? It is signed out immediately and moves to the deleted list, where it can be restored — a restored account has to sign in again.`
                          }
                          cancelLabel={copy.admin.adminConfirmCancel}
                          className={buttonClass({ variant: "danger-ghost", size: "sm" })}
                          confirmLabel={zh ? "刪除" : "Delete"}
                          title={zh ? "確認刪除帳號" : "Confirm account deletion"}
                        >
                          {zh ? "刪除" : "Delete"}
                        </ConfirmSubmitButton>
                      ) : null}
                    </>
                  )}
                </RowActions>
              );
            }
          }
        ]}
      />
      </Card>
      <AdminTablePagination pageSize={pageSize} totalRows={rows.length} />
    </Page>
  );
}

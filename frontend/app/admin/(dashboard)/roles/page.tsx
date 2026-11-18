import { getLocale, t } from "../../../modules/i18n";
import { getAdminPermissions, getAdminProfile, getAdminRoles, hasPermission } from "../../modules/adminApi";
import AdminFlash from "../../modules/AdminFlash";
import AdminSopButton from "../../modules/AdminSopButton";
import { ShieldAlert } from "lucide-react";
import { Callout, Page, PageHeader } from "../../ui";
import RolesTabView from "./RolesTabView";
import { permissionGroups } from "../../modules/permissionGroups";

export default async function AdminRolesPage(
  props: {
    searchParams: Promise<{ error?: string; notice?: string; role?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();
  const copy = t(locale);
  const zh = locale === "zh";
  const [roles, allPermissions, profile] = await Promise.all([getAdminRoles(), getAdminPermissions(), getAdminProfile()]);
  const canWrite = hasPermission(profile.permissions, "roles:write");

  return (
    <Page>
      <PageHeader
        title={copy.admin.rolesTitle}
        description={copy.admin.rolesText}
        actions={
          <AdminSopButton label={copy.admin.rolesGuideTitle}>
            <p>{copy.admin.rolesGuideText}</p>
            <ol>
              {copy.admin.rolesGuideSteps.map(([step, title, text]) => (
                <li key={step}>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
          </AdminSopButton>
        }
      />
      <AdminFlash closeLabel={copy.admin.adminFlashClose} message={searchParams.notice} title={copy.admin.adminFlashSuccess} tone="success" />
      <AdminFlash closeLabel={copy.admin.adminFlashClose} message={searchParams.error} title={copy.admin.adminFlashError} tone="error" />
      <Callout tone="warning" icon={<ShieldAlert />} title={copy.admin.rolesRiskTitle}>
        {copy.admin.rolesRiskText}
      </Callout>

      <RolesTabView
        allPermissions={allPermissions}
        canWrite={canWrite}
        groups={permissionGroups(zh)}
        initialRole={searchParams.role ?? ""}
        lockedLabel={zh ? "超級管理者擁有所有權限，不可修改" : "Super Admin has full access and cannot be modified"}
        permissionDescriptions={copy.admin.permissionDescriptions}
        noResultsLabel={zh ? "找不到符合的權限，請調整搜尋關鍵字。" : "No permissions match. Change your search."}
        permissionLabels={copy.admin.permissionLabels}
        roleLabels={copy.admin.roleLabels}
        roles={roles.map((r) => ({ id: r.id, name: r.name, permissions: r.permissions as string[] }))}
        saveLabel={copy.admin.adminSavePermissions}
        searchPlaceholder={zh ? "搜尋權限..." : "Search permissions..."}
        unsavedLabel={zh ? "尚未儲存的變更" : "Unsaved changes"}
        viewingLabel={zh ? "當前檢視角色" : "Viewing role"}
      />
    </Page>
  );
}

import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { getLocale, t } from "../../../../modules/i18n";
import { cookies } from "next/headers";
import { getAdminProfile, getAdminRoles, getAdminSites, hasPermission } from "../../../modules/adminApi";
import AdminFlash from "../../../modules/AdminFlash";
import SubmitButton from "../../../modules/SubmitButton";
import { createAdminUserAction } from "../../../modules/userActions";
import { ButtonLink, Card, Field, FormActions, FormGrid, Input, Page, PageHeader, Select, buttonClass } from "../../../ui";
import NewUserPermissions from "./NewUserPermissions";
import { labelFromMap } from "../../../modules/adminUtils";
import { permissionGroups } from "../../../modules/permissionGroups";

export default async function NewUserPage(
  props: {
    searchParams: Promise<{ error?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();
  const copy = t(locale);
  const zh = locale === "zh";
  const [roles, profile, sites] = await Promise.all([getAdminRoles(), getAdminProfile(), getAdminSites()]);
  const canWrite = hasPermission(profile.permissions, "global_users:write");
  if (!canWrite) redirect("/admin/users");

  const groups = permissionGroups(zh);
  const currentSiteSlug = (await cookies()).get("admin-site")?.value ?? sites[0]?.slug ?? "";

  return (
    <Page>
      <PageHeader
        eyebrow={copy.admin.usersTitle}
        title={copy.admin.adminCreateUser}
        description={zh ? "填寫基本資料後建立管理帳號。" : "Fill in basic details to create an admin account."}
        actions={
          <ButtonLink href="/admin/users" icon={<ArrowLeft />} variant="ghost">
            {copy.admin.adminBackToUsers}
          </ButtonLink>
        }
      />
      <AdminFlash
        closeLabel={copy.admin.adminFlashClose}
        message={searchParams.error}
        title={copy.admin.adminFlashError}
        tone="error"
      />
      <div className="a-split">
        <Card title={zh ? "帳號資料" : "Account details"}>
          <form className="a-stack a-stack--md" action={createAdminUserAction}>
            <FormGrid>
              <Field label={copy.admin.adminUserName} required>
                <Input name="name" placeholder="Owner Admin" required />
              </Field>
              <Field label={copy.admin.adminEmail} required>
                <Input name="email" type="email" placeholder="you@company.com" required />
              </Field>
              <Field label={copy.admin.adminUserPassword} required>
                <Input name="password" type="password" minLength={8} placeholder="********" required />
              </Field>
              <Field label={copy.admin.adminRole}>
                <Select name="role" defaultValue="admin">
                  {roles.map((role) => (
                    <option key={role.name} value={role.name}>
                      {labelFromMap(copy.admin.roleLabels, role.name)}
                    </option>
                  ))}
                </Select>
              </Field>
              {sites.length > 0 && (
                <Field label={zh ? "歸屬站點" : "Belongs to site"}>
                  <Select name="site_slug" defaultValue={currentSiteSlug}>
                    {sites.map((site) => (
                      <option key={site.slug} value={site.slug}>
                        {site.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </FormGrid>
            <FormActions>
              <SubmitButton className={buttonClass({ variant: "primary" })}>
                {copy.admin.adminCreateUser}
              </SubmitButton>
            </FormActions>
          </form>
        </Card>

        <NewUserPermissions
          groups={groups}
          permissionDescriptions={copy.admin.permissionDescriptions}
          permissionLabels={copy.admin.permissionLabels}
          roles={roles.map((r) => ({
            label: labelFromMap(copy.admin.roleLabels, r.name),
            name: r.name,
            permissions: r.permissions as string[]
          }))}
          title={zh ? "權限清單配置" : "Permission checklist"}
        />
      </div>
    </Page>
  );
}

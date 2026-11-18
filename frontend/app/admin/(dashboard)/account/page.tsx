import { getLocale, t } from "../../../modules/i18n";
import { getAdminProfile } from "../../modules/adminApi";
import AdminFlash from "../../modules/AdminFlash";
import { changePasswordAction } from "../../modules/accountActions";
import SubmitButton from "../../modules/SubmitButton";
import { Badge, Card, DescriptionList, Field, FormActions, Grid, Input, Page, PageHeader, Stack, buttonClass } from "../../ui";
import AccountPermissionModal from "./AccountPermissionModal";
import { labelFromMap } from "../../modules/adminUtils";

/* Permission keys keep the plain lookup: an unlisted one is a bug in the
   table, and dressing `sites:read` up as "Sites:read" would hide it. Roles go
   through roleLabel, which spells an unlisted key as words. */
export default async function AdminAccountPage(
  props: {
    searchParams: Promise<{ error?: string; notice?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();
  const copy = t(locale);
  const zh = locale === "zh";
  const profile = await getAdminProfile();
  const hasFullAccess = profile.permissions.includes("*");
  const roleLabel = labelFromMap(copy.admin.roleLabels, profile.role);

  return (
    <Page>
      <PageHeader title={copy.admin.adminAccountTitle} description={copy.admin.adminAccountText} />
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
      <Grid cols={2}>
        {/* Profile */}
        <Card title={profile.name || profile.email} description={copy.admin.adminProfile}>
          <Stack>
            <DescriptionList
              columns={1}
              items={[
                { label: copy.admin.adminEmail, value: profile.email },
                { label: copy.admin.adminRole, value: <Badge tone={hasFullAccess ? "success" : "neutral"}>{roleLabel}</Badge> },
                {
                  label: copy.admin.adminPermissions,
                  value: (
                    <AccountPermissionModal
                      groups={(() => {
                        const permSet = new Set(profile.permissions);
                        const hasAll = permSet.has("*");
                        return [
                          { label: zh ? "群站管理" : "Site Network", permissions: ["sites:read", "sites:write"] },
                          { label: zh ? "全域帳號" : "Global Users", permissions: ["global_users:read", "global_users:write"] },
                          { label: zh ? "角色管理" : "Roles", permissions: ["roles:read", "roles:write"] },
                          { label: zh ? "住宿" : "Stays", permissions: ["stays:read", "stays:write"] },
                          { label: zh ? "內容" : "Content", permissions: ["cms:read", "cms:write", "media:read", "media:write"] },
                          { label: zh ? "表單聯絡" : "Form contacts", permissions: ["inquiries:read", "inquiries:write"] },
                          { label: zh ? "電子報" : "Newsletter", permissions: ["newsletter:read", "newsletter:write"] },
                          { label: zh ? "站點帳號" : "Site Users", permissions: ["site_users:read", "site_users:write"] }
                        ]
                          .map((g) => ({
                            label: g.label,
                            permissions: g.permissions
                              .filter((p) => hasAll || permSet.has(p))
                              .map((p) => ({
                                key: p,
                                label: labelFromMap(copy.admin.permissionLabels, p),
                                desc: labelFromMap(copy.admin.permissionDescriptions, p)
                              }))
                          }))
                          .filter((g) => g.permissions.length > 0);
                      })()}
                      labels={{
                        close: zh ? "關閉權限視窗" : "Close permissions",
                        title: copy.admin.adminPermissions,
                        trigger: zh ? "查看" : "View"
                      }}
                      roleLabel={roleLabel}
                    />
                  )
                }
              ]}
            />
          </Stack>
        </Card>

        {/* Change password */}
        <Card title={copy.admin.adminChangePassword} description={copy.admin.adminPasswordHelp}>
          <form className="a-stack a-stack--md" action={changePasswordAction}>
            <Field label={copy.admin.adminCurrentPassword} required>
              <Input name="current_password" type="password" autoComplete="current-password" required />
            </Field>
            <Field label={copy.admin.adminNewPassword} required>
              <Input name="new_password" type="password" minLength={8} autoComplete="new-password" required />
            </Field>
            <FormActions>
              <SubmitButton className={buttonClass({ variant: "primary" })}>
                {copy.admin.adminSave}
              </SubmitButton>
            </FormActions>
          </form>
        </Card>
      </Grid>
    </Page>
  );
}

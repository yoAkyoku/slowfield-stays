import { getLocale, t } from "../../../modules/i18n";
import { getAdminProfile } from "../../modules/adminApi";
import { AdminFlashes } from "../../modules/AdminFlash";
import { changePasswordAction } from "../../modules/accountActions";
import SubmitButton from "../../modules/SubmitButton";
import { Badge, Card, DescriptionList, Field, FormActions, Grid, Input, Page, PageHeader, Stack, buttonClass } from "../../ui";
import AccountPermissionModal from "./AccountPermissionModal";
import { labelFromMap } from "../../modules/adminUtils";
import { grantedPermissionGroups } from "../../modules/permissionGroups";

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
      <AdminFlashes notice={searchParams.notice} error={searchParams.error} copy={copy.admin} />
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
                      groups={grantedPermissionGroups(zh, profile.permissions, copy.admin.permissionLabels, copy.admin.permissionDescriptions)}
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

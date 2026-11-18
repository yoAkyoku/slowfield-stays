import { AlertCircle, CheckCircle, Mail, Server } from "lucide-react";
import { Badge, Callout, Card, Check, Field, FormActions, FormGrid, FormSection, Input, Page, PageHeader, Progress, buttonClass } from "../../ui";
import { getLocale, t } from "../../../modules/i18n";
import { AdminForbiddenError, getAdminEmailSettings, getAdminProfile, hasPermission } from "../../modules/adminApi";
import AdminSopButton from "../../modules/AdminSopButton";
import { AdminFlashes } from "../../modules/AdminFlash";
import SubmitButton from "../../modules/SubmitButton";
import EmailTestPanel from "./EmailTestPanel";
import { updateEmailSettingsAction } from "../../modules/emailActions";

export default async function EmailSettingsPage(
  props: {
    searchParams: Promise<{ error?: string; notice?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();
  const copy = t(locale);
  const zh = locale === "zh";
  const [settings, profile] = await Promise.all([getAdminEmailSettings(), getAdminProfile()]);
  if (!hasPermission(profile.permissions, "site_users:read")) throw new AdminForbiddenError();
  const hasProvider = Boolean(settings.smtp_host && settings.smtp_port && settings.smtp_username);
  const hasSender = Boolean(settings.from_email && settings.from_name);
  const isReady = settings.is_enabled && hasProvider && hasSender && settings.has_password;
  const readinessItems: [string, boolean][] = [
    [copy.admin.adminEmailEnabled, settings.is_enabled],
    [copy.admin.adminEmailProviderCard, hasProvider],
    [copy.admin.adminEmailSenderCard, hasSender],
    [copy.admin.adminSmtpPassword, settings.has_password]
  ];
  const statusLabel = !settings.is_enabled
    ? copy.admin.adminEmailStatusPaused
    : isReady
      ? copy.admin.adminEmailStatusReady
      : copy.admin.adminEmailStatusNeedsSetup;

  const usagePct = settings.daily_cap > 0 ? settings.sent_today / settings.daily_cap : 0;

  return (
    <Page>
      <PageHeader
        title={copy.admin.adminEmailSettingsTitle}
        help={
          <AdminSopButton label={copy.admin.adminEmailSetupTitle}>
            <p>{copy.admin.adminEmailSetupText}</p>
            <ol>
              {copy.admin.adminEmailSetupSteps.map(([step, title, text]) => (
                <li key={step}>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
          </AdminSopButton>
        }
        description={copy.admin.adminEmailSettingsText}
      />
      <AdminFlashes notice={searchParams.notice} error={searchParams.error} copy={copy.admin} />

      {/* Status Strip */}
      <Callout
        icon={isReady ? <CheckCircle /> : <AlertCircle />}
        title={statusLabel}
        tone={isReady ? "success" : "warning"}
      >
        <span className="a-page-meta">
          {readinessItems.map(([label, ok]) => (
            <Badge dot key={label} tone={ok ? "success" : "neutral"}>{label}</Badge>
          ))}
        </span>
      </Callout>

      {/* Unified Settings Form */}
      <form action={updateEmailSettingsAction}>
        <Card>
          <FormSection>
            <Check defaultChecked={settings.is_enabled} hint={statusLabel} label={copy.admin.adminEmailEnabled} name="is_enabled" />
          </FormSection>
          <FormSection title={<><Server size={15} /> {copy.admin.adminEmailProviderCard}</>}>
            <FormGrid>
              <Field label={copy.admin.adminSmtpHost}>
                <Input name="smtp_host" defaultValue={settings.smtp_host} placeholder="smtp.example.com" />
              </Field>
              <Field label={copy.admin.adminSmtpPort}>
                <Input name="smtp_port" type="number" min="1" max="65535" defaultValue={settings.smtp_port} />
              </Field>
              <Field label={copy.admin.adminSmtpUser}>
                <Input name="smtp_username" defaultValue={settings.smtp_username} placeholder="smtp user" />
              </Field>
              <Field label={copy.admin.adminSmtpPassword}>
                <Input
                  name="smtp_password"
                  type="password"
                  placeholder={settings.has_password ? copy.admin.adminKeepPassword : copy.admin.adminSmtpPassword}
                />
              </Field>
            </FormGrid>
          </FormSection>

          <FormSection title={<><Mail size={15} /> {copy.admin.adminEmailSenderCard}</>}>
            <FormGrid>
              <Field label={copy.admin.adminFromName}>
                <Input name="from_name" defaultValue={settings.from_name} placeholder="Slowfield Stays" />
              </Field>
              <Field label={copy.admin.adminFromEmail}>
                <Input name="from_email" type="email" defaultValue={settings.from_email} placeholder="noreply@example.com" />
              </Field>
              <Field
                hint={zh
                  ? "訂閱者按 Reply 時會自動寄到這些信箱（透過 Reply-To header）。留空則回信給寄件人 From 信箱。"
                  : "Subscribers' replies route to these inboxes via Reply-To. Leave blank to bounce back to From."}
                label={zh ? "回信收件人（可填多個，用逗號分隔）" : "Reply recipients (comma-separated)"}
                span="full"
              >
                <Input
                  name="reply_to"
                  type="text"
                  defaultValue={settings.reply_to}
                  placeholder={zh ? "owner1@gmail.com, owner2@gmail.com" : "owner1@gmail.com, owner2@gmail.com"}
                  title={zh
                    ? "訂閱者按 Reply 時會自動寄到這些信箱（透過 Reply-To header）。留空則回信給寄件人 From 信箱。"
                    : "Subscribers' replies route to these inboxes via Reply-To. Leave blank to bounce back to From."}
                />
              </Field>
              <Field
                hint={zh ? "0 = 無上限（Resend Pro / SES）。預設 100 = Resend 免費版" : "0 = unlimited (Resend Pro / SES). Default 100 = Resend free tier"}
                label={zh ? "每日寄送上限" : "Daily send cap"}
              >
                <Input
                  name="daily_cap"
                  type="number"
                  min="0"
                  max="1000000"
                  defaultValue={settings.daily_cap}
                  title={zh ? "0 = 無上限（Resend Pro / SES）。預設 100 = Resend 免費版" : "0 = unlimited (Resend Pro / SES). Default 100 = Resend free tier"}
                />
              </Field>
              <div className="a-field" style={{ justifyContent: "flex-end" }}>
                <Check defaultChecked={settings.use_tls} label={copy.admin.adminEmailTls} name="use_tls" />
              </div>
            </FormGrid>
          </FormSection>

          {/* Today's usage — only meaningful when a cap is set */}
          <FormSection title={zh ? "今日已寄送" : "Sent today"}>
            {settings.daily_cap > 0 ? (
              <>
                <Progress
                  label={`${settings.sent_today} / ${settings.daily_cap}`}
                  max={settings.daily_cap}
                  tone={settings.sent_today >= settings.daily_cap ? "danger" : usagePct > 0.8 ? "warning" : "success"}
                  value={settings.sent_today}
                />
                {settings.sent_today >= settings.daily_cap && (
                  <Callout tone="danger">
                    {zh
                      ? "今日額度已用盡 — 待發信件會留到 UTC 隔日 00:00 自動繼續。"
                      : "Daily quota reached — remaining queue will resume after UTC midnight."}
                  </Callout>
                )}
              </>
            ) : (
              <p className="a-field__hint">{settings.sent_today} ({zh ? "無上限" : "no cap"})</p>
            )}
          </FormSection>

          <FormActions sticky>
            <SubmitButton className={buttonClass({ variant: "primary" })}>
              {copy.admin.adminSave}
            </SubmitButton>
          </FormActions>
        </Card>
      </form>

      {/* Test Email Section */}
      <EmailTestPanel title={copy.admin.adminEmailTestTitle} help={copy.admin.adminEmailSafetyText} sendLabel={copy.admin.adminEmailTestSend} zh={zh} />
    </Page>
  );
}

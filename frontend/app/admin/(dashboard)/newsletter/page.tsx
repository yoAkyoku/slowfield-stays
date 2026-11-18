import { Plus } from "lucide-react";
import { ButtonLink, Page, PageHeader } from "../../ui";
import "./newsletter.css";
import { adminUiText, getLocale, t } from "../../../modules/i18n";
import { AdminForbiddenError, getAdminProfile, getNewsletterCampaigns, getNewsletterSubscribers, hasPermission } from "../../modules/adminApi";
import AdminSopButton from "../../modules/AdminSopButton";
import { AdminFlashes } from "../../modules/AdminFlash";
import {
  createSubscriberAction,
  deleteCampaignAction,
  deleteSubscriberAction,
  purgeCampaignAction,
  purgeSubscriberAction,
  processCampaignAction,
  restoreCampaignAction,
  restoreSubscriberAction,
  retryFailedNewsletterAction,
  scheduleCampaignAction,
  unscheduleCampaignAction,
  updateSubscriberAction
} from "../../modules/newsletterActions";
import NewsletterTabs, { normalizeNlTab, type NlTabKey } from "./NewsletterTabs";
import CampaignsPanel from "./panels/CampaignsPanel";
import SendPanel from "./panels/SendPanel";
import SubscriberPanel from "./panels/SubscriberPanel";
import ScheduleCalendar from "./panels/ScheduleCalendar";

export default async function NewsletterPage(
  props: {
    searchParams: Promise<{ error?: string; notice?: string; tab?: string; visibility?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();
  const copy = t(locale);
  const ui = adminUiText(locale);
  const zh = locale === "zh";
  const activeTab = normalizeNlTab(searchParams.tab);
  const visibility = searchParams.visibility ?? "active";
  const inBin = visibility === "deleted";
  const [subscribers, campaigns, profile] = await Promise.all([
    getNewsletterSubscribers(visibility),
    getNewsletterCampaigns(visibility),
    getAdminProfile()
  ]);
  if (!hasPermission(profile.permissions, "newsletter:read")) throw new AdminForbiddenError();
  const statusLabels = (copy.admin.statusLabels ?? {}) as Record<string, string>;

  const tabLabels: Record<NlTabKey, string> = {
    campaigns: zh ? "電子報列表" : "Campaigns",
    subscribers: zh ? "訂閱者管理" : "Subscriber Hub",
    send: zh ? "發送中心" : "Send Engine",
    calendar: zh ? "排程行事曆" : "Schedule"
  };

  return (
    <Page className="nl-page">
      <PageHeader
        eyebrow="Newsletter"
        title={ui.newsletter.title}
        help={
          <AdminSopButton label={ui.newsletter.workflowTitle}>
            <ol>
              {ui.newsletter.workflowSteps.map(([step, title, text]) => (
                <li key={step}>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
          </AdminSopButton>
        }
        description={ui.newsletter.text}
        actions={
          <ButtonLink href="/admin/newsletter/new" icon={<Plus />} variant="primary">
            {ui.newsletter.createCampaign}
          </ButtonLink>
        }
      />

      <AdminFlashes notice={searchParams.notice} error={searchParams.error} copy={copy.admin} />

      <NewsletterTabs activeTab={activeTab} labels={tabLabels} />

      <div>
        {activeTab === "campaigns" && (
          <CampaignsPanel
            campaigns={campaigns}
            copy={ui.newsletter}
            canWrite={hasPermission(profile.permissions, "newsletter:write")}
            deleteCampaignAction={deleteCampaignAction}
            binHref="/admin/newsletter?tab=campaigns&visibility=deleted"
            listHref="/admin/newsletter?tab=campaigns"
            inBin={inBin}
            purgeCampaignAction={purgeCampaignAction}
            restoreCampaignAction={restoreCampaignAction}
            statusLabels={statusLabels}
            zh={zh}
          />
        )}
{activeTab === "subscribers" && (
          <SubscriberPanel
            canWrite={hasPermission(profile.permissions, "newsletter:write")}
            inBin={inBin}
            copy={ui.newsletter}
            createSubscriberAction={createSubscriberAction}
            deleteSubscriberAction={deleteSubscriberAction}
            purgeSubscriberAction={purgeSubscriberAction}
            restoreSubscriberAction={restoreSubscriberAction}
            subscribers={subscribers}
            updateSubscriberAction={updateSubscriberAction}
            zh={zh}
          />
        )}
        {activeTab === "send" && (
          <SendPanel
            campaigns={campaigns}
            copy={ui.newsletter}
            processCampaignAction={processCampaignAction}
            retryAction={retryFailedNewsletterAction}
            scheduleCampaignAction={scheduleCampaignAction}
            subscribers={subscribers}
            unscheduleCampaignAction={unscheduleCampaignAction}
            zh={zh}
          />
        )}
        {activeTab === "calendar" && (
          /* Its own tab rather than an overlay on the send centre: a month grid
             needs the page width, and cramped into a dialog its own controls
             collided with the close button. */
          <ScheduleCalendar campaigns={campaigns} zh={zh} />
        )}
      </div>
    </Page>
  );
}

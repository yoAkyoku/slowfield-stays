import { ArrowLeft } from "lucide-react";
import { ButtonLink, Page, PageHeader } from "../../../ui";
import "../newsletter.css";
import { notFound } from "next/navigation";
import { getLocale } from "../../../../modules/i18n";
import { getNewsletterCampaign } from "../../../modules/adminApi";
import { updateCampaignAction, queueCampaignAction } from "../../../modules/newsletterActions";
import CampaignDetail from "./CampaignDetail";

export default async function CampaignDetailPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const id = Number(params.id);
  if (!id || Number.isNaN(id)) notFound();

  const campaign = await getNewsletterCampaign(id);
  if (!campaign) notFound();

  const locale = await getLocale();
  const zh = locale === "zh";
  // Only draft campaigns are editable; once queued/scheduled/sent the content
  // is locked server-side, so show the read-only view to match.
  const readOnly = campaign.status !== "draft";

  return (
    <Page className="nl-detail-page" width="wide">
      <PageHeader
        eyebrow="Newsletter"
        title={readOnly ? (zh ? "電子報詳情" : "Campaign details") : (zh ? "編輯電子報" : "Edit campaign")}
        description={campaign.subject}
        actions={
          <ButtonLink href="/admin/newsletter?tab=campaigns" icon={<ArrowLeft />}>
            {zh ? "返回電子報列表" : "Back to campaigns"}
          </ButtonLink>
        }
      />

      <CampaignDetail
        campaign={campaign}
        readOnly={readOnly}
        updateCampaignAction={updateCampaignAction}
        queueCampaignAction={queueCampaignAction}
        zh={zh}
      />
    </Page>
  );
}

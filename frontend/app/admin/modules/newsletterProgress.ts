import type { NewsletterCampaign } from "./adminApi";

export function newsletterProgress(campaign: NewsletterCampaign, zh: boolean) {
  const pending = campaign.pending_count;
  const failed = campaign.failed_count;
  const skipped = campaign.skipped_count;
  const parts = [
    pending ? `${zh ? "待寄" : "Pending"} ${pending}` : "",
    failed ? `${zh ? "失敗" : "Failed"} ${failed}` : "",
    skipped ? `${zh ? "略過" : "Skipped"} ${skipped}` : "",
  ].filter(Boolean);
  return {
    primary: `${campaign.sent_count ?? "—"} / ${campaign.deliveries}`,
    detail: parts.join(" · "),
    label: zh ? "已寄／收件數" : "Sent / recipients",
  };
}

export function newsletterStatusLabel(campaign: NewsletterCampaign, zh: boolean, fallback: string) {
  if ((campaign.failed_count ?? 0) > 0 && (campaign.pending_count ?? 0) === 0) {
    return (campaign.sent_count ?? 0) > 0 ? (zh ? "部分失敗" : "Partially failed") : (zh ? "寄送失敗" : "Delivery failed");
  }
  if ((campaign.pending_count ?? 0) > 0 && campaign.status === "sent") return zh ? "待寄送" : "Queued";
  return fallback;
}

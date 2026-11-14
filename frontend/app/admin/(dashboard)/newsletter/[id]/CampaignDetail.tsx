"use client";

import { FileText, Mail } from "lucide-react";
import { Button, Callout, Card, DescriptionList, Field, FormActions, Input, Stack } from "../../../ui";
import EmailPreview from "../EmailPreview";
import { sanitizeRichHtml, stripClipboardFragmentMarkers } from "../../../../modules/safeHtml";
import { useCallback, useState, useTransition } from "react";
import RichTextEditor from "../../../modules/RichTextEditor";
import type { NewsletterCampaign } from "../../../modules/adminApi";
import { formatDateTime } from "../../../../modules/datetime";
import { newsletterProgress } from "../../../modules/newsletterProgress";

export default function CampaignDetail({
  campaign,
  readOnly,
  updateCampaignAction,
  queueCampaignAction,
  zh
}: {
  campaign: NewsletterCampaign;
  readOnly: boolean;
  updateCampaignAction: (id: number, fd: FormData) => Promise<void>;
  queueCampaignAction?: (id: number) => Promise<void>;
  zh: boolean;
}) {
  const [subject, setSubject] = useState(campaign.subject);
  const [bodyText, setBodyText] = useState(() => stripClipboardFragmentMarkers(campaign.body ?? ""));
  const [groups, setGroups] = useState(campaign.target_groups.join(", "));
  const [isPending, startTransition] = useTransition();
  const [isQueuing, startQueue] = useTransition();

  const handleSubmit = useCallback(
    (fd: FormData) => {
      startTransition(async () => {
        await updateCampaignAction(campaign.id, fd);
      });
    },
    [updateCampaignAction, campaign.id]
  );

  const handleQueue = useCallback(() => {
    if (!queueCampaignAction) return;
    startQueue(async () => {
      await queueCampaignAction(campaign.id);
    });
  }, [queueCampaignAction, campaign.id]);

  function fmtDate(raw?: string) {
    if (!raw) return null;
    return formatDateTime(raw, zh ? "zh" : "en");
  }

  /* Values shown in the preview (reactive for editable, static for read-only) */
  const previewSubject = readOnly ? campaign.subject : subject;
  const previewBody = readOnly ? stripClipboardFragmentMarkers(campaign.body ?? "") : bodyText;
  const previewGroups = readOnly
    ? (campaign.target_groups.length > 0 ? campaign.target_groups.join(", ") : (zh ? "全部訂閱者" : "All subscribers"))
    : (groups || (zh ? "全部訂閱者" : "All subscribers"));

  return (
    <div className="nlx-compose">
      {/* Left panel */}
      {readOnly ? (
        <Card>
          <Stack>
            <DescriptionList
              items={[
                {
                  label: zh ? "目標分群" : "Target groups",
                  value: campaign.target_groups.length > 0 ? campaign.target_groups.join(", ") : (zh ? "全部訂閱者" : "All subscribers")
                },
                {
                  label: newsletterProgress(campaign, zh).label,
                  value: (
                    <>
                      {newsletterProgress(campaign, zh).primary}
                      {newsletterProgress(campaign, zh).detail && <span className="a-muted">{newsletterProgress(campaign, zh).detail}</span>}
                    </>
                  )
                },
                ...(campaign.created_at ? [{ label: zh ? "建立時間" : "Created", value: fmtDate(campaign.created_at) }] : []),
                ...(campaign.sent_at ? [{ label: zh ? "發送時間" : "Sent", value: fmtDate(campaign.sent_at) }] : [])
              ]}
            />

            <div className="a-field">
              <span className="a-field__label">{zh ? "內容" : "Content"}</span>
              {campaign.body ? (
                <div className="nlx-readonly-body nl-preview-rich" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(stripClipboardFragmentMarkers(campaign.body)) }} />
              ) : (
                <div className="nlx-readonly-body">
                  <p className="a-muted">{zh ? "無內容" : "No content"}</p>
                </div>
              )}
            </div>
          </Stack>
        </Card>
      ) : (
        <form action={handleSubmit}>
          <Card>
            <Stack>
              <Field label={zh ? "主旨" : "Subject"} required>
                <Input
                  name="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
              </Field>

              <Field label={zh ? "目標分群" : "Target groups"}>
                <Input
                  name="target_groups"
                  value={groups}
                  onChange={(e) => setGroups(e.target.value)}
                  placeholder={zh ? "留空代表全部訂閱者" : "Leave blank for all subscribers"}
                />
              </Field>

              <div className="a-field">
                <span className="a-field__label">{zh ? "內容" : "Content"}</span>
                <RichTextEditor value={bodyText} onChange={setBodyText} variant="full"
                  showDivider showVideo videoLabel={zh ? "觀看影片" : "Watch video"}
                  minRows={14} placeholder={zh ? "撰寫電子報內容" : "Write newsletter content"} />
                <input type="hidden" name="body" value={bodyText} readOnly />
              </div>

              {campaign.status === "draft" && (
                <Callout tone="info">
                  {zh
                    ? "先儲存內容，按「加入待寄佇列」後，即可到「發送中心」立即寄出或排程。"
                    : "Save first, then add to the queue — send or schedule it from the Send Engine."}
                </Callout>
              )}
              {campaign.status !== "draft" && (
                <Callout tone="neutral">
                  {zh ? `目前狀態：${campaign.status}。請至「發送中心」操作寄送。` : `Status: ${campaign.status}. Manage sending from the Send Engine.`}
                </Callout>
              )}

              <FormActions sticky>
                {campaign.status === "draft" && queueCampaignAction && (
                  <Button
                    disabled={isQueuing}
                    icon={isQueuing ? <span className="admin-spinner" /> : <Mail />}
                    onClick={handleQueue}
                  >
                    {zh ? "加入待寄佇列" : "Add to send queue"}
                  </Button>
                )}
                <Button
                  disabled={isPending}
                  icon={isPending ? <span className="admin-spinner" /> : <FileText />}
                  type="submit"
                  variant="primary"
                >
                  {zh ? "儲存變更" : "Save changes"}
                </Button>
              </FormActions>
            </Stack>
          </Card>
        </form>
      )}

      {/* Right: Live Preview */}
      <EmailPreview bodyHtml={previewBody} footer={previewGroups} subject={previewSubject} zh={zh} />
    </div>
  );
}

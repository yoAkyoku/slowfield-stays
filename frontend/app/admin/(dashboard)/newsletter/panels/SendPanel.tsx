"use client";

import { AlertTriangle, Calendar, Clock, Send } from "lucide-react";
import { Badge, Button, Callout, Card, Check, Field, FormGrid, FormSection, Grid, Input, Progress, RowActions, Segmented, Stack } from "../../../ui";
import AdminEmptyState from "../../../modules/AdminEmptyState";
import { useCallback, useMemo, useState } from "react";
import type { NewsletterCampaign, NewsletterSubscriber } from "../../../modules/adminApi";
import { formatDateTime, formatTime } from "../../../../modules/datetime";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdminResult } from "../../../modules/adminRequest";
import { flashMessage } from "../../../modules/flashMessage";

type Copy = Record<string, unknown> & {
  processQueue: string;
  queued: string;
  deliveries: string;
};

type SendMode = "now" | "schedule";

export default function SendPanel({
  campaigns,
  copy,
  processCampaignAction,
  retryAction,
  scheduleCampaignAction,
  subscribers,
  unscheduleCampaignAction,
  zh
}: {
  campaigns: NewsletterCampaign[];
  copy: Copy;
  processCampaignAction: (id: number) => Promise<AdminResult & { data?: { sent: number; failed: number; skipped: number } }>;
  retryAction: () => Promise<void>;
  scheduleCampaignAction: (id: number, scheduledAt: string) => Promise<AdminResult>;
  subscribers: NewsletterSubscriber[];
  unscheduleCampaignAction: (id: number) => Promise<void>;
  zh: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  /* 未發送 / 已排程 as two lists rather than one mixed list with a badge: the
     two are opposites — one waits for a person, the other fires by itself —
     and prose above a merged list said so less clearly than the split does. */
  const [queueTab, setQueueTab] = useState<"awaiting" | "scheduled">("awaiting");
  const [sendMode, setSendMode] = useState<SendMode>("now");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  // Both queued (immediate-send candidates) and scheduled (pending future tick)
  // belong in this list — the backend lets you reschedule, send-now, or cancel
  // either one.
  const queuedCampaigns = campaigns.filter(
    (c) => c.status === "queued" || c.status === "scheduled" || (c.pending_count ?? 0) > 0
  );
  /* Scheduled first, and counted. The two states read alike in one flat list,
     but they are opposites: a queued campaign waits for someone to press send,
     a scheduled one goes out by itself. An operator opening this page wants to
     know what is already set to fire before deciding what to dispatch. */
  const scheduledCampaigns = queuedCampaigns.filter((c) => c.status === "scheduled");
  const awaitingCampaigns = queuedCampaigns.filter((c) => c.status !== "scheduled");
  const visibleCampaigns = queueTab === "scheduled" ? scheduledCampaigns : awaitingCampaigns;

  function formatScheduled(iso?: string): string {
    if (!iso) return "";
    return formatDateTime(iso, zh ? "zh" : "en");
  }

  const subscribedSubs = useMemo(
    () => subscribers.filter((s) => s.status === "subscribed"),
    [subscribers]
  );

  const recipientCount = useCallback(
    (c: NewsletterCampaign) => {
      if (c.target_groups.length === 0) return subscribedSubs.length;
      return subscribedSubs.filter((s) =>
        s.groups.some((g) => c.target_groups.includes(g))
      ).length;
    },
    [subscribedSubs]
  );

  const toggleSelect = useCallback((id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const selectAll = useCallback(() => {
    if (selected.length === visibleCampaigns.length) {
      setSelected([]);
    } else {
      setSelected(visibleCampaigns.map((c) => c.id));
    }
  }, [visibleCampaigns, selected.length]);

  const selectedCampaigns = queuedCampaigns.filter((c) => selected.includes(c.id));

  const totalRecipients = useMemo(
    () => selectedCampaigns.reduce((sum, c) => sum + recipientCount(c), 0),
    [selectedCampaigns, recipientCount]
  );

  const canSendNow = selected.length > 0 && totalRecipients > 0 && !sending;
  const scheduleTimestamp = new Date(`${scheduleDate}T${scheduleTime}`).getTime();
  const validScheduleTime = Number.isFinite(scheduleTimestamp) && scheduleTimestamp > Date.now();
  const canSchedule = selected.length > 0 && totalRecipients > 0 && validScheduleTime && !sending;

  const handleSend = useCallback(async () => {
    if (selected.length === 0 || totalRecipients === 0) return;
    setSending(true);
    setLogs([]);
    setProgress(0);

    const total = selected.length;
    for (let i = 0; i < total; i++) {
      const campaign = queuedCampaigns.find((c) => c.id === selected[i]);
      if (!campaign) continue;

      const stepBase = Math.round((i / total) * 100);
      const stepEnd = Math.round(((i + 1) / total) * 100);
      setProgress(stepBase);

      setLogs((p) => [
        ...p,
        zh
          ? `[${i + 1}/${total}] 正在處理「${campaign.subject}」…`
          : `[${i + 1}/${total}] Processing "${campaign.subject}"…`
      ]);

      // Simulate per-campaign progress
      const substeps = 5;
      for (let s = 1; s <= substeps; s++) {
        await new Promise((r) => setTimeout(r, 100));
        setProgress(stepBase + Math.round(((stepEnd - stepBase) * s) / substeps));
      }

      try {
        const result = await processCampaignAction(campaign.id);
        if (!result.ok) throw new Error(result.message);
        const counts = result.data;
        setLogs((p) => [
          ...p,
          counts
            ? (zh
                ? `  ${counts.failed > 0 ? "⚠" : "✓"} 本次佇列處理：寄出 ${counts.sent}、失敗 ${counts.failed}、略過 ${counts.skipped}。${counts.failed > 0 ? "請重試失敗 Email。" : ""}`
                : `  ${counts.failed > 0 ? "⚠" : "✓"} Queue processed: ${counts.sent} sent, ${counts.failed} failed, ${counts.skipped} skipped.${counts.failed > 0 ? " Retry failed emails." : ""}`)
            : (zh ? "  處理請求完成，請確認寄送狀態。" : "  Request completed; check delivery status.")
        ]);
      } catch {
        setLogs((p) => [
          ...p,
          zh
            ? `  ⚠ 「${campaign.subject}」處理時發生錯誤`
            : `  ⚠ "${campaign.subject}" error during processing`
        ]);
      }
    }

    setProgress(100);
    setLogs((p) => [...p, zh ? "寄送處理結束，請確認每封結果" : "Processing finished; check each result"]);
    setSending(false);
    setSelected([]);
    router.refresh();
  }, [router, processCampaignAction, queuedCampaigns, selected, totalRecipients, zh]);

  const handleSchedule = useCallback(async () => {
    if (selected.length === 0 || totalRecipients === 0 || !scheduleDate) return;
    const timestamp = new Date(`${scheduleDate}T${scheduleTime}`).getTime();
    if (!Number.isFinite(timestamp) || timestamp <= Date.now()) {
      setLogs([zh ? "請選擇未來的發送日期與時間。" : "Choose a future send date and time."]);
      return;
    }
    setSending(true);
    setLogs([]);
    // The date/time inputs give us the user's wall-clock time. new Date(...)
    // interprets that as local time; toISOString() emits the equivalent UTC.
    // Without this, "9am local" gets stored as "9am UTC" → off by the user's
    // offset (8 hours in UTC+8).
    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();

    const total = selected.length;
    for (let i = 0; i < total; i++) {
      const campaign = queuedCampaigns.find((c) => c.id === selected[i]);
      if (!campaign) continue;

      setLogs((p) => [
        ...p,
        zh
          ? `[${i + 1}/${total}] 排程「${campaign.subject}」→ ${scheduleDate} ${scheduleTime}`
          : `[${i + 1}/${total}] Scheduling "${campaign.subject}" → ${scheduleDate} ${scheduleTime}`
      ]);

      try {
        const result = await scheduleCampaignAction(campaign.id, scheduledAt);
        if (!result.ok) throw new Error(result.message);
        setLogs((p) => [
          ...p,
          zh ? `  ✓ 排程設定完成` : `  ✓ Schedule confirmed`
        ]);
      } catch (error) {
        setLogs((p) => [
          ...p,
          (zh ? "  ⚠ 排程設定失敗：" : "  ⚠ Schedule failed: ") +
            (error instanceof Error ? flashMessage(error.message, zh) : (zh ? "請稍後再試。" : "Please try again."))
        ]);
      }
    }

    setLogs((p) => [...p, zh ? "排程處理結束，請確認每封結果" : "Scheduling finished; check each result"]);
    setSending(false);
    setSelected([]);
    router.refresh();
  }, [router, scheduleCampaignAction, queuedCampaigns, selected, totalRecipients, scheduleDate, scheduleTime, zh]);

  return (
    <Grid cols={2}>
      {/* Step 1 — Select campaigns */}
      <Card
        title={zh ? "選擇指定信件" : "Select campaigns"}
        description={zh
          ? "從佇列中勾選一封或多封要發送或排程的電子報。"
          : "Check one or more queued campaigns to send or schedule."}
        actions={<Badge tone="brand">STEP 1</Badge>}
      >
        <Stack>
          <Segmented
            onChange={(key) => { setQueueTab(key); setSelected([]); }}
            options={[
              { value: "awaiting", label: `${zh ? "未發送" : "Awaiting"} (${awaitingCampaigns.length})` },
              { value: "scheduled", label: `${zh ? "已排程" : "Scheduled"} (${scheduledCampaigns.length})` }
            ]}
            size="tabs"
            value={queueTab}
          />

          {visibleCampaigns.length > 0 && (
            <Check
              checked={selected.length === visibleCampaigns.length && visibleCampaigns.length > 0}
              label={<>{zh ? "全選" : "Select all"} ({selected.length}/{visibleCampaigns.length})</>}
              onChange={selectAll}
            />
          )}

          {visibleCampaigns.length > 0 ? (
            <div className="nlx-pick-list">
              {visibleCampaigns.map((c) => (
                <label
                  className={`nlx-pick${selected.includes(c.id) ? " is-selected" : ""}`}
                  key={c.id}
                >
                  <input
                    checked={selected.includes(c.id)}
                    onChange={() => toggleSelect(c.id)}
                    type="checkbox"
                  />
                  <div className="nlx-pick__body">
                    {/* A link, not plain text: from here the subject is the
                        only handle on the campaign, and checking what is about
                        to go out means opening it. stopPropagation so following
                        it does not also tick the checkbox it sits inside. */}
                    <Link
                      className="nlx-table-link"
                      href={`/admin/newsletter/${c.id}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {c.subject}
                    </Link>
                    <span>
                      {zh ? "目標" : "Target"}:{" "}
                      {c.target_groups.length > 0 ? c.target_groups.join(", ") : (zh ? "全部" : "All")}{" "}
                      ({recipientCount(c)} {zh ? "人" : "recipients"})
                    </span>
                    {(c.failed_count ?? 0) > 0 && (
                      <Badge tone="danger">
                        <AlertTriangle size={12} />
                        {zh
                          ? `${c.failed_count} 封失敗（最多重試 ${c.max_retries ?? 3} 次，依 Email 設定）`
                          : `${c.failed_count} failed (max ${c.max_retries ?? 3} retries, per email settings)`}
                      </Badge>
                    )}
                    {c.status === "scheduled" && c.scheduled_at && (
                      <span className="nlx-pick__row">
                        <Badge tone="brand">
                          <Calendar size={12} />
                          {zh ? "已排程：" : "Scheduled: "}{formatScheduled(c.scheduled_at)}
                        </Badge>
                        <Button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            unscheduleCampaignAction(c.id);
                          }}
                          size="sm"
                          variant="danger-ghost"
                        >
                          {zh ? "取消排程" : "Cancel"}
                        </Button>
                      </span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <AdminEmptyState
              variant="compact"
              title={zh ? "目前沒有待寄送的電子報" : "No campaigns in the queue"}
              text=""
            />
          )}
        </Stack>
      </Card>

      {/* Step 2 — Dispatch config */}
      <Card title={zh ? "發送引擎與排程" : "Dispatch engine & scheduling"} actions={<Badge tone="brand">STEP 2</Badge>}>
        <Stack>
          {/* Selected campaigns info */}
          {selected.length > 0 ? (
            <Callout
              tone="info"
              title={<>{zh ? "已選擇：" : "Selected:"} {selected.length} {zh ? "封電子報" : "campaigns"}</>}
            >
              {zh ? "總收件人" : "Total recipients"}: {totalRecipients} {zh ? "人" : ""}
              {selected.length <= 3 && (
                <ul className="nlx-selected-list">
                  {selectedCampaigns.map((c) => (
                    <li key={c.id}>{c.subject}</li>
                  ))}
                </ul>
              )}
            </Callout>
          ) : (
            <Callout tone="neutral">
              {zh
                ? "← 請先從左側勾選電子報"
                : "← Select campaigns from the left panel"}
            </Callout>
          )}

          {/* Mode toggle */}
          <Segmented
            block
            onChange={setSendMode}
            options={[
              { value: "now", label: zh ? "立即發送" : "Send now", icon: <Send /> },
              { value: "schedule", label: zh ? "指定排程" : "Schedule", icon: <Calendar /> }
            ]}
            value={sendMode}
          />

          {/* Schedule picker */}
          {sendMode === "schedule" && (
            <FormSection
              title={zh ? "指定排程" : "Schedule"}
              description={zh
                ? "請指定未來的發送日期與時間。系統將於指定時刻自動喚醒並寄出。"
                : "Pick a future date and time. The system will automatically send at the scheduled moment."}
            >
              <FormGrid>
                <Field label={<><Calendar size={13} /> {zh ? "日期" : "Date"}</>}>
                  <Input
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    type="date"
                    value={scheduleDate}
                  />
                </Field>
                <Field label={<><Clock size={13} /> {zh ? "時間" : "Time"}</>}>
                  <Input
                    onChange={(e) => setScheduleTime(e.target.value)}
                    type="time"
                    value={scheduleTime}
                  />
                </Field>
              </FormGrid>
              {scheduleDate && !validScheduleTime && <p className="a-field__error" role="alert">{zh ? "請選擇未來的發送日期與時間。" : "Choose a future send date and time."}</p>}
            </FormSection>
          )}

          {/* Action buttons */}
          <RowActions align="start">
            {sendMode === "now" ? (
              <Button
                disabled={!canSendNow}
                icon={sending ? <span className="admin-spinner" /> : <Send />}
                onClick={handleSend}
                size="lg"
                variant="primary"
              >
                {zh
                  ? `立即發送${selected.length > 1 ? ` (${selected.length} 封)` : ""}`
                  : `Send now${selected.length > 1 ? ` (${selected.length})` : ""}`}
              </Button>
            ) : (
              <Button
                disabled={!canSchedule}
                icon={sending ? <span className="admin-spinner" /> : <Calendar />}
                onClick={handleSchedule}
                size="lg"
                variant="primary"
              >
                {zh
                  ? `確認排程${selected.length > 1 ? ` (${selected.length} 封)` : ""}`
                  : `Confirm schedule${selected.length > 1 ? ` (${selected.length})` : ""}`}
              </Button>
            )}
            <form action={retryAction}>
              <Button
                size="lg"
                title={zh ? "將所有發送失敗的 Email 重新加入寄送佇列" : "Move all failed emails back into the send queue"}
                type="submit"
                variant="ghost"
              >
                {(copy.retryFailed as string) ?? (zh ? "重試全部失敗 Email" : "Retry all failed")}
              </Button>
            </form>
          </RowActions>

          {/* Progress bar */}
          {sending && <Progress label={zh ? "寄送進度" : "Progress"} value={progress} />}

          {/* Send log */}
          {logs.length > 0 && (
            <div className="nlx-log" aria-label={zh ? "發送紀錄" : "Send Log"} role="log">
              {logs.map((log, i) => (
                <div className="nlx-log__line" key={i}>
                  <span className="nlx-log__time">
                    {formatTime(undefined, zh ? "zh" : "en")}
                  </span>
                  <span>{log}</span>
                </div>
              ))}
            </div>
          )}
        </Stack>
      </Card>
    </Grid>
  );
}

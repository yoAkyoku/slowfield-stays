import { CircleCheck, Inbox, Mail, MessageCircle, MessageSquareText, Phone, Route, Search } from "lucide-react";
import { Badge, Button, ButtonLink, Callout, Card, Chips, Grid, Input, Page, PageHeader, RowActions, SearchInput, Select, StatCard, Toolbar, buttonClass } from "../../ui";
import "./inquiries.css";
import { getLocale, t } from "../../../modules/i18n";
import { getAdminBookingRequests, getAdminInquiries, getAdminProfile, hasPermission, type AdminInquiry } from "../../modules/adminApi";
import { AdminFlashes } from "../../modules/AdminFlash";
import AdminSopButton from "../../modules/AdminSopButton";
import AdminTable from "../../modules/AdminTable";
import AdminTablePagination from "../../modules/AdminTablePagination";
import { getPageSlice } from "../../modules/paginationUtils";
import StatusBadge from "../../modules/StatusBadge";
import SubmitButton from "../../modules/SubmitButton";
import ConfirmSubmitButton from "../../modules/ConfirmSubmitButton";
import { deleteInquiryAction, purgeInquiryAction, restoreInquiryAction, updateInquiryStatusAction } from "../../modules/inquiryActions";
import { deleteBookingAction, purgeBookingAction, restoreBookingAction, updateBookingStatusAction } from "../../modules/bookingActions";
import InquiryExportButton from "./InquiryExportButton";
import { formatDateTime } from "../../../modules/datetime";
import { inquirySourceLabel, hasStayRequest, inquiryStageCounts, inquiryCreatedDate } from "../../modules/inquiryPresentation";

/** An enquiry or a booking request, tagged so the shared table can tell them
 *  apart when it dispatches an action. AdminBookingRequest is AdminInquiry
 *  plus two optional fields, so one row shape covers both.
 *
 *  The tag is no longer shown or filtered on — 表單聯絡 is one queue and the
 *  split is an implementation detail of which table the row lives in — but it
 *  still decides which endpoint 已聯繫 / 刪除 / 還原 / 永久刪除 address, so it
 *  cannot simply go away. */
type InboxRow = AdminInquiry & { kind: "inquiry" | "booking"; room_type?: string };

function formatStaySummary(row: InboxRow, unknownSource: string, locale: string) {
  const stay = row.stay?.trim();
  const dates =
    row.check_in && row.check_out
      ? `${row.check_in} - ${row.check_out}`
      : row.check_in
        ? row.check_in
        : row.check_out
          ? row.check_out
          : "";
  const guests = hasStayRequest(row) && row.guests ? `${row.guests} ${locale === "zh" ? "位" : "guests"}` : "";
  // The heading already names either the stay or the source. Repeat neither
  // as a second identical line; only add source when the heading is a stay.
  const source = stay ? inquirySourceLabel(row.source, locale, unknownSource) : "";
  return [dates, guests, source].filter(Boolean);
}

export default async function AdminInquiriesPage(
  props: {
    searchParams: Promise<{ date_from?: string; date_to?: string; error?: string; keyword?: string; kind?: string; notice?: string; page?: string; status?: string; visibility?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();
  const zh = locale === "zh";
  const copy = t(locale);
  /* 已刪除 is its own view rather than a row state mixed into the list — the
     point of deleting was to stop seeing them. It rides on the same `status`
     control as the real statuses, because as a separate link beside the filter
     bar it wrapped onto its own row and read as a stray button
     (客戶: 已刪除按鈕移到狀態的選單中). `visibility=deleted` is still honoured
     so existing links and bookmarks keep working. */
  const showDeleted = searchParams.status === "deleted" || searchParams.visibility === "deleted";
  const visibility = showDeleted ? "deleted" : "active";
  /* "deleted" names a view, not a row status, so it must not also narrow the
     list — every row in the bin would fail `status === "deleted"`. */
  const statusFilter = searchParams.status === "deleted" ? "" : (searchParams.status ?? "");
  // The keyword goes to the API so a search covers every enquiry, not the
  // newest 200 this page loads. The narrowing below still runs, for the fields
  // the API does not search (phone, LINE id, source, status, stay).
  const rawKeyword = searchParams.keyword?.trim() ?? "";
  /* One desk, two tables. A visitor fills in one form; whether it lands in
     `inquiries` or `booking_requests` is decided by an invisible internal flag
     (whether a stay was attached), so splitting the admin along that seam gave
     operators two inboxes for one stream and a daily question of "which page
     was it in?". They are merged here and told apart by a badge. */
  const [rawInquiries, rawBookings, profile] = await Promise.all([
    getAdminInquiries(visibility, rawKeyword),
    getAdminBookingRequests(visibility, rawKeyword),
    getAdminProfile(),
  ]);
  const inquiries: InboxRow[] = [
    ...rawInquiries.map((row) => ({ ...row, kind: "inquiry" as const })),
    ...rawBookings.map((row) => ({ ...row, kind: "booking" as const })),
  ]
    // Newest first across both sources: interleaving by id would order each
    // table against itself and put an old booking above a fresh enquiry.
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
  const canWrite = hasPermission(profile.permissions, "inquiries:write");
  const keyword = rawKeyword.toLowerCase();
  const kindFilter = searchParams.kind === "booking" || searchParams.kind === "inquiry" ? searchParams.kind : "";
  const returnParams = new URLSearchParams();
  for (const key of ["keyword", "status", "date_from", "date_to", "kind", "visibility", "page"] as const) {
    const value = searchParams[key];
    if (value) returnParams.set(key, value);
  }
  const statusReturnTo = `/admin/inquiries${returnParams.size ? `?${returnParams}` : ""}`;
  const rows = inquiries
    .filter((inquiry) => !kindFilter || inquiry.kind === kindFilter)
    .filter((inquiry) => !statusFilter || inquiry.status === statusFilter)
    .filter((inquiry) => {
      const created = inquiryCreatedDate(inquiry.created_at);
      return (!searchParams.date_from || created >= searchParams.date_from) && (!searchParams.date_to || created <= searchParams.date_to);
    })
    .filter((inquiry) => {
      if (!keyword) return true;
      const searchable = [
        inquiry.name,
        inquiry.email,
        inquiry.phone,
        inquiry.line_id,
        inquiry.subject,
        inquiry.message,
        inquiry.source,
        inquiry.status,
        inquiry.stay
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(keyword);
    });

  const pageSize = 20;
  const currentPage = Math.max(1, Number(searchParams.page) || 1);
  const paginatedRows = getPageSlice(rows, currentPage, pageSize);

  const sourceCounts = inquiries.reduce<Record<string, number>>((acc, inquiry) => {
    const source = inquirySourceLabel(inquiry.source, locale, copy.admin.inquiriesUnknownSource);
    acc[source] = (acc[source] ?? 0) + 1;
    return acc;
  }, {});
  const topSources = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const { newCount, activeCount, closedCount } = inquiryStageCounts(inquiries);

  const localCopy =
    locale === "zh"
      ? {
          heroKicker: "Contact desk",
          heroTitle: "表單聯絡工作台",
          heroText: "前台表單送進來的訂房請求與一般詢問都收在這裡。先看回覆壓力，再用同一張表格處理聯繫、報價與結案。",
          tableKicker: "Filtered contacts",
          tableTitle: "聯絡列表",
          tableText: "表格保留真實資料，但重新整理成營運更容易掃讀的主次層級。",
          sidebarKicker: "Editorial routing",
          sidebarTitle: "分流與處理手冊",
          sidebarText: "這裡保留低頻參考說明。主畫面只留真正會每天反覆操作的 KPI、篩選與列表。",
          workflowTitle: "Handling sequence",
          routingTitle: "Routing guide",
          contactLabel: "聯絡人",
          requestLabel: "基本需求",
          createdLabel: "建立時間",
          statusLabel: "狀態",
          messageLabel: "訊息摘要",
          actionsLabel: "操作",
          resultsLabel: "篩選結果",
          filterSummary: `${rows.length} / ${inquiries.length} 筆`,
          resetLabel: "重設",
          emptyTitle: "目前沒有符合條件的聯絡紀錄",
          emptyText: "可以清除條件重新查看全部紀錄，或等待前台表單送進新的訊息。",
          emptyAction: "清除篩選",
          needsReplyNote: "待處理的新訊息",
          activeNote: "正在聯繫、追蹤或等待報價的紀錄",
          closedNote: "已完成回覆流程的紀錄",
          sourceNote: "目前最常出現的來源摘要",
          contactSummaryFallback: "未留下其他聯絡方式",
          requestSummaryFallback: "未提供具體入住條件",
          noMessage: "尚未留下訊息",
          contactLine: "LINE",
          contactPhone: "電話",
          contactEmail: "Email"
        }
      : {
          heroKicker: "Contact desk",
          heroTitle: "Form contact operations",
          heroText:
            "Booking requests and general questions from the public forms, in one queue. Start with reply pressure, then work through contact, quoting, and closure from one table.",
          tableKicker: "Filtered contacts",
          tableTitle: "Contact list",
          tableText: "Keep the table for real operating work, but rebuild the hierarchy so contact details and request context are easier to scan.",
          sidebarKicker: "Editorial routing",
          sidebarTitle: "Routing and handling guide",
          sidebarText: "Keep low-frequency guidance here. The main workspace stays focused on KPIs, filtering, and the live queue.",
          workflowTitle: "Handling sequence",
          routingTitle: "Routing guide",
          contactLabel: "Contact",
          requestLabel: "Request",
          createdLabel: "Created",
          statusLabel: "Status",
          messageLabel: "Message summary",
          actionsLabel: "Actions",
          resultsLabel: "Filtered results",
          filterSummary: `${rows.length} / ${inquiries.length} records`,
          resetLabel: "Reset",
          emptyTitle: "Nothing matches the current filters",
          emptyText: "Clear the filters to review the full queue, or wait for new messages from the public forms.",
          emptyAction: "Clear filters",
          needsReplyNote: "New items waiting for a first reply",
          activeNote: "Open follow-ups that still need contact or quote work",
          closedNote: "Threads already completed and closed",
          sourceNote: "Most common incoming sources right now",
          contactSummaryFallback: "No additional contact details provided",
          requestSummaryFallback: "No specific stay or date context provided",
          noMessage: "No message left yet",
          contactLine: "LINE",
          contactPhone: "Phone",
          contactEmail: "Email"
        };

  const resetHref = "/admin/inquiries";
  const emptyAction = (
    <ButtonLink href={resetHref} size="sm">
      {localCopy.emptyAction}
    </ButtonLink>
  );

  const workflowSteps =
    copy.admin.inquiriesWorkflowSteps.length > 3 ? copy.admin.inquiriesWorkflowSteps.slice(0, 3) : copy.admin.inquiriesWorkflowSteps;

  return (
    <Page>
      <PageHeader
        eyebrow={localCopy.heroKicker}
        title={copy.admin.inquiriesTitle}
        help={
          <AdminSopButton label={localCopy.workflowTitle}>
            <ol>
              {workflowSteps.map(([step, title, text]) => (
                <li key={step}>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
          </AdminSopButton>
        }
        description={localCopy.heroText}
      />

      <AdminFlashes notice={searchParams.notice} error={searchParams.error} copy={copy.admin} />

      <Grid cols={4}>
        <StatCard
          hint={localCopy.needsReplyNote}
          icon={<Inbox />}
          label={copy.admin.inquiriesNewLabel}
          tone={newCount > 0 ? "warning" : "neutral"}
          value={newCount}
        />
        <StatCard hint={localCopy.activeNote} icon={<MessageSquareText />} label={copy.admin.inquiriesActiveLabel} tone="info" value={activeCount} />
        <StatCard hint={localCopy.closedNote} icon={<CircleCheck />} label={copy.admin.inquiriesClosedLabel} tone="success" value={closedCount} />
        <StatCard
          hint={
            topSources.length > 0
              ? topSources.map(([source, count]) => `${source} ${count}`).join(" · ")
              : localCopy.sourceNote
          }
          icon={<Route />}
          label={copy.admin.inquiriesSourcesTitle}
          tone="brand"
          value={topSources[0]?.[0] ?? copy.admin.inquiriesUnknownSource}
        />
      </Grid>

      <form method="get">
        <Toolbar>
          {kindFilter && <input name="kind" type="hidden" value={kindFilter} />}
          <SearchInput icon={<Search />} name="keyword" placeholder={copy.admin.adminInquiryKeyword} defaultValue={searchParams.keyword} />
          <Select name="status" defaultValue={showDeleted ? "deleted" : (searchParams.status ?? "")}>
            <option value="">{copy.admin.adminAllStatuses}</option>
            <option value="new">{copy.admin.statusLabels.new}</option>
            <option value="contacted">{copy.admin.statusLabels.contacted}</option>
            <option value="quoted">{copy.admin.statusLabels.quoted}</option>
            <option value="closed">{copy.admin.statusLabels.closed}</option>
            {/* The bin, as one more thing the list can be filtered to. */}
            <option value="deleted">{zh ? "已刪除" : "Deleted"}</option>
          </Select>
          <Input name="date_from" type="date" aria-label={copy.admin.adminDateFrom} defaultValue={searchParams.date_from} />
          <Input name="date_to" type="date" aria-label={copy.admin.adminDateTo} defaultValue={searchParams.date_to} />
          <Button type="submit" variant="primary">{copy.admin.adminFilter}</Button>
          <ButtonLink href={resetHref} variant="ghost">
            {localCopy.resetLabel}
          </ButtonLink>
        </Toolbar>
      </form>

      {kindFilter && <Callout tone="info"><span role="status">{zh
        ? (kindFilter === "booking" ? "目前僅顯示訂房請求；重設可查看全部表單。" : "目前僅顯示詢問紀錄；重設可查看全部表單。")
        : (kindFilter === "booking" ? "Showing booking requests only. Reset to view all submissions." : "Showing inquiry records only. Reset to view all submissions.")}</span></Callout>}

      <Card
        title={localCopy.tableTitle}
        description={localCopy.tableText}
        actions={
          <>
            <Badge tone="neutral">{localCopy.resultsLabel} · {localCopy.filterSummary}</Badge>
            <InquiryExportButton label={copy.admin.adminExportCsv} rows={rows} />
          </>
        }
        flush
      >
        <AdminTable
          rows={paginatedRows}
          /* The id is not what makes a row itself here: the two tables
             number themselves separately, so enquiry 3 and booking 3 sit
             in this list at once. `kind` is what tells them apart
             everywhere else on this page — the endpoints below, the CSV's
             first column — and it is what the key needs too. */
          rowKey={(row) => `${row.kind}-${row.id}`}
          emptyAction={emptyAction}
          emptyTitle={localCopy.emptyTitle}
          emptyText={localCopy.emptyText}
          columns={[
            {
              key: "contact",
              label: localCopy.contactLabel,
              render: (row) => {
                const inquiry = row as InboxRow;
                return (
                  <div className="inq-cell">
                    <strong className="inq-cell__title">{inquiry.name}</strong>
                    <span className="inq-cell__line">
                      <Mail />
                      {inquiry.email}
                    </span>
                    {inquiry.phone ? (
                      <span className="inq-cell__line">
                        <Phone />
                        {localCopy.contactPhone}: {inquiry.phone}
                      </span>
                    ) : null}
                    {inquiry.line_id ? (
                      <span className="inq-cell__line">
                        <MessageCircle />
                        {localCopy.contactLine}: {inquiry.line_id}
                      </span>
                    ) : null}
                    {!inquiry.phone && !inquiry.line_id ? <span className="a-muted">{localCopy.contactSummaryFallback}</span> : null}
                  </div>
                );
              }
            },
            {
              key: "request",
              label: localCopy.requestLabel,
              render: (row) => {
                const inquiry = row as InboxRow;
                const summary = formatStaySummary(inquiry, copy.admin.inquiriesUnknownSource, locale);
                return (
                  <div className="inq-cell">
                    <strong className="inq-cell__title">{inquiry.stay || inquirySourceLabel(inquiry.source, locale, copy.admin.inquiriesUnknownSource)}</strong>
                    {(summary.length > 0 || hasStayRequest(inquiry)) && <Chips>
                      {summary.length > 0 ? summary.map((item) => <Badge key={item}>{item}</Badge>) : <span className="a-muted">{localCopy.requestSummaryFallback}</span>}
                    </Chips>}
                  </div>
                );
              }
            },
            {
              key: "created_at",
              label: localCopy.createdLabel,
              render: (row) => <span className="inq-cell__nowrap">{formatDateTime(String(row.created_at ?? ""))}</span>
            },
            {
              key: "status",
              label: localCopy.statusLabel,
              render: (row) => <StatusBadge labels={copy.admin.statusLabels} status={String(row.status)} />
            },
            {
              key: "message",
              label: localCopy.messageLabel,
              render: (row) => {
                const inquiry = row as InboxRow;
                return (
                  <div className="inq-cell">
                    {/* 主旨 above the body: it is what an inbox is
                        scanned by, and it replaced the fixed 詢問類型 the
                        request column used to carry. */}
                    {inquiry.subject ? <strong className="inq-cell__title">{inquiry.subject}</strong> : null}
                    <p className="inq-cell__message">{String(inquiry.message || localCopy.noMessage)}</p>
                  </div>
                );
              }
            },
            {
              key: "actions",
              label: localCopy.actionsLabel,
              render: (row) => {
                if (!canWrite) return <span className="a-muted">-</span>;
                const s = String(row.status);
                const actions: [string, string][] = [];
                if (s === "new" || s === "pending") actions.push(["contacted", copy.admin.inquiryContacted]);
                if (s === "contacted") {
                  actions.push(["quoted", copy.admin.inquiryQuoted]);
                  actions.push(["closed", copy.admin.inquiryClosed]);
                }
                if (s === "quoted") actions.push(["closed", copy.admin.inquiryClosed]);
                const deleted = Boolean((row as AdminInquiry).deleted_at);
                /* Two tables behind one list, so every action has to be
                   aimed at the row's own endpoint. Picking by row rather
                   than by page is the whole reason the merge is safe. */
                const isBooking = (row as InboxRow).kind === "booking";
                const setStatus = isBooking ? updateBookingStatusAction : updateInquiryStatusAction;
                const remove = isBooking ? deleteBookingAction : deleteInquiryAction;
                const restore = isBooking ? restoreBookingAction : restoreInquiryAction;
                const purge = isBooking ? purgeBookingAction : purgeInquiryAction;
                /* What the delete dialog calls this row. The same value
                   the 聯絡人 column leads with, so the dialog names the
                   row the eye was on. */
                const sender = ((row as AdminInquiry).name || (row as AdminInquiry).email || "").trim();
                return (
                  <RowActions align="start">
                    {/* A deleted row offers only the way back — the
                        status buttons would be filing something that
                        is not in the list any more. */}
                    {deleted ? (
                      <>
                        <form action={restore.bind(null, String(row.id))}>
                          <SubmitButton className={buttonClass({ size: "sm" })}>{zh ? "復原" : "Restore"}</SubmitButton>
                        </form>
                        {/* The second delete. Both ask; this is the one
                            that keeps no copy, so it says so. */}
                        <ConfirmSubmitButton
                          action={purge.bind(null, String(row.id))}
                          body={
                            zh
                              ? `確定要永久刪除${sender ? `「${sender}」` : "這位訪客"}的這筆表單嗎？它會從資料庫中移除，且無法還原。`
                              : `Permanently delete the submission from ${sender ? `"${sender}"` : "this visitor"}? It will be removed from the database and cannot be restored.`
                          }
                          cancelLabel={copy.admin.adminConfirmCancel}
                          className={buttonClass({ size: "sm", variant: "danger" })}
                          confirmLabel={zh ? "永久刪除" : "Delete permanently"}
                          title={zh ? "永久刪除" : "Delete permanently"}
                        >
                          {zh ? "永久刪除" : "Delete permanently"}
                        </ConfirmSubmitButton>
                      </>
                    ) : (
                      <>
                        {actions.map(([status, label]) => (
                          <form key={status} action={setStatus.bind(null, String(row.id), status, statusReturnTo)}>
                            <SubmitButton className={buttonClass({ size: "sm" })}>{label}</SubmitButton>
                          </form>
                        ))}
                        {/* The first delete, which asks too. It is the
                            last button of a row of same-shaped ones,
                            and the row is a visitor's enquiry — naming
                            the sender is what makes the dialog able to
                            catch an aim one row off. */}
                        <ConfirmSubmitButton
                          action={remove.bind(null, String(row.id))}
                          body={
                            zh
                              ? `確定要刪除${sender ? `「${sender}」` : "這位訪客"}的這筆表單嗎？它會移到「已刪除」，可在該處還原。`
                              : `Delete the submission from ${sender ? `"${sender}"` : "this visitor"}? It moves to the deleted list, where it can be restored.`
                          }
                          cancelLabel={copy.admin.adminConfirmCancel}
                          className={buttonClass({ size: "sm", variant: "danger-ghost" })}
                          confirmLabel={zh ? "刪除" : "Delete"}
                          title={zh ? "確認刪除表單" : "Confirm submission deletion"}
                        >
                          {zh ? "刪除" : "Delete"}
                        </ConfirmSubmitButton>
                      </>
                    )}
                  </RowActions>
                );
              }
            }
          ]}
        />
        <AdminTablePagination pageSize={pageSize} totalRows={rows.length} />
      </Card>
    </Page>
  );
}

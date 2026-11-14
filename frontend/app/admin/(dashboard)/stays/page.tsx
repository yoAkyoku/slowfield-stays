import { BedDouble, CircleDollarSign, MapPin, Plus, Users } from "lucide-react";
import Link from "next/link";
import { adminUiText, getLocale, t } from "../../../modules/i18n";
import { getAdminProfile, getAdminStays, hasPermission } from "../../modules/adminApi";
import AdminEmptyState from "../../modules/AdminEmptyState";
import AdminFlash from "../../modules/AdminFlash";
import AdminSopButton from "../../modules/AdminSopButton";
import AdminTablePagination from "../../modules/AdminTablePagination";
import { trs } from "../../../modules/tr";
import { binBulkLabels } from "../../modules/adminUtils";
import { getPageSlice } from "../../modules/paginationUtils";
import StatusActions from "../../modules/StatusActions";
import BulkSelectForm from "../../modules/BulkSelectForm";
import { bulkDeleteStaysAction, deleteStayAction, purgeStayAction, restoreStayAction, updateStayStatusAction } from "../../modules/stayActions";
import StaysIssuesPanel from "./StaysIssuesPanel";
import StaysOverviewPanel from "./StaysOverviewPanel";
import StaysTabs from "./StaysTabs";
import StaysToolbar from "./StaysToolbar";
import { Badge, ButtonLink, Page, PageHeader, Stack } from "../../ui";
import { buildStayIssueRows, filterStays, normalizeStayTab, normalizeStayVisibility, stayIssueKeys, type AdminStayRecord } from "./staysConsoleData";

export default async function AdminStaysPage(
  props: {
    searchParams: Promise<{ destination?: string; error?: string; keyword?: string; notice?: string; page?: string; status?: string; tab?: string; visibility?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();
  const copy = t(locale);
  const ui = adminUiText(locale);
  const adminText = copy.admin as unknown as Record<string, string>;
  const visibility = normalizeStayVisibility(searchParams.visibility);
  const activeTab = normalizeStayTab(searchParams.tab);
  const [stays, profile] = await Promise.all([getAdminStays(visibility), getAdminProfile()]);
  const canWrite = hasPermission(profile.permissions, "stays:write");
  const rows = filterStays(stays as AdminStayRecord[], {
    destination: searchParams.destination,
    keyword: searchParams.keyword,
    status: searchParams.status
  }).map((stay) => ({ ...stay, issueKeys: stayIssueKeys(stay) }));


  const localCopy =
    locale === "zh"
      ? {
          description: "把住宿上架、列表維護與品質檢測拆成清楚的工作區，讓日常管理更聚焦。",
          destinationLabel: "搜尋目的地或區域",
          filterLabel: "套用篩選",
          fixLabel: "前往補齊",
          issuesAlertText: "這裡只列出缺少主圖、摘要、房型或 SEO 的住宿，方便集中補件。",
          issuesAlertTitle: "集中處理住宿缺漏與上架品質",
          issuesEmptyText: "目前沒有需要補齊的住宿。",
          issuesEmptyTitle: "所有住宿都已準備就緒",
          issuesTab: "待完善項目",
          keywordLabel: "搜尋名稱、摘要或區域",
          latestEmpty: "目前沒有最近更新的住宿。",
          latestKicker: "近期住宿",
          latestTitle: "最近編輯",
          listEmptyText: "調整篩選條件，或先建立第一筆住宿資料。",
          listEmptyTitle: "沒有符合條件的住宿",
          listTab: "住宿列表",
          missingSeo: "缺 SEO",
          overviewKicker: "Overview",
          overviewTab: "總覽概況",
          qualityIssues: "項待補齊",
          resetLabel: "清除",
          statsDestinations: "目的地",
          statsDestinationsNote: "目前住宿目錄涵蓋的地區數。",
          statsPublishedNote: "目前已對外顯示的住宿。",
          statsReviewNote: "等待最後檢查與上架決策。",
          statsTotal: "總住宿數",
          statsTotalNote: "依目前篩選條件統計的住宿數量。",
          workflowHeading: "住宿上架流程",
          workflowSteps: [
            { title: copy.admin.statusLabels.draft, description: "先建立住宿主資料與目的地資訊。" },
            { title: "補齊素材", description: "加入主圖、摘要、房型與價格。" },
            { title: copy.admin.statusLabels.review, description: "送審前確認 SEO 與內容完整度。" },
            { title: copy.admin.statusLabels.published, description: "發布後前台即可展示，後續再進編輯循環。" }
          ]
        }
      : {
          description: "Separate publishing, catalog management, and quality checks into focused work areas.",
          destinationLabel: "Search destination or region",
          filterLabel: "Apply filters",
          fixLabel: "Fix now",
          issuesAlertText: "Only stays missing hero images, summaries, room types, or SEO metadata are listed here.",
          issuesAlertTitle: "Fix listing gaps before publishing",
          issuesEmptyText: "No stay issues need attention right now.",
          issuesEmptyTitle: "All stays are ready",
          issuesTab: "Issues",
          keywordLabel: "Search name, summary, or region",
          latestEmpty: "No recent stay activity yet.",
          latestKicker: "Recent stays",
          latestTitle: "Latest edits",
          listEmptyText: "Adjust the filters or create the first stay profile.",
          listEmptyTitle: "No stays match the current filters",
          listTab: "Stay list",
          missingSeo: "Missing SEO",
          overviewKicker: "Overview",
          overviewTab: "Overview",
          qualityIssues: "issues",
          resetLabel: "Reset",
          statsDestinations: "Destinations",
          statsDestinationsNote: "Unique destinations represented in the current catalog.",
          statsPublishedNote: "Listings currently visible on the public website.",
          statsReviewNote: "Listings waiting for the final editorial decision.",
          statsTotal: "Total stays",
          statsTotalNote: "Listings included in the current filter set.",
          workflowHeading: "Stay publishing workflow",
          workflowSteps: [
            { title: copy.admin.statusLabels.draft, description: "Create the stay profile with its core destination data." },
            { title: "Add assets", description: "Bring in the hero image, summary, room types, and pricing." },
            { title: copy.admin.statusLabels.review, description: "Check SEO and content completeness before approval." },
            { title: copy.admin.statusLabels.published, description: "Publish to make the listing visible, then iterate when needed." }
          ]
        };

  const deletedBadgeLabel = adminText.adminDeletedBadge ?? (locale === "zh" ? "已刪除" : "Deleted");
  /* 已刪除 is open: every row here is already deleted once. */
  const isBin = visibility === "deleted";
  const bulkPurgeLabels = binBulkLabels(adminText, locale === "zh");
  const visibilityLabels = {
    active: adminText.adminVisibilityActive ?? (locale === "zh" ? "啟用中" : "Active"),
    deleted: adminText.adminVisibilityDeleted ?? (locale === "zh" ? "已刪除" : "Deleted"),
    all: adminText.adminVisibilityAll ?? (locale === "zh" ? "全部" : "All")
  };
  const statusActionLabels = {
    archive: copy.admin.adminArchive,
    confirmArchive: copy.admin.adminConfirmArchive,
    confirmCancel: copy.admin.adminConfirmCancel,
    confirmDelete:
      adminText.adminConfirmDelete ??
      (locale === "zh"
        ? "要將這筆住宿移到刪除項目嗎？它會從前台與預設後台列表隱藏，之後仍可還原。"
        : "Move this stay to deleted items? It will be hidden from the public site and default admin list until restored."),
    confirmDraft: copy.admin.adminConfirmDraft,
    confirmPublish: copy.admin.adminConfirmPublish,
    confirmRestoreDeleted:
      adminText.adminConfirmRestoreDeleted ??
      (locale === "zh" ? "要還原這筆住宿嗎？原本狀態會保留。" : "Restore this stay? Its original status will be kept."),
    confirmReview: copy.admin.adminConfirmReview,
    confirmTitle: copy.admin.adminConfirmTitle,
    deleteLabel: adminText.adminDelete ?? (locale === "zh" ? "刪除" : "Delete"),
    edit: copy.admin.adminEdit,
    preview: copy.admin.adminPreview,
    publish: copy.admin.adminPublish,
    restoreDeleted: adminText.adminRestoreDeleted ?? (locale === "zh" ? "還原" : "Restore"),
    restoreDraft: copy.admin.adminRestoreDraft,
    purge: adminText.adminPurge ?? (locale === "zh" ? "永久刪除" : "Delete permanently"),
    confirmPurgeTitle: adminText.adminConfirmPurgeTitle ?? (locale === "zh" ? "永久刪除" : "Delete permanently"),
    /* Not the shared adminConfirmPurge: a stay is the one entity that takes
       other rows down with it, and the dialog is the last place to say so. */
    confirmPurge:
      locale === "zh"
        ? "確定要永久刪除這筆住宿嗎？房型、設施與圖片會一併移除，且無法還原。"
        : "Permanently delete this stay? Its room types, amenities and images go with it and cannot be restored.",
    submitReview: copy.admin.adminSubmitReview
  };

  const publishedCount = rows.filter((stay) => stay.status === "published").length;
  const reviewCount = rows.filter((stay) => stay.status === "review").length;
  const incompleteCount = rows.filter((stay) => stay.issueKeys.length > 0).length;
  const destinations = new Set(rows.map((stay) => stay.destination).filter(Boolean)).size;
  const missingHeroCount = rows.filter((stay) => !stay.hero_image_url).length;
  const missingSummaryCount = rows.filter((stay) => !stay.summary).length;
  const missingRoomsCount = rows.filter((stay) => !stay.room_types?.length).length;
  /* Counted from the issue keys rather than from the seo columns directly: the
     columns are overrides, and reading them here would put every stay back in
     the tile the keys no longer list. */
  const missingSeoCount = rows.filter(
    (stay) => stay.issueKeys.includes("missing_title") || stay.issueKeys.includes("missing_description"),
  ).length;
  const issueRows = buildStayIssueRows(rows);
  const overviewStats = [
    { label: localCopy.statsTotal, value: rows.length, note: localCopy.statsTotalNote },
    { label: copy.admin.statusLabels.published, value: publishedCount, note: localCopy.statsPublishedNote },
    { label: copy.admin.statusLabels.review, value: reviewCount, note: localCopy.statsReviewNote },
    { label: localCopy.statsDestinations, value: destinations, note: localCopy.statsDestinationsNote }
  ];
  const issueStats = [
    { key: "missing_hero", label: copy.admin.qualityMissingHero, value: missingHeroCount },
    { key: "missing_summary", label: copy.admin.qualityMissingSummary, value: missingSummaryCount },
    { key: "missing_rooms", label: copy.admin.qualityMissingRooms, value: missingRoomsCount },
    { key: "missing_seo", label: localCopy.missingSeo, value: missingSeoCount }
  ];
  const issueLabels = {
    missing_hero: copy.admin.qualityMissingHero,
    missing_summary: copy.admin.qualityMissingSummary,
    missing_rooms: copy.admin.qualityMissingRooms,
    missing_title: copy.admin.qualityMissingTitle,
    missing_description: copy.admin.qualityMissingDescription
  };
  const tabCounts = {
    overview: 0,
    list: rows.length,
    issues: issueRows.length
  };
  const hrefFor = (tab: "overview" | "list" | "issues") => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    params.set("visibility", visibility);
    if (searchParams.keyword) params.set("keyword", searchParams.keyword);
    if (searchParams.destination) params.set("destination", searchParams.destination);
    if (searchParams.status) params.set("status", searchParams.status);
    return `/admin/stays?${params.toString()}`;
  };
  const resetHref = `/admin/stays?tab=list&visibility=${encodeURIComponent(visibility)}`;
  const visibilityBase = `/admin/stays?tab=list&visibility=${encodeURIComponent(visibility)}`;
  const stayPageSize = 12;
  const stayCurrentPage = Math.max(1, Number(searchParams.page) || 1);
  const paginatedStays = getPageSlice(rows, stayCurrentPage, stayPageSize);
  const recentItems = rows.slice(0, 3).map((stay) => ({ ...stay, issueCount: stay.issueKeys.length }));

  return (
    <Page>
      <PageHeader
        actions={
          <>
            <AdminSopButton label={localCopy.workflowHeading}>
              <ol>
                {localCopy.workflowSteps.map((step) => (
                  <li key={step.title}>
                    <strong>{step.title}</strong>
                    <p>{step.description}</p>
                  </li>
                ))}
              </ol>
            </AdminSopButton>
            {canWrite ? (
              <ButtonLink href="/admin/stays/new" icon={<Plus />} variant="primary">
                {copy.admin.adminCreateStay}
              </ButtonLink>
            ) : null}
          </>
        }
        description={localCopy.description}
        eyebrow={localCopy.overviewKicker}
        title={copy.admin.staysTitle}
      />

      <AdminFlash closeLabel={copy.admin.adminFlashClose} message={searchParams.notice} title={copy.admin.adminFlashSuccess} tone="success" />
      <AdminFlash closeLabel={copy.admin.adminFlashClose} message={searchParams.error} title={copy.admin.adminFlashError} tone="error" />

      <StaysTabs
        activeTab={activeTab}
        counts={tabCounts}
        hrefFor={hrefFor}
        labels={{ overview: localCopy.overviewTab, list: localCopy.listTab, issues: localCopy.issuesTab }}
      />

      {activeTab === "overview" ? (
        <StaysOverviewPanel
          deletedBadgeLabel={deletedBadgeLabel}
          emptyLabel={localCopy.latestEmpty}
          items={recentItems}
          kicker={localCopy.latestKicker}
          stats={[
            ...overviewStats.slice(0, 3),
            { label: ui.stays.needsPolish, value: incompleteCount, note: locale === "zh" ? "仍需補圖、補摘要、補房型或補 SEO 的住宿。" : "Listings still missing imagery, copy, room details, or SEO." }
          ]}
          statusLabels={copy.admin.statusLabels as Record<string, string>}
        />
      ) : null}

      {activeTab === "list" ? (
        <Stack>
          <StaysToolbar
            destination={searchParams.destination}
            destinationLabel={localCopy.destinationLabel}
            filterLabel={localCopy.filterLabel}
            keyword={searchParams.keyword}
            keywordLabel={localCopy.keywordLabel}
            resetHref={resetHref}
            resetLabel={localCopy.resetLabel}
            status={searchParams.status}
            statusLabel={copy.admin.adminAllStatuses}
            statusLabels={copy.admin.statusLabels as Record<string, string>}
            visibility={visibility}
            visibilityLabels={visibilityLabels}
          />

          {rows.length ? (
            canWrite ? (
              <BulkSelectForm
                action={bulkDeleteStaysAction}
                labels={{
                  selectAll: copy.admin.bulkSelectAll,
                  selected: copy.admin.bulkSelected,
                  deleteSelected: isBin ? bulkPurgeLabels.deleteSelected : copy.admin.bulkDeleteSelected,
                  confirmTitle: isBin ? bulkPurgeLabels.confirmTitle : copy.admin.bulkConfirmTitle,
                  confirmText: isBin ? bulkPurgeLabels.confirmText : copy.admin.bulkConfirmText,
                  cancel: copy.admin.adminConfirmCancel
                }}
                purge={isBin}
                returnTo={visibilityBase}
              >
                <div className="stay-catalog-grid">
                  {paginatedStays.map((stay) => (
                    <article className="stay-catalog-card" key={stay.id}>
                      <input type="checkbox" name="ids" value={stay.id} className="bulk-select-checkbox" />
                      <Link aria-label={trs(stay, "name", locale)} className="stay-catalog-link" href={`/admin/stays/${stay.id}/edit`}>
                        <div className="stay-catalog-media">
                          {stay.hero_image_url ? <img src={stay.hero_image_url} alt="" /> : <div>{copy.admin.qualityMissingHero}</div>}
                        </div>
                        <div className="stay-catalog-body">
                          <div className="stay-catalog-heading">
                            <div>
                              <p className="a-eyebrow">{stay.region || stay.destination}</p>
                              <h2>{trs(stay, "name", locale)}</h2>
                            </div>
                            <div className="stay-catalog-heading-badges">
                              {stay.deleted_at ? <Badge tone="danger">{deletedBadgeLabel}</Badge> : null}
                            </div>
                          </div>
                          <p>{trs(stay, "summary", locale) || copy.admin.qualityMissingSummary}</p>
                          <dl className="stay-catalog-facts">
                            <div>
                              <dt>
                                <MapPin size={14} />
                                {copy.admin.adminDestination}
                              </dt>
                              <dd>{stay.destination || "-"}</dd>
                            </div>
                            <div>
                              <dt>
                                <CircleDollarSign size={14} />
                                {copy.admin.adminBasePrice}
                              </dt>
                              <dd>TWD {Number(stay.base_price).toLocaleString()}</dd>
                            </div>
                            <div>
                              <dt>
                                <Users size={14} />
                                {copy.admin.adminGuests}
                              </dt>
                              <dd>{stay.max_guests}</dd>
                            </div>
                            <div>
                              <dt>
                                <BedDouble size={14} />
                                {ui.stays.roomTypes}
                              </dt>
                              <dd>{stay.room_types?.length ?? 0}</dd>
                            </div>
                          </dl>
                        </div>
                      </Link>
                      <div className="stay-catalog-footer">
                        <div className="stay-catalog-footer-meta">
                          <Badge dot tone={stay.issueKeys.length ? "warning" : "success"}>
                            {stay.issueKeys.length ? `${stay.issueKeys.length} ${localCopy.qualityIssues}` : copy.admin.adminReady}
                          </Badge>
                        </div>
                        <div className="stay-catalog-actions">
                          <StatusActions
                            actions={{
                              archive: updateStayStatusAction.bind(null, String(stay.id), "archived"),
                              deleteItem: deleteStayAction.bind(null, String(stay.id), visibilityBase),
                              purgeItem: purgeStayAction.bind(null, String(stay.id), visibilityBase),
                              draft: updateStayStatusAction.bind(null, String(stay.id), "draft"),
                              publish: updateStayStatusAction.bind(null, String(stay.id), "published"),
                              restoreItem: restoreStayAction.bind(null, String(stay.id), visibilityBase),
                              review: updateStayStatusAction.bind(null, String(stay.id), "review")
                            }}
                            /* Named per row — see the note in StatusActions.
                               Deleting a stay takes its rooms and enquiries
                               with it, so this is the dialog that most needs to
                               say which one. */
                            confirmDeleteBody={
                              locale === "zh"
                                ? `確定要刪除住宿「${trs(stay, "name", locale)}」嗎？它會移到「已刪除」，可在該處還原。`
                                : `Delete the stay "${trs(stay, "name", locale)}"? It moves to the deleted list, where it can be restored.`
                            }
                            confirmPurgeBody={
                              locale === "zh"
                                ? `確定要永久刪除住宿「${trs(stay, "name", locale)}」嗎？它會從資料庫中移除，且無法還原。`
                                : `Permanently delete the stay "${trs(stay, "name", locale)}"? It will be removed from the database and cannot be restored.`
                            }
                            deletedAt={stay.deleted_at}
                            editHref={`/admin/stays/${stay.id}/edit`}
                            labels={statusActionLabels}
                            previewHref={`/admin/preview/stays/${stay.id}`}
                            status={stay.status}
                          />
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </BulkSelectForm>
            ) : (
              <div className="stay-catalog-grid">
                {paginatedStays.map((stay) => (
                  <article className="stay-catalog-card" key={stay.id}>
                    <Link aria-label={trs(stay, "name", locale)} className="stay-catalog-link" href={`/admin/stays/${stay.id}/edit`}>
                      <div className="stay-catalog-media">
                        {stay.hero_image_url ? <img src={stay.hero_image_url} alt="" /> : <div>{copy.admin.qualityMissingHero}</div>}
                      </div>
                      <div className="stay-catalog-body">
                        <div className="stay-catalog-heading">
                          <div>
                            <p className="a-eyebrow">{stay.region || stay.destination}</p>
                            <h2>{trs(stay, "name", locale)}</h2>
                          </div>
                          <div className="stay-catalog-heading-badges">
                            {stay.deleted_at ? <Badge tone="danger">{deletedBadgeLabel}</Badge> : null}
                          </div>
                        </div>
                        <p>{trs(stay, "summary", locale) || copy.admin.qualityMissingSummary}</p>
                      </div>
                    </Link>
                    <div className="stay-catalog-footer">
                      <div className="stay-catalog-footer-meta">
                        <Badge dot tone={stay.issueKeys.length ? "warning" : "success"}>
                          {stay.issueKeys.length ? `${stay.issueKeys.length} ${localCopy.qualityIssues}` : copy.admin.adminReady}
                        </Badge>
                      </div>
                      <div className="stay-catalog-actions">
                        <ButtonLink href={`/admin/preview/stays/${stay.id}`} size="sm" variant="ghost">{copy.admin.adminPreview}</ButtonLink>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )
          ) : (
            <AdminEmptyState text={localCopy.listEmptyText} title={localCopy.listEmptyTitle} />
          )}
          <AdminTablePagination pageSize={stayPageSize} totalRows={rows.length} />
        </Stack>
      ) : null}

      {activeTab === "issues" ? (
        <StaysIssuesPanel
          alertText={localCopy.issuesAlertText}
          alertTitle={localCopy.issuesAlertTitle}
          deletedBadgeLabel={deletedBadgeLabel}
          emptyText={localCopy.issuesEmptyText}
          emptyTitle={localCopy.issuesEmptyTitle}
          fixLabel={localCopy.fixLabel}
          issueLabels={issueLabels}
          rows={issueRows}
          stats={issueStats}
          statusLabels={copy.admin.statusLabels as Record<string, string>}
        />
      ) : null}
    </Page>
  );
}

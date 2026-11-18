import { contentTypeCatalogue } from "../../../modules/contentTypes";
import { articleCategories } from "../../modules/articlePlacement";
import { Plus, Search } from "lucide-react";
import { Button, ButtonLink, Page, PageHeader, SearchInput, Select, Stack, Toolbar } from "../../ui";
import "./cms.css";
import { adminUiText, getLocale, t } from "../../../modules/i18n";
import { getAdminBanners, getAdminPagesAll, getAdminProfile, getAdminSites, getCurrentAdminSiteSlug, hasPermission } from "../../modules/adminApi";
import { siteContentTypesFromConfig } from "../../modules/siteContentTypes";
import AdminSopButton from "../../modules/AdminSopButton";
import { AdminFlashes } from "../../modules/AdminFlash";
import AdminTablePagination from "../../modules/AdminTablePagination";
import { getPageSlice } from "../../modules/paginationUtils";
import BulkSelectForm from "../../modules/BulkSelectForm";
import { binBulkLabels } from "../../modules/adminUtils";
import {
  bulkDeleteBannersAction,
  bulkDeletePagesAction,
  deleteBannerAction,
  deletePageAction,
  purgeBannerAction,
  purgePageAction,
  restoreBannerAction,
  restorePageAction,
  updateBannerStatusAction,
  updatePageStatusAction
} from "../../modules/cmsActions";
import CmsBannersTable from "./CmsBannersTable";
import CmsIssuesPanel from "./CmsIssuesPanel";
import CmsOverviewPanel from "./CmsOverviewPanel";
import CmsPagesTable from "./CmsPagesTable";
import CmsTabs from "./CmsTabs";
import {
  bannerIssues,
  buildIssueRows,
  countCmsIssueStats,
  filterBanners,
  filterPages,
  normalizeTab,
  normalizeVisibility,
  pageIssues,
  type CmsTabKey
} from "./cmsConsoleData";

export default async function AdminCmsPage(
  props: {
    searchParams: Promise<{ category?: string; error?: string; notice?: string; page?: string; q?: string; status?: string; tab?: string; visibility?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();
  const copy = t(locale);
  const ui = adminUiText(locale);
  const adminText = copy.admin as unknown as Record<string, string>;
  const visibility = normalizeVisibility(searchParams.visibility);
  const activeTab = normalizeTab(searchParams.tab);
  const status = searchParams.status?.trim() ?? "";
  const category = searchParams.category?.trim() ?? "";
  const query = searchParams.q?.trim() ?? "";
  const [banners, pages, profile, sites] = await Promise.all([
    getAdminBanners(visibility),
    getAdminPagesAll(visibility),
    getAdminProfile(),
    getAdminSites(),
  ]);
  const canWrite = hasPermission(profile.permissions, "cms:write");
  const currentSiteSlug = await getCurrentAdminSiteSlug();
  const currentSite = sites.find((site) => site.slug === currentSiteSlug) ?? sites[0];
  const managedCategories = siteContentTypesFromConfig(currentSite);
  const managedCategoryLabels = new Map(managedCategories.map((item) => [item.key, locale === "zh" ? item.label.zh : item.label.en]));

  const localCopy =
    locale === "zh"
      ? {
          description: "新增與編輯文章，選擇文章分類、主題標籤，再預覽與發布。",
          emptyBannersText: "先建立首頁 Banner。已發布的 Banner 會出現在前台首頁輪播。",
          emptyBannersTitle: "目前沒有 Banner",
          emptyIssuesText: "目前沒有需要補齊的 CMS 項目。",
          emptyIssuesTitle: "待完善項目已清空",
          emptyPagesText: "先新增內容頁，之後可在這裡管理類別、狀態與 SEO。",
          emptyPagesTitle: "目前沒有內容頁",
          filterStatus: "狀態",
          filterVisibility: "顯示範圍",
          fixAction: "前往補齊",
          issueAlertText: "這裡只列出前台真的缺東西的項目。SEO 標題與描述留白不算缺漏，前台會自動沿用頁面標題與摘要。",
          issueAlertTitle: "補齊缺漏以提升 SEO 與內容完整度",
          issueLabels: {
            missing_body: "缺少內容",
            missing_cover: "缺少封面圖",
            missing_description: "缺少描述",
            missing_image: "缺少圖片",
            missing_title: "缺少標題"
          },
          issueStats: {
            missing_body: "缺少內容",
            missing_cover: "缺少封面圖",
            missing_description: "缺少描述",
            missing_image: "缺少圖片",
            missing_title: "缺少標題"
          },
          latestEmpty: "目前沒有最近更新內容。",
          latestKicker: "最近內容",
          latestTitle: "最近更新",
          overviewKicker: "總覽概況",
          panelBanners: "總 Banner",
          panelPages: "總內容頁",
          panelStatusPublished: "已發布",
          panelStatusReady: "待完善",
          pagesCategory: "文章分類",
          pagesIssues: "SEO / 內容缺漏",
          pagesSlug: "Slug",
          pagesTitleLabel: "標題",
          qBanner: "搜尋標題、副標題或 CTA",
          qPage: "搜尋標題、Slug、摘要或標籤",
          tabBanners: "Banner 管理",
          tabIssues: "待完善項目",
          tabOverview: "總覽概況",
          tabPages: "所有文章",
          tableActions: "操作",
          tableIssues: "缺漏",
          tableOrder: "排序",
          tableStatus: "狀態",
          tableThumbnail: "縮圖",
          tableTitle: "標題",
          typeBanner: "Banner",
          workflowHeading: "內容發布流程"
        }
      : {
          description: "Write and edit articles, choose where they appear and their topics, then preview and publish.",
          emptyBannersText: "Create a homepage banner first. Published banners appear in the public hero rotation.",
          emptyBannersTitle: "No banners yet",
          emptyIssuesText: "No CMS issues need attention right now.",
          emptyIssuesTitle: "All issues are cleared",
          emptyPagesText: "Create an editorial page first, then manage category, status, and SEO here.",
          emptyPagesTitle: "No content pages yet",
          filterStatus: "Status",
          filterVisibility: "Visibility",
          fixAction: "Fix now",
          issueAlertText: "Only entries the public site is actually missing something for. A blank SEO title or description is not one of them: the page falls back to its own title and summary.",
          issueAlertTitle: "Fix gaps to improve SEO and content readiness",
          issueLabels: {
            missing_body: "Missing body",
            missing_cover: "Missing cover",
            missing_description: "Missing description",
            missing_image: "Missing image",
            missing_title: "Missing title"
          },
          issueStats: {
            missing_body: "Missing body",
            missing_cover: "Missing cover",
            missing_description: "Missing description",
            missing_image: "Missing image",
            missing_title: "Missing title"
          },
          latestEmpty: "No recent content yet.",
          latestKicker: "Latest content",
          latestTitle: "Recent updates",
          overviewKicker: "Overview",
          panelBanners: "Total banners",
          panelPages: "Total pages",
          panelStatusPublished: "Published",
          panelStatusReady: "Needs work",
          pagesCategory: "Categories",
          pagesIssues: "SEO / Content Issues",
          pagesSlug: "Slug",
          pagesTitleLabel: "Title",
          qBanner: "Search title, subtitle, or CTA",
          qPage: "Search title, slug, summary, or tags",
          tabBanners: "Banners",
          tabIssues: "Issues",
          tabOverview: "Overview",
          tabPages: "Pages",
          tableActions: "Actions",
          tableIssues: "Issues",
          tableOrder: "Order",
          tableStatus: "Status",
          tableThumbnail: "Thumbnail",
          tableTitle: "Title",
          typeBanner: "Banner",
          workflowHeading: "Content publishing workflow"
        };


  const ctaPageName = (href: string) => {
    if (href === "/experience") return copy.admin.ctaHrefOptions.experience;
    if (href === "/contact") return copy.admin.ctaHrefOptions.contact;
    return copy.admin.ctaHrefOptions.stays;
  };

  const pageTypeName = (contentType?: string) => {
    const ct = (contentType || "").trim() || "page";
    if (managedCategoryLabels.has(ct)) return managedCategoryLabels.get(ct) as string;
    const categoryLabel = contentTypeCatalogue(currentSite, locale).get(ct)?.label;
    if (categoryLabel) return categoryLabel;
    if (ct in ui.cms.contentTypeLabels) {
      return ui.cms.contentTypeLabels[ct as keyof typeof ui.cms.contentTypeLabels];
    }
    return locale === "zh" ? "其他分類" : "Other category";
  };

  const pageRows = pages.map((page) => ({ ...page, computedIssues: pageIssues(page) }));
  const bannerRows = banners.map((banner) => ({ ...banner, computedIssues: bannerIssues(banner) }));
  const filteredPages = filterPages(pageRows, status, category, query);
  const pagesHaveNoMatches = filteredPages.length === 0 && (pages.length > 0 || Boolean(status || category || query) || visibility !== "active");
  const pagesEmptyTitle = pagesHaveNoMatches
    ? locale === "zh" ? "沒有符合條件的文章" : "No articles match your filters"
    : localCopy.emptyPagesTitle;
  const pagesEmptyText = pagesHaveNoMatches
    ? locale === "zh"
      ? "請調整顯示範圍、搜尋、狀態或文章分類，也可以使用上方「清除」重設條件。"
      : "Adjust visibility, search, status, or category, or use Reset above to clear the filters."
    : localCopy.emptyPagesText;
  const filteredBanners = filterBanners(bannerRows, status, query);
  const bannersHaveNoMatches = filteredBanners.length === 0 && (banners.length > 0 || Boolean(status || query) || visibility !== "active");
  const bannersEmptyTitle = bannersHaveNoMatches
    ? locale === "zh" ? "沒有符合條件的 Banner" : "No banners match your filters"
    : localCopy.emptyBannersTitle;
  const bannersEmptyText = bannersHaveNoMatches
    ? locale === "zh"
      ? "請調整顯示範圍、搜尋或狀態，也可以使用上方「清除」重設條件。"
      : "Adjust visibility, search, or status, or use Reset above to clear the filters."
    : localCopy.emptyBannersText;
  const cmsPageSize = 20;
  const cmsCurrentPage = Math.max(1, Number(searchParams.page) || 1);
  const paginatedPages = getPageSlice(filteredPages, cmsCurrentPage, cmsPageSize);
  const paginatedBanners = getPageSlice(filteredBanners, cmsCurrentPage, cmsPageSize);
  const issueRows = buildIssueRows(pageRows, bannerRows);
  const issueCount = issueRows.length;
  const usedContentTypes = new Set(pages.flatMap((page) => articleCategories(page)));
  // Filter options come from the current site's managed page categories, not
  // from arbitrary values stored on old content rows. This prevents property
  // slugs and internal keys such as `villa-hejing` from leaking here.
  const categories = managedCategories.map((item) => item.key);
  const knownLabels = new Set(Object.keys(ui.cms.contentTypeLabels));
  for (const contentType of Array.from(usedContentTypes).sort()) {
    if (knownLabels.has(contentType) && !categories.includes(contentType)) categories.push(contentType);
  }
  const publishedItems =
    banners.filter((banner) => banner.status === "published").length + pages.filter((page) => page.status === "published").length;
  const issueStatsByType = countCmsIssueStats(
    pageRows.map((page) => page.computedIssues),
    bannerRows.map((banner) => banner.computedIssues)
  );
  const missingImageCount = issueStatsByType.missing_image;
  const missingBodyCount = issueStatsByType.missing_body;
  const missingTitleCount = issueStatsByType.missing_title;
  const missingDescriptionCount = issueStatsByType.missing_description;
  const recentPages = pages.slice(0, 3).map((page) => ({ ...page, computedIssues: pageIssues(page) }));

  const statusActionLabels = {
    archive: copy.admin.adminArchive,
    confirmArchive: copy.admin.adminConfirmArchive,
    confirmCancel: copy.admin.adminConfirmCancel,
    confirmDelete:
      adminText.adminConfirmDelete ??
      (locale === "zh"
        ? "要將此項目移到已刪除嗎？它會從前台與預設後台列表隱藏，之後可再還原。"
        : "Move this item to deleted items? It will be hidden from the public site and default admin views until restored."),
    confirmDraft: copy.admin.adminConfirmDraft,
    confirmPublish: copy.admin.adminConfirmPublish,
    confirmRestoreDeleted:
      adminText.adminConfirmRestoreDeleted ??
      (locale === "zh" ? "要還原這個已刪除項目嗎？原本狀態會被保留。" : "Restore this deleted item? Its original status will be kept."),
    confirmReview: copy.admin.adminConfirmReview,
    confirmTitle: copy.admin.adminConfirmTitle,
    deleteLabel: adminText.adminDelete ?? (locale === "zh" ? "刪除" : "Delete"),
    edit: copy.admin.adminEdit,
    preview: copy.admin.adminPreview,
    publish: copy.admin.adminPublish,
    restoreDeleted: adminText.adminRestoreDeleted ?? (locale === "zh" ? "還原" : "Restore"),
    restoreDraft: copy.admin.adminRestoreDraft,
    submitReview: copy.admin.adminSubmitReview,
    purge: adminText.adminPurge ?? (locale === "zh" ? "永久刪除" : "Delete permanently"),
    confirmPurgeTitle: adminText.adminConfirmPurgeTitle ?? (locale === "zh" ? "永久刪除" : "Delete permanently"),
    confirmPurge:
      adminText.adminConfirmPurge ??
      (locale === "zh"
        ? "確定要永久刪除這個項目嗎？它會從資料庫中移除，且無法還原。"
        : "Permanently delete this item? It will be removed from the database and cannot be restored.")
  };

  const visibilityLabels = {
    active: adminText.adminVisibilityActive ?? (locale === "zh" ? "使用中" : "Active"),
    deleted: adminText.adminVisibilityDeleted ?? (locale === "zh" ? "已刪除" : "Deleted"),
    all: adminText.adminVisibilityAll ?? (locale === "zh" ? "全部" : "All")
  };

  const deletedBadgeLabel = adminText.adminDeletedBadge ?? (locale === "zh" ? "已刪除" : "Deleted");
  /* 已刪除 is open: every row listed has been deleted once already. */
  const isBin = visibility === "deleted";
  const bulkPurgeLabels = binBulkLabels(adminText, locale === "zh");
  const overviewStats = [
    { label: localCopy.panelBanners, value: banners.length, note: ui.cms.heroAssets },
    { label: localCopy.panelPages, value: pages.length, note: ui.cms.contentTypes.replace("{count}", String(categories.length)) },
    { label: localCopy.panelStatusPublished, value: publishedItems, note: ui.cms.visiblePublic },
    { label: localCopy.panelStatusReady, value: issueCount, note: ui.cms.waitingDecision }
  ];
  const issueStats = [
    { key: "missing_image", label: localCopy.issueStats.missing_image, value: missingImageCount },
    { key: "missing_body", label: localCopy.issueStats.missing_body, value: missingBodyCount },
    { key: "missing_title", label: localCopy.issueStats.missing_title, value: missingTitleCount },
    { key: "missing_description", label: localCopy.issueStats.missing_description, value: missingDescriptionCount }
  ];
  const tabCounts: Record<CmsTabKey, number> = {
    overview: 0,
    pages: pages.length,
    banners: banners.length,
    issues: issueCount
  };

  const hrefFor = (tab: CmsTabKey, overrides: Partial<Record<"category" | "q" | "status" | "visibility", string>> = {}) => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    params.set("visibility", overrides.visibility ?? visibility);
    const nextStatus = overrides.status ?? status;
    const nextCategory = overrides.category ?? category;
    const nextQuery = overrides.q ?? query;
    if (nextStatus) params.set("status", nextStatus);
    if (tab === "pages" && nextCategory) params.set("category", nextCategory);
    if ((tab === "pages" || tab === "banners") && nextQuery) params.set("q", nextQuery);
    return `/admin/cms?${params.toString()}`;
  };

  const tabLabels: Record<CmsTabKey, string> = {
    overview: localCopy.tabOverview,
    pages: localCopy.tabPages,
    banners: localCopy.tabBanners,
    issues: localCopy.tabIssues
  };

  /* The articles and banners tabs share their filter row, their bulk wording
     and one table each, drawn inside the bulk form for an editor and bare for a
     reader. The two branches each wrote the table out in full, and had already
     come apart: the read-only banner list ignored the pagination below it. */
  const filterActions = (tab: "pages" | "banners") => (
    <>
      <Button type="submit" variant="primary">{copy.admin.adminFilter}</Button>
      <ButtonLink href={`/admin/cms?tab=${tab}&visibility=${encodeURIComponent(visibility)}`} variant="ghost">
        {locale === "zh" ? "清除" : "Reset"}
      </ButtonLink>
    </>
  );

  const visibilityStatusSelects = (
    <>
      <Select aria-label={localCopy.filterVisibility} name="visibility" defaultValue={visibility}>
        <option value="active">{visibilityLabels.active}</option>
        <option value="deleted">{visibilityLabels.deleted}</option>
        <option value="all">{visibilityLabels.all}</option>
      </Select>
      <Select aria-label={localCopy.filterStatus} name="status" defaultValue={status}>
        <option value="">{localCopy.filterStatus}</option>
        <option value="draft">{copy.admin.statusLabels.draft}</option>
        <option value="review">{copy.admin.statusLabels.review}</option>
        <option value="published">{copy.admin.statusLabels.published}</option>
        <option value="archived">{copy.admin.statusLabels.archived}</option>
      </Select>
    </>
  );

  const bulkLabels = {
    selectAll: copy.admin.bulkSelectAll,
    selected: copy.admin.bulkSelected,
    deleteSelected: isBin ? bulkPurgeLabels.deleteSelected : copy.admin.bulkDeleteSelected,
    confirmTitle: isBin ? bulkPurgeLabels.confirmTitle : copy.admin.bulkConfirmTitle,
    confirmText: isBin ? bulkPurgeLabels.confirmText : copy.admin.bulkConfirmText,
    cancel: copy.admin.adminConfirmCancel
  };

  /** `writable` is the editor's table: row checkboxes and every write control. */
  const pagesTable = (writable: boolean) => (
    <CmsPagesTable
      canWrite={writable}
      locale={locale}
      actions={{
        archive: (id) => updatePageStatusAction.bind(null, String(id), "archived"),
        deleteItem: (id) => deletePageAction.bind(null, String(id), hrefFor("pages")),
        purgeItem: (id) => purgePageAction.bind(null, String(id), hrefFor("pages")),
        draft: (id) => updatePageStatusAction.bind(null, String(id), "draft"),
        publish: (id) => updatePageStatusAction.bind(null, String(id), "published"),
        restoreItem: (id) => restorePageAction.bind(null, String(id), hrefFor("pages")),
        review: (id) => updatePageStatusAction.bind(null, String(id), "review")
      }}
      categoryLabel={localCopy.pagesCategory}
      emptyText={pagesEmptyText}
      emptyTitle={pagesEmptyTitle}
      issueLabels={localCopy.issueLabels}
      labels={{
        actions: localCopy.tableActions,
        deletedLabel: deletedBadgeLabel,
        issues: localCopy.pagesIssues,
        slug: localCopy.pagesSlug,
        status: localCopy.tableStatus,
        title: localCopy.pagesTitleLabel
      }}
      pages={paginatedPages}
      pageTypeLabel={pageTypeName}
      showCheckbox={writable}
      statusActionLabels={statusActionLabels}
      statusLabels={copy.admin.statusLabels}
    />
  );

  const bannersTable = (writable: boolean) => (
    <CmsBannersTable
      canWrite={writable}
      locale={locale}
      actions={{
        archive: (id) => updateBannerStatusAction.bind(null, String(id), "archived"),
        deleteItem: (id) => deleteBannerAction.bind(null, String(id), hrefFor("banners")),
        purgeItem: (id) => purgeBannerAction.bind(null, String(id), hrefFor("banners")),
        draft: (id) => updateBannerStatusAction.bind(null, String(id), "draft"),
        publish: (id) => updateBannerStatusAction.bind(null, String(id), "published"),
        restoreItem: (id) => restoreBannerAction.bind(null, String(id), hrefFor("banners")),
        review: (id) => updateBannerStatusAction.bind(null, String(id), "review")
      }}
      banners={paginatedBanners}
      ctaLabel={ctaPageName}
      emptyText={bannersEmptyText}
      emptyTitle={bannersEmptyTitle}
      issueLabels={localCopy.issueLabels}
      labels={{
        actions: localCopy.tableActions,
        deletedLabel: deletedBadgeLabel,
        issues: localCopy.tableIssues,
        order: localCopy.tableOrder,
        status: localCopy.tableStatus,
        thumbnail: localCopy.tableThumbnail,
        title: localCopy.tableTitle
      }}
      showCheckbox={writable}
      statusActionLabels={statusActionLabels}
      statusLabels={copy.admin.statusLabels}
    />
  );

  return (
    <Page>
      <PageHeader
        eyebrow={localCopy.overviewKicker}
        title={locale === "zh" ? "文章工作台" : "Article workspace"}
        description={localCopy.description}
        meta={
            <AdminSopButton label={localCopy.workflowHeading}>
              <ol>
                {ui.cms.workflowSteps.map(([step, title, text]) => (
                  <li key={step}>
                    <strong>{title}</strong>
                    <p>{text}</p>
                  </li>
                ))}
              </ol>
            </AdminSopButton>
        }
        actions={
          canWrite ? (
            <>
              <ButtonLink href="/admin/cms/banners/new">
                {copy.admin.adminCreateBanner}
              </ButtonLink>
              <ButtonLink href="/admin/cms/pages/new" icon={<Plus />} variant="primary">
                {copy.admin.adminCreatePage}
              </ButtonLink>
            </>
          ) : null
        }
      />

      <Stack gap="lg">
      <CmsTabs activeTab={activeTab} counts={tabCounts} hrefFor={hrefFor} labels={tabLabels} />

      <AdminFlashes notice={searchParams.notice} error={searchParams.error} copy={copy.admin} />

      {activeTab === "overview" ? (
        <CmsOverviewPanel
          copy={{
            deletedLabel: deletedBadgeLabel,
            issueLabels: localCopy.issueLabels,
            latestEmpty: localCopy.latestEmpty,
            latestKicker: localCopy.latestKicker,
            latestTitle: localCopy.latestTitle,
            overviewTitle: localCopy.overviewKicker,
            workflowHeading: localCopy.workflowHeading
          }}
          pageTypeLabel={pageTypeName}
          latestPages={recentPages}
          stats={overviewStats}
          statusLabels={copy.admin.statusLabels}
        />
      ) : null}

      {activeTab === "pages" ? (
        <>
          <form action="/admin/cms" key={JSON.stringify([visibility, status, category, query])}>
            <input type="hidden" name="tab" value="pages" />
            <Toolbar end={filterActions("pages")}>
            <SearchInput aria-label={localCopy.qPage} defaultValue={query} icon={<Search />} name="q" placeholder={localCopy.qPage} />
            {visibilityStatusSelects}
            <Select aria-label={localCopy.pagesCategory} name="category" defaultValue={category}>
              <option value="">{localCopy.pagesCategory}</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {pageTypeName(item)}
                </option>
              ))}
            </Select>
            </Toolbar>
          </form>
          {canWrite ? (
            <BulkSelectForm action={bulkDeletePagesAction} labels={bulkLabels} purge={isBin} returnTo={hrefFor("pages")}>
              {pagesTable(true)}
            </BulkSelectForm>
          ) : (
            pagesTable(false)
          )}
          <AdminTablePagination pageSize={cmsPageSize} totalRows={filteredPages.length} />
        </>
      ) : null}

      {activeTab === "banners" ? (
        <>
          <form action="/admin/cms" key={JSON.stringify([visibility, status, category, query])}>
            <input type="hidden" name="tab" value="banners" />
            <Toolbar end={filterActions("banners")}>
            <SearchInput aria-label={localCopy.qBanner} defaultValue={query} icon={<Search />} name="q" placeholder={localCopy.qBanner} />
            {visibilityStatusSelects}
            </Toolbar>
          </form>
          {canWrite ? (
            <BulkSelectForm action={bulkDeleteBannersAction} labels={bulkLabels} purge={isBin} returnTo={hrefFor("banners")}>
              {bannersTable(true)}
            </BulkSelectForm>
          ) : (
            bannersTable(false)
          )}
          <AdminTablePagination pageSize={cmsPageSize} totalRows={filteredBanners.length} />
        </>
      ) : null}

      {activeTab === "issues" ? (
        <CmsIssuesPanel
          categoryLabel={pageTypeName}
          issueLabels={localCopy.issueLabels}
          issueRows={issueRows}
          issueStats={issueStats}
          labels={{
            bannerType: localCopy.typeBanner,
            deletedLabel: deletedBadgeLabel,
            emptyText: localCopy.emptyIssuesText,
            emptyTitle: localCopy.emptyIssuesTitle,
            fixAction: localCopy.fixAction,
            issueText: localCopy.issueAlertText,
            issueTitle: localCopy.issueAlertTitle,
            issues: localCopy.tableIssues,
            status: localCopy.tableStatus,
            title: localCopy.tableTitle,
            type: localCopy.pagesCategory
          }}
          statusLabels={copy.admin.statusLabels}
        />
      ) : null}
      </Stack>
    </Page>
  );
}

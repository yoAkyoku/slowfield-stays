import Link from "next/link";
import { notFound } from "next/navigation";
import { adminUiText, getLocale, t } from "../../../../modules/i18n";
import {
  getAdminContentTags,
  getAdminPagesAll,
  getAdminSites,
  getCurrentAdminSiteSlug,
  getAdminProfile,
  hasPermission,
  type AdminContentTag,
} from "../../../modules/adminApi";
import { AdminFlashes } from "../../../modules/AdminFlash";
import { createContentTagAction } from "../../../modules/cmsActions";
import { ContentTagCreateModal, ContentTagEditModal } from "./ContentTagModals";
import TagUsageModal from "./TagUsageModal";
import { tagUsage } from "../../../modules/tagUsage";
import AdminEmptyState from "../../../modules/AdminEmptyState";
import { Badge, Button, ButtonLink, Callout, Card, CellTitle, Chips, Disclosure, ListRow, ListRows, Page, PageHeader, SearchInput, Select, Stack, TableFrame, Toolbar } from "../../../ui";
import { Search } from "lucide-react";
import "../cms.css";

function TagRow({ tag, zh, canWrite, canManageSitePages, usage, siteId }: { siteId?: number; tag: AdminContentTag; zh: boolean; canWrite: boolean; canManageSitePages: boolean; usage: ReturnType<typeof tagUsage> }) {
  const topicArticleIds = new Set(usage.topicArticles.map((page) => page.id));
  const cardArticleIds = new Set(usage.cardArticles.map((page) => page.id));
  return (
    <tr>
      <td>
        <CellTitle title={zh ? tag.name_zh : tag.name_en || tag.name_zh} sub={zh ? tag.name_en || "尚未填寫英文名稱" : tag.name_zh} />
      </td>
      <td data-label={zh ? "用途與使用位置" : "Uses and placements"}>
        <Stack gap="sm">
        <Chips>
        {topicArticleIds.size > 0 && <Badge tone="brand">{zh ? `主題 · ${topicArticleIds.size}` : `Topic · ${topicArticleIds.size}`}</Badge>}
        {cardArticleIds.size > 0 && <Badge tone="info">{zh ? `卡片顯示 · ${cardArticleIds.size}` : `Card label · ${cardArticleIds.size}`}</Badge>}
        {(usage.publicCollections.length > 0 || usage.publicListings.length > 0) && <Badge>{zh ? "公開篩選" : "Public filter"}</Badge>}
        {usage.needsReview && <Badge tone="warning">{zh ? "待整理" : "Needs review"}</Badge>}
        {usage.filterBlocks.length > 0 && <Badge>{zh ? "區塊篩選" : "Collection filter"}</Badge>}
        </Chips>
        <TagUsageModal articleCount={usage.relatedArticles.length} tagId={tag.id} tagLabel={zh ? tag.name_zh : tag.name_en || tag.name_zh} zh={zh}>
          <Stack>
          <section aria-label={zh ? "關聯文章" : "Related articles"}>
            <h3 className="a-subhead">{zh ? `關聯文章（${usage.relatedArticles.length}）` : `Related articles (${usage.relatedArticles.length})`}</h3>
            {usage.relatedArticles.length ? <Card flush><ListRows>{usage.relatedArticles.map((page) => {
              const title = page.translations?.[zh ? "zh" : "en"]?.title || page.title;
              const categories = Array.from(new Set([page.content_type, ...(page.categories ?? [])].filter((key): key is string => Boolean(key))));
              const categoryLabels = categories.map((key) => usage.catalogue.find((item) => item.key === key)?.label[zh ? "zh" : "en"] ?? key);
              const statusLabel = page.status === "published" ? (zh ? "已發布" : "Published") : page.status === "draft" ? (zh ? "草稿" : "Draft") : page.status === "archived" ? (zh ? "已封存" : "Archived") : page.status;
              const relationships = [topicArticleIds.has(page.id) ? (zh ? "主題" : "Topic") : "", cardArticleIds.has(page.id) ? (zh ? "卡片顯示" : "Card label") : ""].filter(Boolean);
              return <ListRow href={`/admin/cms/pages/${page.id}/edit`} key={page.id} meta={[...relationships, statusLabel, ...categoryLabels].join(" · ")} title={title} />;
            })}</ListRows></Card> : <Callout tone="neutral">{zh ? "目前沒有文章使用這個標籤。" : "No articles currently use this tag."}</Callout>}
          </section>
          <Disclosure summary={zh ? "其他使用位置與提醒" : "Other uses and notes"}>
            <Stack gap="sm">
              {usage.placements.length > 0 && <section><h4 className="a-subhead">{zh ? "文章分類" : "Article categories"}</h4><ul>{usage.placements.map((key) => <li key={key}>{usage.catalogue.find((item) => item.key === key)?.label[zh ? "zh" : "en"] ?? (zh ? "其他內容頁" : "Other content page")}</li>)}</ul></section>}
              {usage.filterBlocks.map(key => { const label = key === "homepage" ? (zh ? "首頁" : "Homepage") : usage.catalogue.find(item => item.key === key)?.label[zh ? "zh" : "en"] ?? key; const actionLabel = canManageSitePages ? (zh ? `編輯「${label}」` : `Edit ${label}`) : (zh ? `檢視「${label}」` : `View ${label}`); return <p key={key}>{zh ? "內容集合篩選：" : "Collection filter: "}{siteId ? <Link href={`/admin/sites/${siteId}/pages/${encodeURIComponent(key)}`}>{actionLabel}</Link> : label}</p>; })}
              {usage.publicListings.map(place => <p key={place}>{zh ? "公開列表篩選：" : "Public listing filter: "}{place}</p>)}
              {usage.publicCollections.map(place => <p key={place.key}>{zh ? "公開區塊篩選：" : "Public collection filter: "}{place.label}</p>)}
              {usage.needsReview && <p>{zh ? "名稱或文章中的重複詞彙需要檢查。請編輯名稱、整理文章標籤，或封存不再使用的標籤。" : "Review this name or repeated article tags. Edit the label, tidy article tags or archive unused vocabulary."}</p>}
            </Stack>
          </Disclosure>
          </Stack>
        </TagUsageModal>
        </Stack>
      </td>
      <td className="is-shrink" data-label={zh ? "使用量" : "Usage"}>
        <strong>{usage.relatedArticles.length}</strong>{" "}
        <span className="a-field__hint">{zh ? "篇文章" : "pages"}</span>
      </td>
      <td data-label={zh ? "狀態" : "Status"}>
        <Badge dot tone={tag.status === "active" ? "success" : "neutral"}>
          {tag.status === "active" ? (zh ? "使用中" : "Active") : (zh ? "已封存" : "Archived")}
        </Badge>
      </td>
      <td>
        <ContentTagEditModal
          canWrite={canWrite}
          closeLabel={zh ? "關閉標籤視窗" : "Close tag dialog"}
          tag={tag}
          usageCount={usage.relatedArticles.length}
          zh={zh}
        />
      </td>
    </tr>
  );
}

export default async function AdminContentTagsPage(
  props: { searchParams: Promise<{ error?: string; notice?: string; q?: string; status?: string; usage?: string }> },
) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();
  const copy = t(locale);
  const ui = adminUiText(locale);
  const profile = await getAdminProfile();
  // The endpoint is site-scoped, and the same CMS read permission gates the
  // screen. Returning 404 keeps a user without access from learning another
  // site's tag catalogue exists through a guessed URL.
  if (!hasPermission(profile.permissions, "cms:read")) notFound();
  const [tags, pages, sites, slug] = await Promise.all([getAdminContentTags(true), getAdminPagesAll("active"), getAdminSites(), getCurrentAdminSiteSlug()]);
  const currentSite = sites.find((site) => site.slug === slug);
  const usageMap = new Map(tags.map((tag) => [tag.id, tagUsage(tag, pages, currentSite,locale === "zh",tags)]));
  const zh = locale === "zh";
  const canWrite = hasPermission(profile.permissions, "cms:write");
  const query = String(searchParams.q ?? "").trim();
  const status = searchParams.status === "active" || searchParams.status === "archived" ? searchParams.status : "all";
  const queryLower = query.toLocaleLowerCase();
  const usageFilter = ["topics", "cards", "filters", "public", "unused", "review"].includes(searchParams.usage ?? "") ? searchParams.usage : "all";
  const filteredTags = tags.filter((tag) => {
    const matchesStatus = status === "all" || tag.status === status;
    const matchesQuery = !queryLower || [tag.name_zh, tag.name_en, tag.slug].some((value) => value.toLocaleLowerCase().includes(queryLower));
    const usage = usageMap.get(tag.id)!;
    const matchesUsage = usageFilter === "topics" ? usage.topicArticles.length > 0 : usageFilter === "cards" ? usage.cardArticles.length > 0 : usageFilter === "filters" ? usage.filterBlocks.length > 0 : usageFilter === "public" ? usage.publicCollections.length > 0 || usage.publicListings.length > 0 : usageFilter === "review" ? usage.needsReview : usageFilter === "unused" ? !usage.topicArticles.length && !usage.cardArticles.length && !usage.filterBlocks.length && !usage.publicCollections.length && !usage.publicListings.length : true;
    return matchesStatus && matchesQuery && matchesUsage;
  });
  const archivedCount = tags.filter((tag) => tag.status === "archived").length;

  const isFiltered = Boolean(query || status !== "all" || usageFilter !== "all");

  return (
    <Page>
      <PageHeader
        eyebrow={zh ? "內容管理" : "Content management"}
        title={zh ? "文章標籤" : "Content tags"}
        description={zh ? "管理文章主題與卡片顯示標籤；文章分類在文章內選擇。" : "Manage article topics and card labels. Select categories in each article."}
        actions={canWrite ? <ContentTagCreateModal action={createContentTagAction} closeLabel={zh ? "關閉新增標籤視窗" : "Close add tag dialog"} zh={zh} /> : undefined}
      />

      <Stack gap="lg">
      <AdminFlashes notice={searchParams.notice} error={searchParams.error} copy={copy.admin} />

      <section aria-label={zh ? "標籤搜尋與篩選" : "Tag search and filters"}>
        <form method="get" key={JSON.stringify([query, status, usageFilter])}>
          <Toolbar end={<><Button type="submit" variant="primary">{zh ? "套用篩選" : "Apply"}</Button>{isFiltered && <ButtonLink variant="ghost" href="/admin/cms/tags">{zh ? "清除" : "Clear"}</ButtonLink>}</>}>
            <SearchInput icon={<Search />} name="q" defaultValue={query} aria-label={zh ? "搜尋標籤" : "Search tags"} placeholder={zh ? "搜尋中文、英文或 slug" : "Search Chinese, English, or slug"} />
            <Select name="status" aria-label={zh ? "狀態" : "Status"} defaultValue={status}>
              <option value="all">{zh ? "全部狀態" : "All statuses"}</option>
              <option value="active">{zh ? "使用中" : "Active"}</option>
              <option value="archived">{zh ? "已封存" : "Archived"}</option>
            </Select>
            <Select name="usage" aria-label={zh ? "使用用途" : "Usage"} defaultValue={usageFilter}>
              <option value="all">{zh ? "全部用途" : "All uses"}</option>
              <option value="topics">{zh ? "文章主題" : "Article topics"}</option>
              <option value="public">{zh ? "公開篩選" : "Public filters"}</option>
              <option value="review">{zh ? "待整理名稱" : "Review names"}</option>
              <option value="cards">{zh ? "卡片顯示" : "Card labels"}</option>
              <option value="filters">{zh ? "內容集合篩選" : "Collection filters"}</option>
              <option value="unused">{zh ? "尚未使用" : "Unused"}</option>
            </Select>
          </Toolbar>
        </form>
      </section>

      <Card
        flush
        title={zh ? `顯示 ${filteredTags.length} / ${tags.length} 個標籤` : `${filteredTags.length} of ${tags.length} tags`}
        description={<>{zh ? "表格可左右捲動，查看使用位置與操作。" : "Scroll the table horizontally for placements and actions."}{archivedCount > 0 && <> {zh ? `另有 ${archivedCount} 個已封存標籤，可用狀態篩選找回。` : `${archivedCount} archived tag(s) can be shown with the status filter.`}</>}</>}
      >
        {filteredTags.length ? (
          <TableFrame stack label={zh ? "文章標籤表格" : "Content tags table"} scrollHint={zh ? "表格可左右捲動，查看使用位置與操作。" : "Scroll the table horizontally for placements and actions."}>
              <table className="a-table cms-table cms-sticky-first">
                <thead>
                  <tr>
                    <th>{zh ? "標籤" : "Tag"}</th>
                    <th>{zh ? "用途與使用位置" : "Uses and placements"}</th>
                    <th>{zh ? "使用量" : "Usage"}</th>
                    <th>{zh ? "狀態" : "Status"}</th>
                    <th>{zh ? "操作" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody>{filteredTags.map((tag) => <TagRow siteId={currentSite?.id} canManageSitePages={currentSite?._can_edit !== false && hasPermission(profile.permissions, "site_users:write")} canWrite={canWrite} key={tag.id} tag={tag} zh={zh} usage={usageMap.get(tag.id)!} />)}</tbody>
              </table>
          </TableFrame>
        ) : (
          <AdminEmptyState
            title={tags.length ? (zh ? "找不到符合的標籤" : "No matching tags") : (zh ? "尚未有文章標籤" : "No content tags yet")}
            text={tags.length ? (zh ? "換一個關鍵字或清除篩選條件。" : "Try another search or clear the filters.") : canWrite ? (zh ? "先新增一個標籤，再到文章編輯頁用多選視窗套用。" : "Add a tag, then select it from the article editor's multi-select picker.") : (zh ? "目前沒有可用的文章標籤。" : "There are no content tags available.")}
            action={tags.length > 0 && isFiltered ? <ButtonLink href="/admin/cms/tags">{zh ? "清除篩選" : "Clear filters"}</ButtonLink> : undefined}
          />
        )}
      </Card>
      </Stack>
    </Page>
  );
}

import { ClipboardCheck, FilePen, ImageIcon, ListChecks } from "lucide-react";
import { getLocale } from "../../../modules/i18n";
import { getAdminBanners, getAdminPagesAll, getAdminProfile, hasPermission, AdminForbiddenError } from "../../modules/adminApi";
import { pageIssues } from "../cms/cmsConsoleData";
import { trs } from "../../../modules/tr";
import AdminEmptyState from "../../modules/AdminEmptyState";
import { Badge, ButtonLink, Card, Grid, ListRow, ListRows, Page, PageHeader, Stack, StatCard } from "../../ui";

export default async function PublishingTasks() {
  const locale = await getLocale(); const zh = locale === "zh";
  const profile = await getAdminProfile();
  if (!hasPermission(profile.permissions,"cms:read")) throw new AdminForbiddenError();
  const [pages,banners] = await Promise.all([getAdminPagesAll(),getAdminBanners()]);
  const issueLabels = zh
    ? {missing_body:"補上內文",missing_cover:"補上封面圖片",missing_title:"補上標題",missing_description:"補上摘要或內容描述"}
    : {missing_body:"Add article content",missing_cover:"Add a cover image",missing_title:"Add a title",missing_description:"Add a summary or description"};
  const active = pages.filter(page => !page.deleted_at && page.status !== "archived");
  const groups = [
    {key:"review",label:zh ? "等待審核" : "Awaiting review",pages:active.filter(page => page.status === "review"),icon:<ClipboardCheck/>,tone:"info" as const},
    {key:"draft",label:zh ? "繼續撰寫" : "Continue writing",pages:active.filter(page => page.status === "draft"),icon:<FilePen/>,tone:"neutral" as const},
    {key:"issues",label:zh ? "補齊文章內容" : "Complete article content",pages:active.filter(page => pageIssues(page).length > 0),icon:<ListChecks/>,tone:"warning" as const},
  ];
  const pendingBanners = banners.filter(banner => !banner.deleted_at && ["draft","review"].includes(banner.status));
  const canWrite = hasPermission(profile.permissions,"cms:write");
  return <Page>
    <PageHeader
      eyebrow={zh ? "內容" : "Content"}
      title={zh ? "發布待辦" : "Publishing tasks"}
      description={zh ? "先完成內容、確認預覽，再決定發布。內容建議不會阻擋發布。" : "Complete the content, check the preview and decide when to publish."}
      actions={<ButtonLink href="/admin/cms?tab=pages">{zh ? "所有文章" : "All articles"}</ButtonLink>}
    />
    <Stack gap="lg">
      <nav aria-label={zh ? "發布工作" : "Publishing work"}>
        <Grid cols={4}>
          {groups.map(group => <StatCard key={group.key} href={`#${group.key}`} label={group.label} value={group.pages.length} icon={group.icon} tone={group.tone}/>)}
          <StatCard href="#banners" label={zh ? "首頁橫幅" : "Homepage banners"} value={pendingBanners.length} icon={<ImageIcon/>} tone="brand"/>
        </Grid>
      </nav>
      {groups.map(group => <Card
        id={group.key}
        key={group.key}
        title={<>{group.label} <Badge tone={group.tone}>{group.pages.length}</Badge></>}
        actions={group.pages.length > 8 ? <ButtonLink size="sm" variant="ghost" href={group.key === "issues" ? "/admin/cms?tab=issues" : `/admin/cms?tab=pages&status=${group.key === "review" ? "review" : "draft"}`}>{zh ? `查看全部 ${group.pages.length} 篇` : `View all ${group.pages.length} articles`}</ButtonLink> : undefined}
        flush
      >
        {!group.pages.length ? <AdminEmptyState title={zh ? "目前沒有待辦。" : "Nothing to do here."} text="" variant="compact"/> : <ListRows>{group.pages.slice(0,8).map(page => <ListRow
          key={page.id}
          title={trs(page,"title",locale)}
          meta={<>{page.status === "review" ? (zh ? "待審" : "Review") : page.status === "draft" ? (zh ? "草稿" : "Draft") : (zh ? "已發布" : "Published")}{group.key === "issues" && <> · {pageIssues(page).map(issue=>issueLabels[issue]).join(zh ? "、" : ", ")}</>}</>}
          aside={<>
            <ButtonLink size="sm" href={`/admin/cms/pages/${page.id}/edit`}>{canWrite ? (zh ? "編輯" : "Edit") : (zh ? "檢視" : "View")}</ButtonLink>
            <ButtonLink size="sm" variant="ghost" href={`/admin/preview/content/${page.id}`}>{zh ? "預覽" : "Preview"}</ButtonLink>
          </>}
        />)}</ListRows>}
      </Card>)}
      <Card
        id="banners"
        title={zh ? "待處理首頁橫幅" : "Homepage banners to complete"}
        actions={<ButtonLink size="sm" variant="ghost" href="/admin/cms?tab=banners">{zh ? "管理所有橫幅" : "Manage all banners"}</ButtonLink>}
        flush
      >
        {pendingBanners.length ? <ListRows>{pendingBanners.map(banner => <ListRow
          key={banner.id}
          title={banner.title}
          aside={<ButtonLink size="sm" href={`/admin/cms/banners/${banner.id}/edit`}>{zh ? "開啟橫幅" : "Open banner"}</ButtonLink>}
        />)}</ListRows> : <AdminEmptyState title={zh ? "目前沒有待辦。" : "Nothing to do here."} text="" variant="compact"/>}
      </Card>
    </Stack>
  </Page>;
}

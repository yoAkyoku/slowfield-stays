import { getLocale } from "../../../modules/i18n";
import { getAdminPagesAll, getAdminSites, getAdminProfile, getCurrentAdminSiteSlug, getAdminArticleCategories, hasPermission, AdminForbiddenError } from "../../modules/adminApi";
import { articleCategories } from "../../modules/articlePlacement";
import { pageLabel } from "../../../modules/contentTypes";
import { listingCategoriesForPage } from "../../../modules/contentRoutes";
import ListingCategoriesModal from "./ListingCategoriesModal";
import CreateWebsitePageModal from "./CreateWebsitePageModal";
import { listingPublicHref } from "../../modules/listingPublicHref";
import AdminFlash from "../../modules/AdminFlash";
import AdminEmptyState from "../../modules/AdminEmptyState";
import { ButtonLink, Callout, Card, CellTitle, RowActions, Page, PageHeader, Stack, TableFrame } from "../../ui";
import "../cms/cms.css";

export default async function WebsitePages({searchParams}: {searchParams: Promise<{error?:string;notice?:string;saved?:string;category?:string}>}) {
 const zh=(await getLocale())==="zh"; const profile=await getAdminProfile();
 if(!hasPermission(profile.permissions,"cms:read")) throw new AdminForbiddenError();
 const [articles,sites,slug,categories,query]=await Promise.all([getAdminPagesAll(),getAdminSites(),getCurrentAdminSiteSlug(),getAdminArticleCategories(),searchParams]);
 const site=sites.find(s=>s.slug===slug); const config=(site?.settings?.pages ?? {}) as Record<string,Record<string,unknown>>;
 const pages=Object.entries(config).filter(([key,p])=>key!=="homepage" && !p.deleted);
 const savedPage=query.saved && config[query.saved] && !config[query.saved].deleted ? query.saved : undefined;
 const requestedCategory=categories.find(c=>c.key===query.category && c.status==="active");
 const canEdit=hasPermission(profile.permissions,"site_users:write"); const canView=hasPermission(profile.permissions,"site_users:read");
 return <Page>
  <PageHeader
   eyebrow={zh ? "內容管理" : "Content management"}
   title={zh ? "網站頁面" : "Website pages"}
   description={zh ? "管理前台入口與版面；新增頁面不會建立文章分類。" : "Manage public entry points and layouts. New pages do not create article categories."}
   actions={<>{site && canView && <ButtonLink href={`/admin/sites/${site.id}`}>{zh ? "導覽與網站設定" : "Navigation and site settings"}</ButtonLink>}{canEdit && <CreateWebsitePageModal categories={categories} initialCategory={requestedCategory?.key} zh={zh}/>}</>}
  />
  <Stack gap="lg">
  <AdminFlash message={query.notice} title={zh ? "已完成" : "Done"} tone="success" closeLabel={zh ? "關閉" : "Close"}/><AdminFlash message={query.error} title={zh ? "未完成" : "Error"} tone="error" closeLabel={zh ? "關閉" : "Close"}/>
  {requestedCategory && <Callout tone="info" title={zh ? `為「${requestedCategory.label.zh}」設定前台入口` : `Set an entry point for ${requestedCategory.label.en || requestedCategory.label.zh}`}>{canEdit ? (zh ? "可在下方既有頁面按「設定收錄分類」，或按「新增頁面」建立文章列表。" : "Choose categories on an existing page below, or add an article listing page.") : (zh ? "目前帳號僅能查看，請網站管理者設定收錄分類。" : "This account can only view pages. Ask a website manager to configure included categories.")}</Callout>}
  {savedPage && site && <div role="status"><Callout tone="success" title={zh ? `已儲存「${pageLabel(savedPage,config[savedPage].label,zh ? "zh" : "en")}」` : "Page saved"} actions={<>{canView && <ButtonLink size="sm" href={`/admin/sites/${site.id}/pages/${encodeURIComponent(savedPage)}`}>{zh ? "接著編輯版面" : "Edit layout"}</ButtonLink>}<ButtonLink size="sm" variant="ghost" target="_blank" rel="noopener noreferrer" href={listingPublicHref(site,savedPage)}>{zh ? "查看前台（新分頁）" : "View public page (new tab)"}</ButtonLink></>}/></div>}
  <Card flush title={zh ? `共 ${pages.length} 個網站頁面` : `${pages.length} website pages`} description={zh ? "在表格內左右滑動查看更多欄位，頁面名稱固定；分類設定在右側操作。" : "Scroll inside the table for more columns. Page names stay visible; category settings are on the right."}>
   {pages.length ? <TableFrame label={zh ? "網站頁面表格" : "Website pages table"} scrollHint={zh ? "在表格內左右滑動查看更多欄位，頁面名稱固定；分類設定在右側操作。" : "Scroll inside the table for more columns. Page names stay visible; category settings are on the right."}><table className="a-table cms-table cms-sticky-first"><thead><tr>{(zh ? ["頁面","收錄文章分類","文章數","操作"] : ["Page","Included categories","Articles","Actions"]).map(t=><th key={t}>{t}</th>)}</tr></thead><tbody>{pages.map(([key,p])=>{
   const selected=listingCategoriesForPage(key,p);
   const label=pageLabel(key,p.label,zh ? "zh" : "en"); const count=selected.length ? articles.filter(a=>!a.deleted_at && articleCategories(a).some(k=>selected.includes(k))).length : 0;
   return <tr key={key}><th scope="row"><CellTitle title={label} sub={<code>/{key}</code>}/></th><td>{selected.length ? selected.map(k=>categories.find(c=>c.key===k)?.label[zh ? "zh" : "en"] || k).join("、") : <span className="a-field__hint">{zh ? "未收錄文章（一般頁面）" : "Layout only"}</span>}</td><td className="is-shrink">{count}</td><td><RowActions align="start">{site && <ButtonLink size="sm" variant="ghost" href={listingPublicHref(site,key)} target="_blank" rel="noopener noreferrer">{zh ? "查看前台" : "View public page"}</ButtonLink>}{site && canView && <ButtonLink size="sm" href={`/admin/sites/${site.id}/pages/${encodeURIComponent(key)}`}>{zh ? "編輯版面" : "Edit layout"}</ButtonLink>}{canEdit && <ListingCategoriesModal pageKey={key} label={label} selected={selected} categories={categories} zh={zh}/>}</RowActions></td></tr>;
   })}</tbody></table></TableFrame> : <AdminEmptyState variant="compact" title={zh ? "尚未建立網站頁面。" : "No website pages yet."} text=""/>}
  </Card>
  </Stack>
 </Page>;
}

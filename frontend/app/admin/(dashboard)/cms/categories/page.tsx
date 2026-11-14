import Link from "next/link";
import { Search } from "lucide-react";
import { getLocale } from "../../../../modules/i18n";
import { getAdminArticleCategories, getAdminPagesAll, getAdminSites, getCurrentAdminSiteSlug, getAdminProfile, hasPermission, AdminForbiddenError } from "../../../modules/adminApi";
import { articleCategories } from "../../../modules/articlePlacement";
import AdminFlash from "../../../modules/AdminFlash";
import AdminEmptyState from "../../../modules/AdminEmptyState";
import { listingPublicHref } from "../../../modules/listingPublicHref";
import CategoryModal from "./CategoryModal";
import { Badge, Button, ButtonLink, Callout, Card, CellTitle, RowActions, Page, PageHeader, SearchInput, Select, Stack, TableFrame, Toolbar } from "../../../ui";
import "../cms.css";

export default async function CategoriesPage({searchParams}: {searchParams: Promise<{q?:string; status?:string; error?:string; notice?:string; category?:string}>}) {
 const zh=(await getLocale()) === "zh"; const profile=await getAdminProfile();
 if(!hasPermission(profile.permissions,"cms:read")) throw new AdminForbiddenError();
 const [categories, articles, sites, slug, query]=await Promise.all([getAdminArticleCategories(), getAdminPagesAll(), getAdminSites(), getCurrentAdminSiteSlug(), searchParams]);
 const site=sites.find(s=>s.slug===slug); const pages=(site?.settings?.pages ?? {}) as Record<string,Record<string,unknown>>;
 const canManagePages=hasPermission(profile.permissions,"site_users:write");
 const savedCategory=categories.find(c=>c.key===query.category);
 const searchTerm=(query.q ?? "").trim().toLocaleLowerCase();
 const filtered=categories.filter(c=>(!query.status || query.status==="all" || c.status===query.status) && (!searchTerm || [c.label.zh,c.label.en,c.key].some(v=>v.toLocaleLowerCase().includes(searchTerm))));
 const isFiltered=Boolean(searchTerm || (query.status && query.status!=="all"));
 return <Page>
  <PageHeader
   eyebrow={zh ? "內容管理" : "Content management"}
   title={zh ? "文章分類" : "Article categories"}
   description={zh ? "分類用來整理文章；網站頁面決定訪客從哪裡找到這些文章。" : "Categories organise articles; website pages determine where visitors find them."}
   actions={hasPermission(profile.permissions,"cms:write") ? <CategoryModal zh={zh}/> : undefined}
  />
  <Stack gap="lg">
  <AdminFlash message={query.notice} title={zh ? "已完成" : "Done"} tone="success" closeLabel={zh ? "關閉" : "Close"}/><AdminFlash message={query.error} title={zh ? "未完成" : "Error"} tone="error" closeLabel={zh ? "關閉" : "Close"}/>
  {query.notice && savedCategory && <div role="status"><Callout tone="success" title={zh ? `已儲存「${savedCategory.label.zh}」` : "Category saved"} actions={canManagePages ? <ButtonLink size="sm" href={`/admin/content-pages?category=${encodeURIComponent(savedCategory.key)}`}>{zh ? "前往網站頁面設定" : "Set up on website pages"}</ButtonLink> : undefined}>
   <p>{zh ? "要讓訪客找到這類文章，請到網站頁面設定此分類的入口。" : "To help visitors find these articles, add this category to a website page."}</p>
   {!canManagePages && <p>{zh ? "前台入口需由網站管理者設定；你仍可將文章加入此分類。" : "A website manager must configure the entry point. You can still assign articles to this category."}</p>}
  </Callout></div>}
  <form method="get" key={JSON.stringify([query.q ?? "", query.status ?? "all"])}>
   <Toolbar end={<><Button type="submit" variant="primary">{zh ? "篩選" : "Filter"}</Button><ButtonLink variant="ghost" href="/admin/cms/categories">{zh ? "清除" : "Clear"}</ButtonLink></>}>
    <SearchInput icon={<Search/>} name="q" defaultValue={query.q} aria-label={zh ? "搜尋分類" : "Search categories"} placeholder={zh ? "輸入名稱或網址代碼" : "Search name or URL key"}/>
    <Select name="status" aria-label={zh ? "狀態" : "Status"} defaultValue={query.status ?? "all"}><option value="all">{zh ? "全部" : "All"}</option><option value="active">{zh ? "使用中" : "Active"}</option><option value="archived">{zh ? "已封存" : "Archived"}</option></Select>
   </Toolbar>
  </form>
  <Card flush title={<span aria-live="polite">{isFiltered ? (zh ? `顯示 ${filtered.length} / ${categories.length} 個分類` : `Showing ${filtered.length} of ${categories.length} categories`) : (zh ? `共 ${categories.length} 個分類` : `${categories.length} categories`)}</span>} description={zh ? "在表格內左右滑動查看欄位；分類名稱固定，管理操作在右側。" : "Scroll inside the table for more columns. Names stay visible; actions are on the right."}>
   {filtered.length ? <TableFrame label={zh ? "文章分類表格" : "Article categories table"} scrollHint={zh ? "在表格內左右滑動查看欄位；分類名稱固定，管理操作在右側。" : "Scroll inside the table for more columns. Names stay visible; actions are on the right."}><table className="a-table cms-table cms-sticky-first"><thead><tr>{(zh ? ["分類","文章數","前台入口","狀態","操作"] : ["Category","Articles","Public entry","Status","Actions"]).map(t=><th key={t}>{t}</th>)}</tr></thead><tbody>{filtered.map(c=>{const linked=Object.entries(pages).filter(([key,p])=>key!=="homepage" && !p.deleted && (Array.isArray(p.article_categories) ? p.article_categories.includes(c.key) : (p.content_type ?? key)===c.key || (Array.isArray(p.extra_content_types) && p.extra_content_types.includes(c.key))));return <tr key={c.key}>
    <th scope="row"><CellTitle title={c.label[zh ? "zh" : "en"] || c.label.zh} sub={<>{zh ? "網址代碼" : "URL key"} <code>{c.key}</code></>}/></th>
    <td className="is-shrink">{articles.filter(a=>!a.deleted_at && articleCategories(a).includes(c.key)).length}</td>
    <td>{linked.length ? linked.map(([key,p])=><div key={key}>{site ? <Link href={listingPublicHref(site,key)} target="_blank" rel="noopener noreferrer">{typeof p.label==="object" ? String((p.label as Record<string,string>)[zh ? "zh" : "en"] || key) : String(p.label || key)}</Link> : key}</div>) : <Stack gap="sm"><span className="a-field__hint">{zh ? "尚未設定入口" : "No entry point"}</span>{c.status==="active" && (canManagePages ? <div><ButtonLink size="sm" href={`/admin/content-pages?category=${encodeURIComponent(c.key)}`}>{zh ? "設定入口" : "Set entry point"}</ButtonLink></div> : <small className="a-field__hint">{zh ? "請網站管理者設定入口" : "Ask a website manager to set an entry point"}</small>)}</Stack>}</td>
    <td>{c.status==="active" ? <Badge tone="success" dot>{zh ? "使用中" : "Active"}</Badge> : <Badge dot>{zh ? "已封存" : "Archived"}</Badge>}</td>
    <td><RowActions align="start"><ButtonLink size="sm" variant="ghost" href={`/admin/cms?tab=pages&category=${encodeURIComponent(c.key)}`}>{zh ? "管理文章" : "Manage articles"}</ButtonLink>{hasPermission(profile.permissions,"cms:write") && <CategoryModal category={c} zh={zh}/>}</RowActions></td>
   </tr>})}</tbody></table></TableFrame> : <AdminEmptyState variant="compact" title={zh ? "找不到符合的分類。" : "No categories found."} text={zh ? "請調整搜尋字詞或清除篩選條件。" : "Adjust the search or clear filters."}/>}
  </Card>
  </Stack>
 </Page>;
}

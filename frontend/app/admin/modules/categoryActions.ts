"use server";
import { adminJsonDataRequest, adminJsonRequest } from "./adminRequest";
import { actionRedirect } from "./adminUtils";
import { getLocale } from "../../modules/i18n";

export type CategoryFormState = { error?: string };
function errorText(message: string | undefined, zh: boolean) {
 const errors: Record<string,string> = {
  "Category key already exists":"分類代碼已被使用，請留白自動產生或換一個代碼。",
  "Page URL already exists":"此頁面網址已被使用，請留白自動產生或換一個網址。",
  "This URL is reserved for a system page":"此網址保留給系統頁面，請換一個網址。",
  "Choose active categories in this site":"分類已變更或封存，請重新選擇使用中的分類。",
  "Permission denied":"目前帳號沒有此操作權限。",
 };
 return zh ? errors[message ?? ""] ?? "儲存未完成，請檢查欄位或稍後再試。" : message ?? "Could not save. Please check the fields and try again.";
}
export async function saveArticleCategory(_state: CategoryFormState, form: FormData): Promise<CategoryFormState> {
 const zh=(await getLocale()) === "zh";
 const key=String(form.get("key") ?? "").trim();
 const editing=form.get("editing") === "1";
 const name=String(form.get("name_zh") ?? "").trim();
 if(!name) return {error:zh ? "請填寫中文名稱。" : "Enter a Chinese name."};
 const result=await adminJsonDataRequest<{key:string}>(editing ? `/cms/categories/${encodeURIComponent(key)}` : "/cms/categories",{key,name_zh:name,name_en:String(form.get("name_en") ?? ""),status:String(form.get("status") ?? "active")},editing ? "PUT" : "POST","Category save failed");
 if(!result.ok) return {error:errorText(result.message,zh)};
 const saved=result.data?.key ?? key;
 actionRedirect(result,`/admin/cms/categories?category=${encodeURIComponent(saved)}`,zh ? `已${editing ? "更新" : "新增"}分類「${name}」。` : `Category ${editing ? "updated" : "created"}.`);
}
export async function createWebsitePage(_state: CategoryFormState, form: FormData): Promise<CategoryFormState> {
 const zh=(await getLocale()) === "zh";
 const name=String(form.get("name_zh") ?? "").trim();
 if(!name) return {error:zh ? "請填寫頁面名稱。" : "Enter a page name."};
 const categories=form.get("kind") === "listing" ? form.getAll("categories").map(String) : [];
 if(form.get("kind") === "listing" && !categories.length) return {error:zh ? "文章列表至少要選擇一個分類。" : "Choose at least one category for an article listing."};
 const result=await adminJsonDataRequest<{page_key:string}>("/cms/listing-pages",{name_zh:name,name_en:String(form.get("name_en") ?? ""),slug:String(form.get("slug") ?? "").trim(),categories},"POST","Create page failed");
 if(!result.ok) return {error:errorText(result.message,zh)};
 actionRedirect(result,`/admin/content-pages?saved=${encodeURIComponent(result.data!.page_key)}`,zh ? `已新增「${name}」，尚未加入導覽。接著編輯版面或查看前台。` : "Page created. It is not in navigation yet. Edit its layout or view the public page.");
}
export async function saveListingCategories(_state: CategoryFormState, form: FormData): Promise<CategoryFormState> {
 const zh=(await getLocale()) === "zh";
 const key=String(form.get("page_key") ?? "");
 const selected=form.getAll("categories").map(String);
 const result=await adminJsonRequest(`/cms/listing-pages/${encodeURIComponent(key)}/categories`,{categories:selected},"PUT","Listing categories save failed");
 if(!result.ok) return {error:errorText(result.message,zh)};
 actionRedirect(result,`/admin/content-pages?saved=${encodeURIComponent(key)}`,zh ? (selected.length ? `已更新收錄條件：${selected.length} 個分類。` : "已取消文章收錄，此頁只顯示版面內容。") : (selected.length ? `${selected.length} categories included.` : "Article listing removed; layout content remains."));
}

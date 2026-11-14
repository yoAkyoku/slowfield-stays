"use server";
import { adminJsonRequest } from "./adminRequest";
import { actionRedirect } from "./adminUtils";
import { getLocale } from "../../modules/i18n";

export type TagModalState = { error?: string };
export async function saveTagModal(id: number | null, _state: TagModalState, form: FormData): Promise<TagModalState> {
 const zh = (await getLocale()) === "zh";
 const intent = String(form.get("intent") ?? "save");
 const name = String(form.get("name_zh") ?? "").trim();
 if (intent === "save" && !name) return {error: zh ? "請填寫中文名稱。" : "Enter a Chinese name."};
 const statusOnly = id !== null && (intent === "archived" || intent === "active");
 const result = await adminJsonRequest(statusOnly ? `/cms/tags/${id}/status` : id === null ? "/cms/tags" : `/cms/tags/${id}`, statusOnly ? {status:intent} : {
  name_zh:name, name_en:String(form.get("name_en") ?? "").trim(),
  slug:String(form.get("slug") ?? "").trim() || null,
  sort_order:Number(form.get("sort_order") ?? 0), status:String(form.get("status") ?? "active")
 },statusOnly ? "PATCH" : id === null ? "POST" : "PUT");
 if (!result.ok) return {error: result.message === "Permission denied" ? (zh ? "目前帳號沒有修改權限。" : "You do not have permission to edit.") : zh ? "儲存未完成，請檢查名稱、網址代碼是否重複，或稍後重試。你的輸入已保留。" : "Could not save. Check for a duplicate name or key and try again. Your input is preserved."};
 actionRedirect(result,"/admin/cms/tags",zh ? (statusOnly ? intent === "archived" ? "已封存標籤，既有文章仍保留。" : "已恢復標籤。" : `已${id === null ? "新增" : "儲存"}標籤「${name}」。`) : "Tag updated.");
}

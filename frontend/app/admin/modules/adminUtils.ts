import { redirect } from "next/navigation";
import type { AdminResult } from "./adminRequest";

/** Redirect with a unique timestamp to ensure flash messages re-trigger on repeated saves. */
export function stampedRedirect(url: string): never {
  const sep = url.includes("?") ? "&" : "?";
  redirect(`${url}${sep}_t=${Date.now()}`);
}

/**
 * Redirect after a server action completes.
 * On success: passes backend message (or fallback) via `notice` query param.
 * On error: passes error message via `error` query param.
 */
export function actionRedirect(
  result: AdminResult,
  basePath: string,
  fallbackNotice = "OK"
): never {
  const sep = basePath.includes("?") ? "&" : "?";
  if (result.ok) {
    const msg = result.message ?? fallbackNotice;
    stampedRedirect(`${basePath}${sep}notice=${encodeURIComponent(msg)}`);
  }
  stampedRedirect(`${basePath}${sep}error=${encodeURIComponent(result.message)}`);
}

/**
 * Wording for the bulk button while 已刪除 is the open view.
 *
 * Everything in that list has been deleted once already, so the only delete
 * left is the permanent one and the button has to say so before it is pressed.
 */
export function binBulkLabels(adminText: Record<string, string>, zh: boolean) {
  return {
    deleteSelected: adminText.bulkPurgeSelected ?? (zh ? "永久刪除" : "Delete permanently"),
    confirmTitle: adminText.bulkPurgeConfirmTitle ?? (zh ? "永久刪除" : "Delete permanently"),
    confirmText:
      adminText.bulkPurgeConfirmText ??
      (zh
        ? "確定要永久刪除 {count} 個所選項目嗎？它們會從資料庫中移除，且無法還原。"
        : "Permanently delete {count} selected items? They will be removed from the database and cannot be restored.")
  };
}

/**
 * Fire one delete per id and fold the outcome into a single result.
 *
 * `endpoint` is a function rather than a base path because the bin reuses this
 * for permanent removal: deleting from 已刪除 hits /purge, deleting from the
 * live list hits /delete. One helper, so the two paths cannot drift in how they
 * count failures or word the message.
 */
export async function bulkDeleteResult(
  ids: string[],
  endpoint: (id: string) => string,
  request: (path: string) => Promise<AdminResult>,
  verb: string
): Promise<AdminResult> {
  const results = await Promise.all(ids.map((id) => request(endpoint(id))));
  const failed = results.filter((r) => !r.ok);
  return failed.length
    ? { ok: false, message: `${failed.length} of ${ids.length} items failed` }
    : { ok: true, message: `${ids.length} items ${verb}` };
}

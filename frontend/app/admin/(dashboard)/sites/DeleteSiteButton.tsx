"use client";

import ConfirmSubmitButton from "../../modules/ConfirmSubmitButton";
import { deleteSiteAction } from "../../modules/siteActions";
import { buttonClass } from "../../ui";

/**
 * The themed confirm dialog, matching every other destructive action in this
 * admin. This used to be a raw window.confirm() on an onSubmit handler — a
 * browser-chrome alert for the one action that also removes the site's stays,
 * pages, banners, media and enquiries.
 *
 * No `action` prop: without one ConfirmSubmitButton submits the form it sits
 * in, which is what carries the site_id below.
 */
export default function DeleteSiteButton({ siteId, siteName, zh }: { siteId: string; siteName: string; zh: boolean }) {
  return (
    <form action={deleteSiteAction} className="admin-inline-danger-form">
      <input type="hidden" name="site_id" value={siteId} />
      <ConfirmSubmitButton
        /* The outlined-danger style the rest of the admin uses for destructive
           actions. Without a className this rendered as the browser's default
           grey button — the one unstyled control on the page, on the action
           that deletes the most (客戶: 改成紅框、無實心). */
        className={buttonClass({ variant: "danger-ghost", size: "sm" })}
        body={
          zh
            ? `確定要刪除「${siteName}」嗎？這個站點的住宿、內容頁、Banner、媒體與表單聯絡紀錄都會一併移除，且無法復原。`
            : `Delete "${siteName}"? Its stays, pages, banners, media and enquiries go with it, and this cannot be undone.`
        }
        cancelLabel={zh ? "取消" : "Cancel"}
        confirmLabel={zh ? "刪除" : "Delete"}
        title={zh ? "確認刪除網站" : "Confirm site deletion"}
      >
        {zh ? "刪除" : "Delete"}
      </ConfirmSubmitButton>
    </form>
  );
}

"use client";

import { Trash2 } from "lucide-react";
import { Button, Callout, Dialog, DialogActions, Stack } from "../../ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdminSiteSlug } from "../../modules/AdminSiteContext";
import { adminProxyUrl as proxyUrl } from "../../../modules/apiBase";

type Usage = { kind: string; id: number; title: string };

export default function DeleteMediaButton({
  id,
  labels,
  zh
}: {
  id: number;
  labels: { cancel: string; confirm: string; delete: string; deleting: string; title: string };
  zh: boolean;
}) {
  const router = useRouter();
  const siteSlug = useAdminSiteSlug();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  /* null = not looked up yet, [] = looked up and unused. Deleting media is
     permanent and unlinks the file, and nothing used to say whether anything
     still pointed at it — so removing a stay's hero or an image inside a
     published article broke those pages silently. */
  const [usage, setUsage] = useState<Usage[] | null>(null);
  const [usageFailed, setUsageFailed] = useState(false);

  async function openDialog() {
    setOpen(true);
    setUsage(null);
    setUsageFailed(false);
    try {
      const response = await fetch(proxyUrl(`/admin/media/${id}/usage`, siteSlug));
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json();
      setUsage(data.usages ?? []);
    } catch {
      // A failed lookup must not block the delete or imply the file is unused.
      setUsageFailed(true);
    }
  }

  const kindLabel = (kind: string) =>
    ({
      stay: zh ? "住宿" : "Stay",
      stay_gallery: zh ? "住宿圖庫" : "Stay gallery",
      page: zh ? "內容頁" : "Page",
      banner: zh ? "橫幅" : "Banner",
      announcement: zh ? "公告" : "Announcement",
      newsletter: zh ? "電子報" : "Newsletter",
      site: zh ? "網站設定" : "Website settings",
    })[kind] ?? kind;

  async function remove() {
    setOpen(false);
    setBusy(true);
    const site = siteSlug;
    const response = await fetch(proxyUrl(`/admin/media/${id}`, site), {
      method: "DELETE",
    });
    setBusy(false);
    if (response.status === 401) {
      window.location.href = "/admin/login";
      return;
    }
    if (response.ok) router.refresh();
  }

  return (
    <>
      <Button disabled={busy} icon={<Trash2 />} iconOnly onClick={openDialog} size="sm" variant="danger-ghost">
        {busy ? labels.deleting : labels.delete}
      </Button>
      <Dialog
        closeLabel={zh ? "關閉" : "Close"}
        footer={
          <DialogActions>
            <Button onClick={() => setOpen(false)}>{labels.cancel}</Button>
            <Button onClick={remove} variant="danger">{labels.delete}</Button>
          </DialogActions>
        }
        onClose={() => setOpen(false)}
        open={open}
        size="sm"
        title={labels.title}
      >
        <Stack gap="sm">
          <p className="ml-usage-note">{labels.confirm}</p>
          {usageFailed ? (
            <p className="ml-usage-note">
              {zh ? "無法確認這張圖片是否有人使用。" : "Could not check whether this image is in use."}
            </p>
          ) : usage === null ? (
            <p className="ml-usage-note">{zh ? "檢查使用中的位置…" : "Checking where it is used…"}</p>
          ) : usage.length > 0 ? (
            <Callout className="ml-usage-warning" tone="warning">
              <strong>
                {zh
                  ? `這張圖片有 ${usage.length} 處正在使用，刪除後那些位置會破圖：`
                  : `This image is used in ${usage.length} place${usage.length > 1 ? "s" : ""}. Deleting it will break them:`}
              </strong>
              <ul>
                {usage.slice(0, 6).map((u, i) => (
                  <li key={`${u.kind}-${u.id}-${i}`}>
                    {kindLabel(u.kind)}：{u.title || `#${u.id}`}
                  </li>
                ))}
              </ul>
              {usage.length > 6 && (
                <span>{zh ? `…另有 ${usage.length - 6} 處` : `…and ${usage.length - 6} more`}</span>
              )}
            </Callout>
          ) : (
            <p className="ml-usage-note">{zh ? "目前沒有任何地方使用這張圖片。" : "Nothing currently uses this image."}</p>
          )}
        </Stack>
      </Dialog>
    </>
  );
}

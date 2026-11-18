"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useErrorScreen } from "../../modules/useErrorScreen";
import { ADMIN_FORBIDDEN_DIGEST, ADMIN_SITE_MISSING_DIGEST } from "./adminErrorDigests";
import { clearAdminSiteCookie } from "./adminSiteCookie";

const labels = {
  en: {
    dashboard: "Dashboard",
    errorText: "The admin page could not be loaded. You can retry or return to the dashboard.",
    errorTitle: "Something went wrong",
    forbiddenText: "Your current role does not have access to this admin area. Ask a super-admin to adjust your role permissions.",
    forbiddenTitle: "Permission required",
    retry: "Retry",
    siteMissingText: "The site you were editing no longer exists — it may have been renamed, archived or removed. Switch back to your default site to carry on; you stay signed in.",
    siteMissingTitle: "Site unavailable",
    switchSite: "Switch to my default site"
  },
  zh: {
    dashboard: "返回儀表板",
    errorText: "後台頁面暫時無法載入。你可以重試，或先返回儀表板。",
    errorTitle: "頁面載入失敗",
    forbiddenText: "目前角色沒有此管理區的權限。請聯絡超級管理者調整角色或站點權限。",
    forbiddenTitle: "需要權限",
    retry: "重試",
    siteMissingText: "你正在編輯的站點已不存在，可能已被改名、封存或刪除。切回預設站點即可繼續作業，登入狀態不受影響。",
    siteMissingTitle: "站點無法使用",
    switchSite: "切回預設站點"
  }
} as const;

export default function AdminErrorScreen({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useErrorScreen(error);
  const [clearing, startClearing] = useTransition();
  /* digest first, name/message second: only the digest survives a production
     build (see adminApi). The name checks keep dev behaviour identical. */
  const isForbidden =
    error.digest === ADMIN_FORBIDDEN_DIGEST
    || error.name === "AdminForbiddenError"
    || error.message === "Permission denied";
  const isSiteMissing =
    error.digest === ADMIN_SITE_MISSING_DIGEST || error.name === "AdminSiteMissingError";
  const copy = labels[locale];

  const kicker = isForbidden ? "403" : isSiteMissing ? "404" : "Error";
  const title = isForbidden ? copy.forbiddenTitle : isSiteMissing ? copy.siteMissingTitle : copy.errorTitle;
  const text = isForbidden ? copy.forbiddenText : isSiteMissing ? copy.siteMissingText : copy.errorText;

  return (
    <main className="admin-page">
      <section className="admin-card admin-error-card">
        <span className="admin-action-kicker">{kicker}</span>
        <h1>{title}</h1>
        <p>{text}</p>
        <div className="admin-action-buttons">
          {isSiteMissing ? (
            <button
              className="admin-link-button admin-link-button-primary"
              type="button"
              disabled={clearing}
              onClick={() => startClearing(async () => {
                await clearAdminSiteCookie();
                // Full reload, not reset(): the sidebar and every editor read
                // the site from the cookie on mount, so they all have to
                // re-mount against the default site.
                window.location.href = "/admin";
              })}
            >
              {copy.switchSite}
            </button>
          ) : (
            <button className="admin-link-button admin-link-button-primary" type="button" onClick={reset}>
              {copy.retry}
            </button>
          )}
          <Link className="admin-link-button" href="/admin">
            {copy.dashboard}
          </Link>
        </div>
      </section>
    </main>
  );
}

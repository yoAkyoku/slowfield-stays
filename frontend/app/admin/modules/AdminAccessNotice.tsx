"use client";
import { usePathname } from "next/navigation";
import { Badge } from "../ui";
import "./AdminAccessNotice.css";

export default function AdminAccessNotice({ permissions, zh, siteName, siteId, target = false }: { permissions: string[]; zh: boolean; siteName: string; siteId?: number; target?: boolean }) {
  const path = usePathname();
  if (!target && /^\/admin\/sites\/\d+/.test(path)) return null;
  const allows = (key: string) => permissions.includes("*") || permissions.includes(key);
  const area = path.startsWith("/admin/cms") || path.startsWith("/admin/publishing") || path.startsWith("/admin/content-pages") ? "cms"
    : path.startsWith("/admin/stays") ? "stays" : path.startsWith("/admin/media") ? "media"
    : path.startsWith("/admin/newsletter") ? "newsletter" : path.startsWith("/admin/inquiries") || path.startsWith("/admin/booking-requests") ? "inquiries"
    : path.startsWith("/admin/roles") ? "roles" : path.startsWith("/admin/users") || path.startsWith("/admin/login-audits") ? "global_users"
    : path.startsWith("/admin/email-settings") || path.startsWith("/admin/readiness") || /^\/admin\/sites\/\d+(\/|$)/.test(path) ? "site_users" : "sites";
  const editable = allows(`${area}:write`);
  const overview = path === "/admin";
  const canManage = allows("site_users:write");
  return <div className="a-access-bar" role="note" aria-label={zh ? "目前網站與權限" : "Current site and access"}>
    <strong className="a-access-bar__site">{siteName}</strong><span className="a-access-bar__label">{zh ? "目前帳號：" : "Your access:"}</span>
    <Badge>{zh ? "可查看" : "Can view"}</Badge>
    {!overview && <Badge tone={editable ? "success" : "neutral"}>{editable ? (zh ? "可編輯" : "Can edit") : (zh ? "僅檢視" : "View only")}</Badge>}
    {["cms", "stays"].includes(area) && editable && <Badge tone="success">{zh ? "可發布" : "Can publish"}</Badge>}
    {area === "site_users" && /\/pages\//.test(path) && editable && <Badge tone="info">{zh ? "儲存後直接更新網站" : "Saving updates the site immediately"}</Badge>}
    <Badge tone={canManage ? "brand" : "neutral"}>{canManage ? (zh ? "可管理網站設定" : "Can manage site settings") : (zh ? "網站設定需管理者權限" : "Site settings require manager access")}</Badge>
  </div>;
}

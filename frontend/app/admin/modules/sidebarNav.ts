import {
  BookOpen,
  Building2,
  CalendarCheck,
  FileText,
  Globe,
  Home,
  Hotel,
  Image,
  KeyRound,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Newspaper,
  Rocket,
  Shield,
  ShieldCheck,
  Tags,
  Users
} from "lucide-react";
import type { AdminSite } from "./adminApi";

/* ─── Types ─── */
export type SidebarNavItem = {
  href: string;
  icon: typeof Home;
  label: string;
  external?: boolean;
};

export type SidebarNavGroup = {
  id: string;
  items: SidebarNavItem[];
  label: string;
};

/* ─── Icon map ─── */
const ICON_MAP: Record<string, typeof Home> = {
  "/admin": LayoutDashboard,
  "/admin/sites": Globe,
  "/admin/stays": Building2,
  "/admin/cms": FileText,
  "/admin/cms/tags": Tags,
  "/admin/homepage": Home,
  "/admin/property": Hotel,
  "/admin/inquiries": MessageSquare,
  "/admin/booking-requests": CalendarCheck,
  "/admin/media": Image,
  "/admin/users": Users,
  "/admin/roles": Shield,
  "/admin/email-settings": Mail,
  "/admin/newsletter": Newspaper,
  "/admin/readiness": Rocket,
  "/admin/login-audits": ShieldCheck,
  "/admin/account": KeyRound
};

export function getIcon(href: string) {
  return ICON_MAP[href] ?? BookOpen;
}

/* ─── Global mode: build nav groups from flat items ─── */
export function buildNavGroups(
  navItems: { href: string; label: string }[],
  zh: boolean,
  currentSiteId?: string | number | null
): SidebarNavGroup[] {
  const groupDefs: { id: string; label: string; hrefs: string[] }[] = [
    {
      id: "overview",
      label: zh ? "概覽" : "Overview",
      hrefs: ["/admin"]
    },
    {
      id: "site",
      label: zh ? "網站與頁面" : "Sites and pages",
      hrefs: ["/admin/sites", "/admin/homepage", "/admin/content-pages"]
    },
    {
      id: "content",
      label: zh ? "內容" : "Content",
      hrefs: ["/admin/stays", "/admin/cms", "/admin/cms/categories", "/admin/cms/tags"]
    },
    {
      id: "assets",
      label: zh ? "素材" : "Media",
      hrefs: ["/admin/cms?tab=banners", "/admin/media"]
    },
    {
      id: "operations",
      label: zh ? "發布與營運" : "Publishing and operations",
      hrefs: ["/admin/publishing", "/admin/booking-requests", "/admin/inquiries", "/admin/newsletter"]
    },
    {
      id: "system",
      label: zh ? "設定與權限" : "Settings and access",
      hrefs: ["/admin/users", "/admin/roles", "/admin/email-settings", "/admin/readiness", "/admin/login-audits"]
    }
  ];

  const itemMap = new Map(navItems.map((i) => [i.href, i]));

  return groupDefs
    .map((g) => ({
      id: g.id,
      label: g.label,
      items: g.hrefs
        .filter((href) => itemMap.has(href))
        .map((href) => {
          const item = itemMap.get(href)!;
          // "首頁編輯" is a shortcut into the currently-selected site's homepage
          // editor within 站群 management, not a standalone editor. Keep the
          // "/admin/homepage" key for grouping/icon, but route to the site page.
          const outHref =
            item.href === "/admin/homepage" && currentSiteId != null
              ? `/admin/sites/${currentSiteId}/pages/homepage`
              : item.href;
          return { href: outHref, label: item.label, icon: getIcon(item.href) };
        })
    }))
    .filter((g) => g.items.length > 0);
}

/* ─── Detect property context from site ─── */
export function isChildSite(site: AdminSite): boolean {
  return site.parent_site_id != null;
}


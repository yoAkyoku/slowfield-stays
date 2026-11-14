import {
  BookOpen,
  Building2,
  CalendarCheck,
  ExternalLink,
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
  Settings,
  Shield,
  ShieldCheck,
  Tags,
  Users
} from "lucide-react";
import type { AdminSite } from "./adminApi";
import { DEFAULT_PROPERTY_PAGES, pageLabel, type PropertyPageConfig } from "../../modules/property/types";

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

/* ─── Property site mode: build nav from site settings + global items ─── */
export function buildPropertyNavGroups(
  site: AdminSite,
  zh: boolean,
  navItems?: { href: string; label: string }[]
): SidebarNavGroup[] {
  const locale = zh ? "zh" : "en";
  const settings = site.settings ?? {};
  const pages = (settings.pages ?? {}) as Record<string, PropertyPageConfig>;
  const allPages = { ...DEFAULT_PROPERTY_PAGES, ...pages };

  // Sort pages by sort_order
  const sortedEntries = Object.entries(allPages).filter(([key, cfg]) => key !== "homepage" && cfg.deleted !== true).sort(
    ([, a], [, b]) => (a.sort_order ?? 99) - (b.sort_order ?? 99)
  );

  const siteId = String(site.id);
  const baseHref = `/admin/sites/${siteId}`;

  // Page items
  const pageItems: SidebarNavItem[] = [
    {
      href: baseHref,
      icon: LayoutDashboard,
      label: zh ? "頁面總覽" : "All Pages"
    },
    {
      href: `${baseHref}/pages/homepage`,
      icon: Home,
      label: zh ? "首頁" : "Homepage"
    },
    ...sortedEntries.map(([key, cfg]) => ({
      href: `${baseHref}/pages/${key}`,
      icon: cfg.page_type === "cms_list" ? FileText : BookOpen,
      label: pageLabel(key, allPages, locale)
    }))
  ];

  // Settings items
  const settingsItems: SidebarNavItem[] = [
    {
      // The editor is the site route itself — `${baseHref}/settings` is not a
      // route and never was.
      href: baseHref,
      icon: Settings,
      label: zh ? "網站設定" : "Site Settings"
    },
    {
      href: site.parent_site_id ? `/stays/${site.slug}` : `/`,
      icon: ExternalLink,
      label: zh ? "預覽網站" : "Preview Site",
      external: true
    }
  ];

  // Build content & operations groups from navItems (already permission-filtered)
  const itemSet = new Set(navItems?.map((i) => i.href));
  const childNavItems = (hrefs: string[]): SidebarNavItem[] =>
    hrefs
      .filter((href) => itemSet.has(href))
      .map((href) => {
        const item = navItems!.find((i) => i.href === href)!;
        return { href: item.href, label: item.label, icon: getIcon(item.href) };
      });

  const groups: SidebarNavGroup[] = [
    { id: "property-pages", label: zh ? "頁面" : "Pages", items: pageItems.filter(item => !navItems || (item.href === baseHref ? itemSet.has("/admin/sites") : itemSet.has("/admin/cms"))) },
  ];

  groups[0].items.push(...childNavItems(["/admin/content-pages"]));

  const contentItems = childNavItems(["/admin/cms", "/admin/cms/categories", "/admin/cms/tags"]);
  if (contentItems.length > 0) {
    groups.push({ id: "property-content", label: zh ? "內容管理" : "Content", items: contentItems });
  }

  const mediaItems = childNavItems(["/admin/cms?tab=banners", "/admin/media"]);
  if (mediaItems.length > 0) groups.push({ id: "property-media", label: zh ? "素材" : "Media", items: mediaItems });

  const opsItems = childNavItems(["/admin/publishing", "/admin/booking-requests", "/admin/inquiries", "/admin/newsletter"]);
  if (opsItems.length > 0) {
    groups.push({ id: "property-ops", label: zh ? "發布與營運" : "Publishing and operations", items: opsItems });
  }

  const sysItems = childNavItems(["/admin/email-settings"]);
  if (sysItems.length > 0) {
    groups.push({ id: "property-system", label: zh ? "設定與權限" : "Settings and access", items: sysItems });
  }

  groups.push({ id: "property-settings", label: zh ? "設定" : "Settings", items: settingsItems.filter(item => item.external || !navItems || itemSet.has("/admin/sites")) });

  return groups;
}

/* ─── Detect property context from site ─── */
export function isChildSite(site: AdminSite): boolean {
  return site.parent_site_id != null;
}

export function getChildSites(sites: AdminSite[]): AdminSite[] {
  return sites.filter((s) => s.parent_site_id != null);
}

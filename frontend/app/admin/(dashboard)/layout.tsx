import "../ui/admin-legacy.css";
import "../ui/admin-ui.css";
import { Suspense } from "react";
import { roleLabel } from "../../modules/roleLabel";
import LanguageToggle from "../../modules/LanguageToggle";
import NavigationProgress from "../../modules/NavigationProgress";
import { adminUiText, getLocale, t } from "../../modules/i18n";
import { getAdminProfile, getAdminSites, getCurrentAdminSiteSlug, hasPermission } from "../modules/adminApi";
import AdminSidebar from "../modules/AdminSidebar";
import AdminAccessNotice from "../modules/AdminAccessNotice";
import AdminTopbarLabel from "../modules/AdminTopbarLabel";
import ScrollToTopFab from "../../modules/ScrollToTopFab";
import { AdminSiteProvider } from "../modules/AdminSiteContext";
import DialogScrollLock from "../modules/DialogScrollLock";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const copy = t(locale);
  const ui = adminUiText(locale);
  const zh = locale === "zh";
  const [profile, sites] = await Promise.all([getAdminProfile(), getAdminSites()]);
  const permissions = profile.permissions;

  // Compute the effective site slug for THIS render (read-only — we cannot
  // mutate the cookie from a Server Component in Next 14, and even if we
  // could, the in-progress request's downstream fetches still see the stale
  // cookie). SiteSwitcher writes the corrected cookie client-side via a
  // server action on mount when there's a mismatch.
  const cookieSlug = await getCurrentAdminSiteSlug();
  const validSlug = sites.some((s) => s.slug === cookieSlug)
    ? cookieSlug
    : sites[0]?.slug ?? cookieSlug;
  const navItems = [
    { href: "/admin", label: copy.admin.nav.dashboard, show: true },
    { href: "/admin/sites", label: zh ? "站群網路" : "Site Network", show: hasPermission(permissions, "sites:read") || hasPermission(permissions, "site_users:read") },
    { href: "/admin/homepage", label: zh ? "首頁編輯" : "Homepage", show: hasPermission(permissions, "cms:read") },
    { href: "/admin/stays", label: copy.admin.nav.stays, show: hasPermission(permissions, "stays:read") },
    { href: "/admin/cms", label: zh ? "文章工作台" : "Articles", show: hasPermission(permissions, "cms:read") },
    { href: "/admin/cms/tags", label: zh ? "文章標籤" : "Content tags", show: hasPermission(permissions, "cms:read") },
    { href: "/admin/cms/categories", label: zh ? "文章分類" : "Article categories", show: hasPermission(permissions, "cms:read") },
    { href: "/admin/content-pages", label: zh ? "網站頁面" : "Website pages", show: hasPermission(permissions, "cms:read") },
    { href: "/admin/cms?tab=banners", label: zh ? "首頁橫幅" : "Homepage banners", show: hasPermission(permissions, "cms:read") },
    { href: "/admin/publishing", label: zh ? "發布待辦" : "Publishing tasks", show: hasPermission(permissions, "cms:read") },
    { href: "/admin/media", label: copy.admin.nav.media, show: hasPermission(permissions, "media:read") },
    { href: "/admin/inquiries", label: copy.admin.nav.inquiries, show: hasPermission(permissions, "inquiries:read") },
    { href: "/admin/newsletter", label: ui.dashboard.quickActions.newsletter[0], show: hasPermission(permissions, "newsletter:read") },
    { href: "/admin/users", label: copy.admin.nav.users, show: hasPermission(permissions, "global_users:read") },
    { href: "/admin/roles", label: copy.admin.nav.roles, show: hasPermission(permissions, "roles:read") },
    { href: "/admin/email-settings", label: copy.admin.nav.emailSettings, show: hasPermission(permissions, "site_users:read") },
    { href: "/admin/login-audits", label: copy.admin.nav.loginAnalytics, show: hasPermission(permissions, "global_users:read") }
  ].filter((item) => item.show);

  const topbarGroups = [
    { label: zh ? "概覽" : "Overview", hrefs: ["/admin"] },
    { label: zh ? "網站與頁面" : "Website & pages", hrefs: ["/admin/sites", "/admin/homepage", "/admin/content-pages"] },
    { label: zh ? "內容" : "Content", hrefs: ["/admin/stays", "/admin/cms", "/admin/cms/tags", "/admin/cms/categories"] },
    { label: zh ? "共用素材" : "Media", hrefs: ["/admin/media"] },
    { label: zh ? "發布與營運" : "Publishing & operations", hrefs: ["/admin/inquiries", "/admin/newsletter", "/admin/publishing"] },
    { label: zh ? "設定與權限" : "Settings & access", hrefs: ["/admin/users", "/admin/roles", "/admin/email-settings", "/admin/login-audits"] },
    { label: zh ? "帳號設定" : "Account", hrefs: ["/admin/account"] }
  ];

  return (
    <div className="admin-shell">
      <DialogScrollLock />
      <Suspense fallback={null}><NavigationProgress /></Suspense>
      <Suspense fallback={null}><AdminSidebar
        currentSiteSlug={validSlug}
        cookieSiteSlug={cookieSlug}
        navItems={navItems.map(({ href, label }) => ({ href, label }))}
        locale={locale}
        profileName={profile.name || profile.email}
        profileEmail={profile.email}
        profileRole={roleLabel(copy.admin.roleLabels, profile.role)}
        logoutLabel={copy.admin.adminLogout}
        siteLabel={copy.admin.adminCurrentSite}
        sites={sites}
      /></Suspense>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <div className="admin-kicker">{copy.admin.topKicker}</div>
            <Suspense fallback={null}><AdminTopbarLabel groups={topbarGroups} /></Suspense>
          </div>
          <div className="admin-topbar-actions">
            <LanguageToggle locale={locale} label={copy.site.language} />
          </div>
        </header>
        <AdminSiteProvider slug={validSlug} permissions={permissions}>
          <AdminAccessNotice permissions={permissions} zh={zh} siteName={sites.find((site) => site.slug === validSlug)?.name ?? validSlug} />
          {children}
        </AdminSiteProvider>
        <ScrollToTopFab />
      </div>
    </div>
  );
}

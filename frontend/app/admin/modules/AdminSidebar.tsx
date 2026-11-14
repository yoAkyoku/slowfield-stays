"use client";

import { ChevronDown, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { sidebarHrefIsActive } from "./sidebarActive";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AdminSite } from "./adminApi";
import { buildNavGroups } from "./sidebarNav";
import { useDismiss } from "../../modules/useDismiss";
import LogoutButton from "./LogoutButton";
import SiteSwitcher from "./SiteSwitcher";

/* Re-export for backward compat */
export { buildNavGroups, getIcon } from "./sidebarNav";

/* ─── Breakpoints ─── */
const BP_MOBILE = 820;
const BP_TABLET = 1100;

/* ─── Types ─── */
type Props = {
  currentSiteSlug: string;
  /** The raw admin-site cookie value, before the layout resolves it to a slug
   *  it knows exists. SiteSwitcher needs the unresolved value to notice a stale
   *  cookie; nav links need the resolved one. */
  cookieSiteSlug: string;
  locale: string;
  logoutLabel: string;
  navItems: { href: string; label: string }[];
  profileEmail: string;
  profileName: string;
  profileRole: string;
  siteLabel: string;
  sites: AdminSite[];
};

/* ─── Sidebar Component ─── */
export default function AdminSidebar({
  currentSiteSlug,
  cookieSiteSlug,
  locale,
  logoutLabel,
  navItems,
  profileEmail,
  profileName,
  profileRole,
  siteLabel,
  sites
}: Props) {
  const pathname = usePathname();
  const searchQuery = useSearchParams().toString();
  const zh = locale === "zh";

  const currentSiteId = useMemo(
    () => sites.find((s) => s.slug === currentSiteSlug)?.id ?? null,
    [sites, currentSiteSlug]
  );
  const groups = useMemo(
    () => buildNavGroups(navItems, zh, currentSiteId),
    [navItems, zh, currentSiteId]
  );

  /* Responsive mode: "desktop" | "tablet" | "mobile" */
  const [mode, setMode] = useState<"desktop" | "tablet" | "mobile">("desktop");

  /* Collapsed state — persisted in localStorage (desktop only) */
  const [collapsed, setCollapsed] = useState(false);

  /* Mobile overlay open state */
  const [mobileOpen, setMobileOpen] = useState(false);

  /* Track window width for responsive behavior */
  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      if (w <= BP_MOBILE) setMode("mobile");
      else if (w <= BP_TABLET) setMode("tablet");
      else setMode("desktop");
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  /* Load saved collapsed state (desktop only) */
  useEffect(() => {
    if (mode === "desktop") {
      const saved = localStorage.getItem("admin-sidebar-collapsed");
      if (saved === "true") setCollapsed(true);
    }
  }, [mode]);

  /* Listen for topbar hamburger custom event */
  useEffect(() => {
    function handleToggle() {
      setMobileOpen((prev) => !prev);
    }
    document.addEventListener("sidebar-toggle", handleToggle);
    return () => document.removeEventListener("sidebar-toggle", handleToggle);
  }, []);

  /* Close mobile overlay on route change */
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  /* Lock body scroll when mobile overlay is open */
  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  /* The drawer is a modal, so it has to behave like one.
     It already closed on a backdrop tap and locked body scroll, but a keyboard
     or screen-reader user could tab straight past the backdrop into the page
     behind it — which is still rendered and still focusable — and Escape did
     nothing, unlike every other menu in the admin. Focus moves in on open,
     cycles inside while it is open, and returns to whatever opened it. */
  const drawerRef = useRef<HTMLElement>(null);
  // Same condition as `useOverlay && mobileOpen`, written out because
  // useOverlay is derived further down the component.
  const isModal = mobileOpen && (mode === "mobile" || mode === "tablet");

  useEffect(() => {
    if (!isModal) return;
    const drawer = drawerRef.current;
    if (!drawer) return;

    const opener = document.activeElement as HTMLElement | null;
    const focusable = () =>
      Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);

    focusable()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      // Wrap at both ends rather than letting focus escape to the page behind.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus?.();
    };
  }, [isModal]);

  const toggle = useCallback(() => {
    if (mode === "mobile" || mode === "tablet") {
      setMobileOpen((prev) => !prev);
    } else {
      setCollapsed((prev) => {
        const next = !prev;
        localStorage.setItem("admin-sidebar-collapsed", String(next));
        return next;
      });
    }
  }, [mode]);

  /* Determine visual collapsed state */
  const useOverlay = mode === "mobile" || (mode === "tablet" && mobileOpen);
  const isCollapsed = mode === "tablet" && !mobileOpen ? true : mode === "mobile" ? false : collapsed;
  const isVisible = (mode === "mobile" || mode === "tablet") ? mobileOpen : true;

  /* Accordion — which groups are open */
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const active = groups.find((g) => g.items.some((i) => sidebarHrefIsActive(i.href,pathname,searchQuery)));
    return new Set(active ? [active.id] : [groups[0]?.id]);
  });

  const toggleGroup = useCallback((id: string) => {
    setOpenGroups((prev) => {
      if (prev.has(id)) return new Set<string>();
      return new Set([id]);
    });
  }, []);

  /* Update active group when route changes or mode switches */
  useEffect(() => {
    const active = groups.find((g) => g.items.some((i) => sidebarHrefIsActive(i.href,pathname,searchQuery)));
    if (active && !openGroups.has(active.id)) {
      setOpenGroups((prev) => new Set(prev).add(active.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchQuery, groups]);

  return (
    <>
      {/* Mobile hamburger — rendered via portal-like position in topbar */}
      {mode === "mobile" && (
        <button
          className="sb-mobile-trigger"
          type="button"
          // Keep this inline: Next may reuse the CSS asset URL between builds,
          // so a browser with the old z-index:60 rule cached would still paint
          // the sticky topbar over the button after deployment.
          style={{ zIndex: 61 }}
          onClick={toggle}
          aria-label={zh ? "開啟選單" : "Open menu"}
        >
          <Menu size={22} />
        </button>
      )}

      {/* Overlay backdrop (mobile & tablet) */}
      {useOverlay && mobileOpen && (
        <div className="sb-overlay" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        ref={drawerRef}
        aria-label={zh ? "後台選單" : "Admin menu"}
        aria-modal={isModal ? true : undefined}
        role={isModal ? "dialog" : undefined}
        className={[
          "admin-sidebar",
          isCollapsed ? "admin-sidebar--collapsed" : "",
          useOverlay ? "admin-sidebar--mobile" : "",
          useOverlay && mobileOpen ? "admin-sidebar--open" : "",
        ].filter(Boolean).join(" ")}
      >
        {/* Header: brand + toggle */}
        <div className="sb-header">
          <button className="sb-toggle" type="button" onClick={toggle} aria-label={zh ? "切換選單" : "Toggle menu"}>
            {useOverlay && mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          {!isCollapsed && (
            <Link className="sb-brand" href="/admin">
              Slowfield CMS
            </Link>
          )}
        </div>

        {/* Site Switcher — rendered collapsed too. It used to be hidden
            entirely below 1100px, which left no way to change site and, worse,
            nothing on screen saying which site you were editing. */}
        {sites.length > 0 && (
          <SiteSwitcher current={currentSiteSlug} cookieSlug={cookieSiteSlug} label={siteLabel} sites={sites} collapsed={isCollapsed} />
        )}

        {/* Navigation */}
        <nav className="sb-nav">
          {groups.map((group) => {
            const isOpen = openGroups.has(group.id);
            return (
              <div className={`sb-group ${isOpen ? "sb-group--open" : ""}`} key={group.id}>
                {/* Group header */}
                {!isCollapsed ? (
                  <button
                    className="sb-group-header"
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={isOpen}
                  >
                    <span>{group.label}</span>
                    <ChevronDown size={14} className="sb-chevron" />
                  </button>
                ) : (
                  <div className="sb-group-divider" />
                )}

                {/* Items */}
                <div className={`sb-group-items ${isOpen || isCollapsed ? "sb-group-items--visible" : ""}`}>
                  <div className="sb-group-items-inner">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      // Exact match, or prefix match (but not for overview-level hrefs that would match everything)
                      const isOverviewItem = /^\/admin\/property\/\d+$/.test(item.href);
                      const isActive = isOverviewItem ? pathname === item.href : sidebarHrefIsActive(item.href,pathname,searchQuery);
                      const linkProps = item.external
                        ? { target: "_blank" as const, rel: "noopener noreferrer" }
                        : {};
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`sb-item ${isActive ? "sb-item--active" : ""}`}
                          title={isCollapsed ? item.label : undefined}
                          {...linkProps}
                        >
                          <Icon size={18} />
                          {!isCollapsed && <span>{item.label}</span>}
                          {isCollapsed && <div className="sb-tooltip">{item.label}</div>}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        {/* Profile with dropdown */}
        <ProfileDropdown
          collapsed={isCollapsed}
          logoutLabel={logoutLabel}
          profileEmail={profileEmail}
          profileName={profileName}
          profileRole={profileRole}
        />
      </aside>
    </>
  );
}

/* ─── Profile Dropdown ─── */
function ProfileDropdown({
  collapsed,
  logoutLabel,
  profileEmail,
  profileName,
  profileRole
}: {
  collapsed: boolean;
  logoutLabel: string;
  profileEmail: string;
  profileName: string;
  profileRole: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useDismiss(ref, () => setMenuOpen(false), menuOpen);

  return (
    <div className="sb-profile" ref={ref}>
      <button
        className="sb-profile-trigger"
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
      >
        {!collapsed ? (
          <>
            <span className="sb-profile-name">{profileName}</span>
            <strong className="sb-profile-role">{profileRole}</strong>
          </>
        ) : (
          <div className="sb-profile-avatar" title={profileName}>
            {(profileName || "U").charAt(0).toUpperCase()}
          </div>
        )}
      </button>
      {menuOpen && (
        <div className="sb-profile-menu">
          <div className="sb-profile-menu-header">{profileName}</div>
          <Link
            href="/admin/account"
            className="sb-profile-menu-email"
            onClick={() => setMenuOpen(false)}
          >
            {profileEmail}
          </Link>
          <div className="sb-profile-menu-divider" />
          <LogoutButton label={logoutLabel} className="logout-button" />
        </div>
      )}
    </div>
  );
}

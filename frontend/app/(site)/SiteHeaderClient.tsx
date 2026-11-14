"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { Locale } from "../modules/i18n";
import LanguageToggle from "../modules/LanguageToggle";
import { useOverlay } from "../modules/useOverlay";
import HeaderSocial from "../modules/HeaderSocial";
import { pinnedNavLinks, type SiteNavLink } from "../modules/siteNav";

/** The shape the layout builds. Defined with the nav rules it belongs to; the
 *  name is kept here because the layout and the footer already import it. */
export type NavLink = SiteNavLink;

interface SiteHeaderClientProps {
  siteName: string;
  logoUrl?: string;
  locale: Locale;
  navLinks: NavLink[];
  /** Footer column headings. The header menu is a flat list and no longer
      groups, but the footer still labels its columns. */
  groupLabels?: { explore: string; stories: string; connect: string };
  languageLabel: string;
  /** Validated social URLs (empty string = hide). Shown as small icons at the far right. */
  social?: { instagram?: string; facebook?: string; line?: string; threads?: string; tiktok?: string };
  /** Show only the logo in the header (hide the site-name wordmark). */
  logoOnly?: boolean;
  /** Slide the bar away on scroll down. Off by default: the bar stays put. */
  autoHide?: boolean;
}

export default function SiteHeaderClient({
  siteName,
  logoUrl,
  locale,
  navLinks,
  languageLabel,
  social,
  logoOnly,
  autoHide = false,
}: SiteHeaderClientProps) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  // Close the mega menu and return focus to the trigger that opened it, so a
  // keyboard user is not dropped onto <body>. Used by ×, the overlay and Escape.
  const closeMenu = () => {
    setMenuOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 60);
      // Hide on scroll down, reveal on scroll up (all viewports). Small deltas
      // debounce jitter; always show near the top.
      // When the bar is set to stay put, it never hides — the client asked for a
      // nav that is reachable at any scroll position, and auto-hide means a
      // visitor deep in a long page has to scroll up before they can navigate.
      if (autoHide) {
        if (y > lastY + 4 && y > 120) setHidden(true);
        else if (y < lastY - 4 || y < 120) setHidden(false);
      }
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
    // autoHide is read inside the listener, so an empty array would pin the
    // handler to whatever the setting was at mount. The villa header already
    // depends on it; these two drifted apart.
  }, [autoHide]);

  // Publish the real header height so the homepage hero can slide exactly under
  // it (margin-top = -header height). Without this, a fixed margin leaves a thin
  // strip of page background showing above the hero when the header (logo size)
  // is taller than the assumed value.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const apply = () => document.documentElement.style.setProperty("--site-header-h", `${el.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // Escape, the reference-counted scroll lock and the Tab trap all come from the
  // shared hook now. This file had its own copy of each; the villa header had
  // none, which is exactly the drift the hook exists to stop.
  // restoreFocus is off because closeMenu already returns focus to the trigger.
  useOverlay(menuOpen, closeMenu, { trapFocus: panelRef, restoreFocus: false });

  const transparent = isHome && !scrolled;

  // The header shows only pages with the NAV toggle on; the footer reads the
  // separate FOOTER toggle, so the two lists differ by design.
  const navVisible = navLinks.filter((n) => !n.navHidden);

  // Top bar: the curated/pinned items (up to 7) — 八代町-style horizontal nav.
  // Seven, not six: the parent site already pins six sections, so 聯絡我們 fell
  // off the end of the bar and could only be reached from inside the menu.
  // The parent now pins exactly seven, so the next page pinned would have
  // pushed it off again — pinnedNavLinks keeps it and drops the link before it.
  const pinned = pinnedNavLinks(navVisible);

  return (
    <>
      <header ref={headerRef} className={`site-header${isHome ? " is-home" : ""}${transparent ? "" : " is-scrolled"}${menuOpen ? " menu-open" : ""}${hidden && !menuOpen ? " is-hidden" : ""}`}>
        <Link className="brand" href="/" aria-label={siteName}>
          {logoUrl && <img className="brand-logo" src={logoUrl} alt={siteName} />}
          {/* Hide the wordmark when logo-only is on and a logo exists; the link's
              aria-label still carries the name for screen readers. */}
          {!(logoOnly && logoUrl) && <span className="brand-name">{siteName}</span>}
        </Link>
        <nav className="header-nav" aria-label={locale === "zh" ? "主導覽" : "Primary navigation"}>
          {pinned.map((n) => (
            <Link
              key={n.key}
              href={n.href}
              /* The progressive-drop ladder in globals.css hides inline links
                 from the right as the header narrows. 聯絡我們 sits last, so it
                 was always the first to go — invisible on every screen under
                 1200px, which is most laptops, and the reason it kept reading
                 as "not in the nav" after being asked for twice. Marked here so
                 the ladder can skip it and drop the link before it instead. */
              data-nav-keep={n.key === "contact" ? "" : undefined}
              aria-current={pathname === n.href ? "page" : undefined}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <HeaderSocial social={social} locale={locale} />
          <LanguageToggle locale={locale} />
          <Link className="header-book" href="/contact">
            {locale === "zh" ? "立即預約" : "Reserve"}
          </Link>
          <button
            ref={triggerRef}
            className="mega-menu-trigger"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={locale === "zh" ? "選單" : "Menu"}
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="mega-menu-overlay" onClick={closeMenu}>
          <nav
            ref={panelRef}
            className="mega-menu-panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={locale === "zh" ? "選單" : "Menu"}
          >
            <button
              className="mega-menu-close"
              onClick={closeMenu}
              aria-label={locale === "zh" ? "關閉" : "Close"}
            >
              &times;
            </button>
            {/* One vertical list, no category columns — the grouping added a
                layer of reading for a menu short enough to scan at a glance. */}
            <ul className="mega-menu-list">
              {navVisible.map((n) => (
                <li key={n.key}>
                  <Link href={n.href} aria-current={pathname === n.href ? "page" : undefined}>
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </>
  );
}

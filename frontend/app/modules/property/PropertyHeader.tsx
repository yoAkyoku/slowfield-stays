"use client";

import { lineUrl } from "../socialLinks";
import { safeLinkHref } from "../safeHtml";
import HeaderSocial from "../HeaderSocial";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { Locale } from "../i18n";
import LanguageToggle from "../LanguageToggle";
import { useOverlay } from "../useOverlay";
import type { BookingConfig, NavItem, PropertyPageConfig } from "./types";
import { bookingLabel, isLivePage, navLabel } from "./types";

export default function PropertyHeader({
  siteName,
  logoUrl,
  locale,
  nav,
  booking,
  slug,
  pagesConfig,
  social,
  logoOnly,
  parentLink,
  autoHide = false,
}: {
  siteName: string;
  logoUrl?: string;
  locale: Locale;
  nav: NavItem[];
  booking: BookingConfig;
  slug: string;
  pagesConfig?: Record<string, PropertyPageConfig>;
  /** Validated social URLs (empty string = hide). Small icons at the far right. */
  social?: { instagram?: string; facebook?: string; line?: string; threads?: string; tiktok?: string };
  /** Show only the logo in the header (hide the site-name wordmark). */
  logoOnly?: boolean;
  /** Label + href for the link back to the parent brand. */
  parentLink?: { label: string; href: string };
  /** Slide the bar away on scroll down. Off by default: the bar stays put. */
  autoHide?: boolean;
}) {
  const pathname = usePathname();
  const base = `/stays/${slug}`;
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const menuPanelRef = useRef<HTMLElement>(null);

  // Publish the real header height so the full-screen hero can be sized exactly
  // (100dvh minus the header) — the header is in-flow/sticky, so without this the
  // hero overflowed by the header height and its bottom copy/dots were covered.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const apply = () => document.documentElement.style.setProperty("--property-header-h", `${el.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 60);
      // With auto-hide on: hide on scroll down (past the hero band), reveal on
      // scroll up. The small deltas debounce trackpad jitter; near the top the
      // bar always shows. When the bar is set to stay put, it never hides — the client asked for a
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
  }, [autoHide]);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // Escape to close, a reference-counted scroll lock, focus moved into the panel
  // and held there, and focus returned to the ☰ on close — the same hook the
  // lightbox and the group header use. The hand-rolled body.overflow lock this
  // replaces did none of it, so a keyboard user could not dismiss the menu and
  // landed back at the top of the document when they finally tabbed out of it.
  // trapFocus is not optional here: the panel claims aria-modal.
  useOverlay(menuOpen, () => setMenuOpen(false), { trapFocus: menuPanelRef });

  const zh = locale === "zh";
  const isHome = pathname === base || pathname === `${base}/`;
  const transparent = isHome && !scrolled;
  const enabledNav = nav.filter((item) => item.enabled && (!pagesConfig || isLivePage(pagesConfig[item.key])));
  // A nav item links to a sub-page (slug) by default, or scrolls to a homepage
  // block via #tag when the page is configured with link_mode "anchor".
  const navHref = (item: NavItem) => {
    const cfg = pagesConfig?.[item.key];
    if (cfg?.link_mode === "anchor" && cfg.anchor) return `${base}#${cfg.anchor}`;
    return `${base}/${item.key}`;
  };

  const ctaLabel = bookingLabel(booking, locale);
  // The two fallbacks were already validated (lineUrl, digit-stripped tel:) and
  // the editor's own field — the one that is actually free text — was not.
  const ctaHref = safeLinkHref(booking.cta_href) || (booking.line
    ? lineUrl(booking.line)
    : booking.phone
      ? `tel:${booking.phone.replace(/[^\d+]/g, "")}`
      : `/stays/${slug}/contact`);
  /* A booking system lives on its own domain, and sending a guest off-site in
     the same tab loses the villa they were looking at. Derived from the href
     rather than from a separate setting, so it is right for whatever is typed
     into 按鈕連結 — the internal fallbacks (LINE, tel:, the contact page) are
     unaffected. */
  const ctaTarget = /^https?:\/\//i.test(ctaHref)
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};

  return (
    <>
      <header ref={headerRef} className={`property-header${transparent ? "" : " is-scrolled"}${menuOpen ? " menu-open" : ""}${hidden && !menuOpen ? " is-hidden" : ""}`}>
        <Link className="brand" href={base} aria-label={siteName}>
          {logoUrl && <img className="brand-logo" src={logoUrl} alt={siteName} />}
          {!(logoOnly && logoUrl) && <span className="brand-name">{siteName}</span>}
        </Link>

        <nav className="property-nav" aria-label={zh ? "民宿導覽" : "Property navigation"}>
          {enabledNav.map((item) => (
            <Link
              key={item.key}
              href={navHref(item)}
              aria-current={pathname === `${base}/${item.key}` ? "page" : undefined}
            >
              {navLabel(item, locale)}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          {/* Back to the group, on the right (客戶: 回到慢域旅遊放右側比較好). It sat
              at the start of the row for a while, but the villa's own logo is
              already there and two ways out of the page in the same corner read
              as one confused control. Quiet by default; the arrow slides on
              hover so it reads as a direction rather than another link. */}
          {parentLink && (
            /* aria-label, not the span alone: below 1100px the label is hidden
               with display:none, which also removes it from the accessible name,
               and the arrow is aria-hidden — the link announced as its URL. */
            <Link className="property-parent-link" href={parentLink.href} aria-label={parentLink.label}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
                strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" />
              </svg>
              <span>{parentLink.label}</span>
            </Link>
          )}
          <HeaderSocial social={social} locale={locale} />
          <a className="property-booking-cta" href={ctaHref} {...ctaTarget}>{ctaLabel}</a>
          <LanguageToggle locale={locale} />
          <button
            className="mega-menu-trigger"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={zh ? "選單" : "Menu"}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
          >
            <span /><span /><span />
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="mega-menu-overlay" onClick={() => setMenuOpen(false)}>
          <nav
            ref={menuPanelRef}
            className="mega-menu-panel property-mega-menu"
            role="dialog"
            aria-modal="true"
            aria-label={zh ? "選單" : "Menu"}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="mega-menu-close" onClick={() => setMenuOpen(false)} aria-label={zh ? "關閉" : "Close"}>
              &times;
            </button>
            <div className="property-mega-menu-links">
              {parentLink && (
                <Link
                  className="property-mega-menu-parent"
                  href={parentLink.href}
                  onClick={() => setMenuOpen(false)}
                >
                  {parentLink.label}
                </Link>
              )}
              <Link href={base} onClick={() => setMenuOpen(false)}>
                {locale === "zh" ? "首頁" : "Home"}
              </Link>
              {enabledNav.map((item) => (
                <Link
                  key={item.key}
                  href={navHref(item)}
                  onClick={() => setMenuOpen(false)}
                  aria-current={pathname === `${base}/${item.key}` ? "page" : undefined}
                >
                  {navLabel(item, locale)}
                </Link>
              ))}
            </div>
            <div className="property-mega-menu-booking">
              <a className="button" href={ctaHref} {...ctaTarget}>{ctaLabel}</a>
              {booking.phone && (
                <a href={`tel:${booking.phone.replace(/[^\d+]/g, "")}`} className="property-mega-menu-phone">
                  {booking.phone}
                </a>
              )}
              {/* The header hides its social row below 1100px and the villa
                  footer deliberately carries none, so without this copy a phone
                  visitor — most of them — had no route to LINE at all, which is
                  a booking channel here. */}
              <HeaderSocial
                social={social}
                locale={locale}
                size={18}
                className="property-mega-menu-social"
              />
            </div>
          </nav>
        </div>
      )}
    </>
  );
}

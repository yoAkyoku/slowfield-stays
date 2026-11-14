import Link from "next/link";
import type { PublicSite } from "../api";
import type { Locale } from "../i18n";
import FooterNewsletter from "../newsletter/FooterNewsletter";
import { footerNotice, noticeLines } from "../consentNotice";
import { isLivePage, navLabel, resolveSiteName, type NavItem, type PropertyPageConfig } from "./types";

/**
 * Brand, page menu, newsletter, an optional legal notice, the copyright row and
 * the way back to the group.
 *
 * The menu was stripped out once and asked for again (客戶：footer 改回有菜單和
 * 返回母站). The social icons stay out — they are in the header and repeating
 * them here only made the footer longer.
 */
export default function PropertyFooter({
  site,
  locale,
  parentLink,
  nav,
  pagesConfig,
  slug,
}: {
  site: PublicSite;
  locale: Locale;
  /** Second, explicit way back to the group — the header carries the first. */
  parentLink?: { label: string; href: string };
  /** Built from the per-page FOOTER flag — deliberately not the header's list,
   *  which follows the NAV flag. A page can be in one and not the other. */
  nav?: NavItem[];
  pagesConfig?: Record<string, PropertyPageConfig>;
  slug?: string;
}) {
  const siteName = resolveSiteName(site, locale);
  // The caller has already applied the FOOTER flag; this drops anything not
  // published, so the footer cannot link to a page that is not live.
  const footerNav = slug
    ? (nav ?? []).filter((item) => item.enabled && (!pagesConfig || isLivePage(pagesConfig[item.key])))
    : [];
  const s = site.settings as Record<string, unknown> | undefined;

  // Bilingual legal notice (智慧財產 / 免責聲明). Set as { zh, en } or a plain
  // string in settings.footer_notice; rendered above the © row when present.
  // Resolved by the shared helper, which the group footer now calls too — this
  // copy of the rules was the only reader the field had.
  const notice = footerNotice(s?.footer_notice, locale);
  const description = footerNotice(s?.footer_description, locale);
  const copyright = footerNotice(s?.footer_copyright, locale)
    || `© ${new Date().getFullYear()} ${siteName}`;

  /* Same rule the header uses: a page set to 錨點 links to a block on the

     villa homepage. The footer hardcoded the sub-page URL, so one nav item

     pointed at #tag in the header and at the sub-page from the footer. */

  const navHref = (key: string) => {

    const cfg = pagesConfig?.[key];

    const anchor = typeof cfg?.anchor === "string" ? cfg.anchor.trim() : "";

    if (cfg?.link_mode === "anchor" && anchor) return `/stays/${slug}#${anchor}`;

    return `/stays/${slug}/${key}`;

  };


  return (
    <footer className="property-footer">
      <div className="property-footer-top">
        <div className="property-footer-brand">
          <strong>{siteName}</strong>
          {site.contact_config?.email && (
            <a href={`mailto:${site.contact_config.email}`}>{site.contact_config.email}</a>
          )}
          {description && <p>{description}</p>}
        </div>
        <FooterNewsletter locale={locale} siteSlug={site.slug} />
      </div>
      {footerNav.length > 0 && (
        <nav className="property-footer-nav" aria-label={locale === "zh" ? "頁尾導覽" : "Footer navigation"}>
          {footerNav.map((item) => (
            <Link key={item.key} href={navHref(item.key)}>
              {navLabel(item, locale)}
            </Link>
          ))}
        </nav>
      )}
      {notice && (
        <div className="property-footer-notice">
          {noticeLines(notice).map((line, i) => <p key={i}>{line}</p>)}
        </div>
      )}
      <div className="property-footer-bottom">
        <span>{copyright}</span>
        {/* Was "Powered by Slowfield Stays", which read as a credit line
            rather than a way back — a visitor who landed straight on a villa
            page had no obvious route to the group. */}
        {parentLink && (
          <Link className="property-footer-parent" href={parentLink.href}>
            {parentLink.label}
          </Link>
        )}
      </div>
    </footer>
  );
}

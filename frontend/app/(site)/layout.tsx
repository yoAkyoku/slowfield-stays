import { resolveSiteName } from "../modules/property/types";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isServableThroughSiteOverride } from "../modules/siteVisibility";
import { isAdminPreview } from "../modules/adminPreview";
import { sanitizeCustomCode } from "../modules/safeHtml";
import Script from "next/script";
import { Suspense } from "react";
import { getCurrentSite, getPages } from "../modules/api";
import CookieConsentBanner from "../modules/CookieConsentBanner";
import { DEFAULT_COOKIE_NOTICE, DEFAULT_GDPR_NOTICE, consentNotice, footerNotice, noticeLines } from "../modules/consentNotice";
import ServerHeadCode from "../modules/ServerHeadCode";
import { fontVars, layoutVars, typeScaleVars, themeVars, pageBackgroundStyle } from "../modules/fontPresets";
import { getLocale, t } from "../modules/i18n";
import { httpOnly, lineUrl, resolveSocialLinks } from "../modules/socialLinks";
import NavigationProgress from "../modules/NavigationProgress";
import ScrollToTopFab from "../modules/ScrollToTopFab";
import FooterNewsletter from "../modules/newsletter/FooterNewsletter";
import { IconFacebook, IconInstagram, IconLine, IconThreads, IconTikTok } from "../modules/icons/SocialIcons";
import SiteHeaderClient from "./SiteHeaderClient";
import SiteReveal from "./SiteReveal";
/* Which pages appear in the nav, what they are called and what order they sit
   in now lives in modules/siteNav so it can be exercised by a test rather than
   only read — 聯絡我們's position in this list is a standing client request
   that has been silently lost twice. */
import { buildNavLinks } from "../modules/siteNav";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const copy = t(locale);
  const [site, allPages] = await Promise.all([getCurrentSite(), getPages()]);
  // Reaching a child site on the parent's routes only happens through the
  // `?site=` override, and a draft villa must be as unreachable here as it
  // already is at /stays/{slug} — unless a signed-in admin is the one looking,
  // which is the only way an unpublished site can be reviewed before it goes
  // live. See modules/adminPreview.
  if (!isServableThroughSiteOverride(site) && !(await isAdminPreview())) notFound();
  const cmsVisibleTypes = new Set(
    allPages.filter((p) => p.status === "published").map((p) => p.content_type)
  );
  const siteName = resolveSiteName(site, locale);
  const theme = themeVars(site.theme_config);
  const rawGaId = typeof site.settings?.ga_id === "string" ? site.settings.ga_id : "";
  const gaId = /^(G|UA|GTM|AW)-[A-Za-z0-9-]+$/.test(rawGaId) ? rawGaId : "";
  const adsCode = typeof site.settings?.ads_code === "string" ? site.settings.ads_code : "";
  // Consent copy, in the reader's own language: see modules/consentNotice.
  const cookieNotice = consentNotice(site.settings?.cookie_notice, locale, DEFAULT_COOKIE_NOTICE);
  const gdprNotice = consentNotice(site.settings?.gdpr_notice, locale, DEFAULT_GDPR_NOTICE);
  /* 頁尾法律聲明. The field sits in the site editor's 進階 / 法規 tab for every
     site, and PropertyFooter was its only reader — so on the group site an
     admin typed a copyright / 智慧財產 notice, saved it without complaint, and
     no page ever showed it. `.footer-notice` was already carried in the
     stylesheet's interface-scale group with no element anywhere to match it,
     which is what the missing half looked like from the CSS side. */
  const legalNotice = footerNotice(site.settings?.footer_notice, locale);
  const footerDescription = footerNotice(site.settings?.footer_description, locale) || copy.site.footer;
  const footerTitle = footerNotice(site.settings?.footer_title, locale) || siteName;
  const footerCopyright = footerNotice(site.settings?.footer_copyright, locale)
    || `© ${new Date().getFullYear()} ${siteName}`;
  const headCode = typeof site.settings?.head_code === "string" ? site.settings.head_code : "";
  const bodyCode = typeof site.settings?.body_code === "string" ? site.settings.body_code : "";
  const s = site.settings as Record<string, any> | undefined;
  const socialObj = resolveSocialLinks(s, (site as any).social_links);

  // Header social icons (far right). Validate URLs here so the client just renders.
  const headerSocial = {
    instagram: httpOnly(socialObj.instagram),
    facebook: httpOnly(socialObj.facebook),
    // LINE is stored as a bare @handle, so it needs lineUrl (not httpOnly, which
    // drops anything that is not already a URL). The footer already did this; the
    // header was stripping social_line=@handle and only honouring contact_line.
    line: lineUrl(socialObj.line || site.contact_config?.line),
    threads: httpOnly(socialObj.threads),
    tiktok: httpOnly(socialObj.tiktok),
  };

  const navLinks = buildNavLinks(site, locale, cmsVisibleTypes);

  const groupLabels = {
    explore: locale === "zh" ? "探索" : "Explore",
    stories: locale === "zh" ? "故事" : "Stories",
    connect: locale === "zh" ? "聯繫" : "Connect",
  };

  // Footer menu mirrors the navbar exactly — the same links, one flat list, no
  // explore/stories/connect grouping (客戶: footer 選項與 navbar 相同，不再分類).
  // Uses the nav (header) visibility toggle so the two never diverge.
  // …and the FOOTER toggle still removes an item from it. Filtering on navHidden
  // alone made the footer mirror the navbar, which is what the client asked for,
  // but it also meant the admin's FOOTER switch did nothing on the group site —
  // it works on villa footers (buildFooterNav), so the two disagreed in silence.
  const footerNav = navLinks.filter((n) => !n.navHidden && !n.footerHidden);

  return (
    <div style={{
      ...theme,
      ...fontVars(site.settings as Record<string, unknown> | undefined),
      ...typeScaleVars(site.settings as Record<string, unknown> | undefined),
      ...layoutVars(site.settings as Record<string, unknown> | undefined),
      // Re-apply body font here so a preset's --font-body override actually reaches
      // the page text (body inherits the root default otherwise — headings already
      // opt in via var(--font-title), but paragraphs relied on inheritance).
      fontFamily: "var(--font-body)",
      ...pageBackgroundStyle(site.theme_config),
    } as React.CSSProperties}>
      <a className="skip-link" href="#main-content">
        {locale === "zh" ? "跳至主要內容" : "Skip to main content"}
      </a>
      <Suspense fallback={null}><NavigationProgress /></Suspense>
      <SiteHeaderClient
        siteName={siteName}
        logoUrl={typeof site.settings?.logo_url === "string" ? site.settings.logo_url : undefined}
        logoOnly={Boolean(site.settings?.header_logo_only)}
        locale={locale}
        navLinks={navLinks}
        groupLabels={groupLabels}
        languageLabel={copy.site.language}
        social={headerSocial}
        autoHide={Boolean(site.settings?.header_auto_hide)}
      />
      {headCode ? <ServerHeadCode html={headCode} /> : null}
      {gaId ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
          <Script id="ga-tracking" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${gaId}');
          `}</Script>
        </>
      ) : null}
      {adsCode && !/[<>"']/.test(adsCode) ? <Script id="ads-code" strategy="afterInteractive">{adsCode}</Script> : null}
      {bodyCode ? (
        bodyCode.includes("<") ? (
          <div dangerouslySetInnerHTML={{ __html: sanitizeCustomCode(bodyCode) }} suppressHydrationWarning />
        ) : !/[<>"']/.test(bodyCode) ? (
          <Script id="custom-body-code" strategy="afterInteractive">{bodyCode}</Script>
        ) : null
      ) : null}
      <div id="main-content" tabIndex={-1}>
        {children}
      </div>
      <SiteReveal />
      {cookieNotice ? <CookieConsentBanner cookieNotice={cookieNotice} gdprNotice={gdprNotice || undefined} locale={locale} /> : null}
      <ScrollToTopFab />
      <footer className="footer">
        <div className="footer-top">
          <div className="footer-brand">
            <strong>{footerTitle}</strong>
            {site.contact_config?.email && <a className="footer-brand-email" href={`mailto:${site.contact_config.email}`}>{site.contact_config.email}</a>}
            {/* settings.contact_phone was written by the site editor, counted by
                the readiness meter, and rendered nowhere at all — an admin who
                filled in the phone number had no way to find out it never
                reached the site. Beside the email is where a reader looks for
                it. `tel:` is stripped of spacing so a phone dials it. */}
            {site.settings?.show_footer_phone !== false && typeof site.settings?.contact_phone === "string" && site.settings.contact_phone.trim() && (
              <a
                className="footer-brand-phone"
                href={`tel:${site.settings.contact_phone.replace(/[^\d+]/g, "")}`}
              >
                {site.settings.contact_phone}
              </a>
            )}
            <p>{footerDescription}</p>
          </div>
          <nav className="footer-nav" aria-label={locale === "zh" ? "頁尾選單" : "Footer menu"}>
            {footerNav.map((n) => (
              <Link key={n.key} href={n.href}>{n.label}</Link>
            ))}
          </nav>
          <div className="footer-subscribe">
            <FooterNewsletter locale={locale} />
          </div>
        </div>
        {legalNotice && (
          <div className="footer-notice">
            {noticeLines(legalNotice).map((line, i) => <p key={i}>{line}</p>)}
          </div>
        )}
        <div className="footer-bottom">
          {/* No privacy link: the cookie and GDPR notices carry the disclosure,
              and this pointed at a page with no policy on it. */}
          <div className="footer-bottom-left">
            <span>{footerCopyright}</span>
          </div>
          <div className="footer-bottom-right footer-social-icons">
            {socialObj.instagram && /^https?:\/\//.test(socialObj.instagram) && <a href={socialObj.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><IconInstagram size={16} /></a>}
            {socialObj.facebook && /^https?:\/\//.test(socialObj.facebook) && <a href={socialObj.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook"><IconFacebook size={16} /></a>}
            {(() => { const url = lineUrl(socialObj.line || site.contact_config?.line); return url ? <a href={url} target="_blank" rel="noopener noreferrer" aria-label="LINE"><IconLine size={16} /></a> : null; })()}
            {socialObj.threads && /^https?:\/\//.test(socialObj.threads) && <a href={socialObj.threads} target="_blank" rel="noopener noreferrer" aria-label="Threads"><IconThreads size={16} /></a>}
            {socialObj.tiktok && /^https?:\/\//.test(socialObj.tiktok) && <a href={socialObj.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok"><IconTikTok size={16} /></a>}
          </div>
        </div>
      </footer>
    </div>
  );
}

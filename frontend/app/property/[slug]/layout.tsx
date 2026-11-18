import { safeLinkHref } from "../../modules/safeHtml";
import { notFound } from "next/navigation";
import { getPropertySite } from "../../modules/api";
import { getLocale } from "../../modules/i18n";
import { resolveSocialLinks } from "../../modules/socialLinks";
import CookieConsentBanner from "../../modules/CookieConsentBanner";
import { DEFAULT_COOKIE_NOTICE, DEFAULT_GDPR_NOTICE, consentNotice } from "../../modules/consentNotice";
import { SiteCustomCode, headerSocialLinks, siteStyleVars } from "../../modules/siteChrome";
import ScrollToTopFab from "../../modules/ScrollToTopFab";
import PropertyHeader from "../../modules/property/PropertyHeader";
import PropertyFooter from "../../modules/property/PropertyFooter";
import { buildFooterNav, buildNavFromPages, resolveSiteName, type BookingConfig, type NavItem, type PropertyPageConfig } from "../../modules/property/types";

export default async function PropertyLayout(
  props: {
    children: React.ReactNode;
    params: Promise<{ slug: string }>;
  }
) {
  const params = await props.params;

  const {
    children
  } = props;

  const site = await getPropertySite(params.slug);
  if (!site) notFound();

  const locale = await getLocale();
  const siteName = resolveSiteName(site, locale);
  // Nav: derived solely from settings.pages — child sites have no static defaults.
  const pagesConfig = (site.settings?.pages ?? {}) as Record<string, PropertyPageConfig>;
  // Array-checked, not just present: settings.nav is hand-editable JSON, and a
  // non-array here threw in the layout — which takes down every page of the
  // villa, not just its header.
  const nav = Array.isArray(site.settings?.nav)
    ? (site.settings.nav as NavItem[])
    : buildNavFromPages(pagesConfig);
  const booking = (site.settings?.booking ?? {}) as BookingConfig;
  // Header social icons (far right). Validate here so the client just renders.
  const sset = site.settings as Record<string, unknown> | undefined;
  const socialObj = resolveSocialLinks(sset);
  const headerSocial = headerSocialLinks(socialObj, site.contact_config?.line);
  // Consent copy, in the reader's own language, never the other one: see
  // modules/consentNotice. A villa reads it exactly as the group site does.
  const cookieNotice = consentNotice(site.settings?.cookie_notice, locale, DEFAULT_COOKIE_NOTICE);
  const gdprNotice = consentNotice(site.settings?.gdpr_notice, locale, DEFAULT_GDPR_NOTICE);

  // "回到慢域" — the meeting was clear that a shrunken logo does not read as a
  // way back to the group for someone arriving straight on a villa page. Label
  // and target are overridable per site; the default points at the parent
  // domain root, which is where the group site lives.
  const parentLinkSettings = (site.settings?.parent_link ?? {}) as Record<string, unknown>;
  const parentLabelRaw = parentLinkSettings.label;
  const parentLabel =
    typeof parentLabelRaw === "string"
      ? parentLabelRaw
      : (parentLabelRaw as Record<string, string> | undefined)?.[locale]
        || (parentLabelRaw as Record<string, string> | undefined)?.zh
        || (parentLabelRaw as Record<string, string> | undefined)?.en
        || (locale === "zh" ? "回到慢域旅遊" : "Back to Slowfield Stays");
  // Through the allow-list, not straight to the browser: this href renders in
  // the header and the footer of every page of the villa, so a `javascript:`
  // value here is script on the whole site — and on a shared origin that means
  // the admin cookie of whoever clicks it.
  const parentHref = safeLinkHref(parentLinkSettings.href) || "/";
  const parentLink = { label: parentLabel, href: parentHref };

  return (
    <div style={siteStyleVars(site)}>
      <PropertyHeader
        siteName={siteName}
        logoUrl={typeof site.settings?.logo_url === "string" ? site.settings.logo_url : undefined}
        logoOnly={Boolean(site.settings?.header_logo_only)}
        locale={locale}
        nav={nav}
        booking={booking}
        slug={params.slug}
        pagesConfig={pagesConfig}
        social={headerSocial}
        parentLink={parentLink}
        autoHide={Boolean(site.settings?.header_auto_hide)}
      />
      <SiteCustomCode settings={site.settings} />
      {children}
      {cookieNotice ? <CookieConsentBanner cookieNotice={cookieNotice} gdprNotice={gdprNotice || undefined} locale={locale} /> : null}
      <ScrollToTopFab />
      <PropertyFooter site={site} locale={locale} parentLink={parentLink} nav={buildFooterNav(nav, pagesConfig)} pagesConfig={pagesConfig} slug={params.slug} />
    </div>
  );
}

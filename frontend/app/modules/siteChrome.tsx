import Script from "next/script";
import type { CSSProperties } from "react";
import { sanitizeCustomCode } from "./safeHtml";
import ServerHeadCode from "./ServerHeadCode";
import { fontVars, layoutVars, pageBackgroundStyle, themeVars, typeScaleVars } from "./fontPresets";
import { httpOnly, lineUrl } from "./socialLinks";

/**
 * What the group layout and the villa layout both wrap every page in. The two
 * kept their own copies of all of it, and the copies had already come apart
 * once (a villa's 版面 settings were wired on the group layout only), so the
 * pieces live here and each layout supplies only its site.
 */

type SiteLike = {
  theme_config?: Parameters<typeof themeVars>[0];
  settings?: Record<string, unknown> | null;
  contact_config?: { line?: string | null } | null;
};

/** The theme, fonts, type scale, 版面 and page background as one style object. */
export function siteStyleVars(site: SiteLike): CSSProperties {
  const settings = (site.settings ?? undefined) as Record<string, unknown> | undefined;
  return {
    ...themeVars(site.theme_config),
    ...fontVars(settings),
    ...typeScaleVars(settings),
    ...layoutVars(settings),
    // Re-apply the body font here so a preset's --font-body override reaches
    // the page text (body inherits the root default otherwise — headings
    // already opt in via var(--font-title), but paragraphs relied on inheritance).
    fontFamily: "var(--font-body)",
    ...pageBackgroundStyle(site.theme_config),
  } as CSSProperties;
}

/**
 * The header's social icons, validated here so the client only renders. LINE
 * is stored as a bare @handle — the admin field's own placeholder is
 * `@example` — so it goes through lineUrl, not httpOnly, which drops anything
 * that is not already a URL.
 */
export function headerSocialLinks(
  social: { instagram?: string; facebook?: string; line?: string; threads?: string; tiktok?: string },
  contactLine?: string | null,
) {
  return {
    instagram: httpOnly(social.instagram),
    facebook: httpOnly(social.facebook),
    line: lineUrl(social.line || contactLine),
    threads: httpOnly(social.threads),
    tiktok: httpOnly(social.tiktok),
  };
}

const text = (v: unknown) => (typeof v === "string" ? v : "");

/** The site's own head code, GA tag, ads snippet and body code. */
export function SiteCustomCode({ settings }: { settings?: Record<string, unknown> | null }) {
  const rawGaId = text(settings?.ga_id);
  const gaId = /^(G|UA|GTM|AW)-[A-Za-z0-9-]+$/.test(rawGaId) ? rawGaId : "";
  const adsCode = text(settings?.ads_code);
  const headCode = text(settings?.head_code);
  const bodyCode = text(settings?.body_code);
  return (
    <>
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
    </>
  );
}

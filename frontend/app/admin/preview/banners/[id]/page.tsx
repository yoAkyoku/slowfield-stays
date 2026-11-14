import { notFound } from "next/navigation";
import { getAdminBanner } from "../../../modules/adminApi";
import { getCurrentSite } from "../../../../modules/api";
import { getLocale, t } from "../../../../modules/i18n";
import { fontVars, layoutVars, typeScaleVars, themeVars } from "../../../../modules/fontPresets";
import HomepageBlocks, { type HomepageBlock } from "../../../../modules/home/HomepageBlocks";

/**
 * Live preview of a banner, drawn by the component that actually renders it on
 * the homepage.
 *
 * This used to be a second, hand-written hero: its own `<section className="hero">`,
 * a hardcoded eyebrow, and no idea that a banner also carries `display_mode`,
 * `cta_label`, `cta_href` or per-locale `translations`. So it answered the one
 * question a preview exists to answer — "what will visitors see?" — with a
 * drawing that was already out of date, and it sat inside (dashboard), which
 * wrapped the whole thing in the admin sidebar and topbar.
 *
 * Passing the banner through HomepageBlocks' `hero_banner` case means the
 * preview IS the front end: one carousel component, one set of styles, nothing
 * to keep in sync.
 *
 * Lives under /admin/ so middleware requires an admin token — an unpublished
 * banner stays private — but outside (dashboard) so it carries no admin chrome.
 */
export default async function AdminBannerPreviewPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const [banner, site] = await Promise.all([getAdminBanner(params.id), getCurrentSite()]);
  if (!banner) notFound();

  const locale = await getLocale();
  const copy = t(locale);

  // An empty config is what an untouched hero block has, which is exactly the
  // case where the carousel falls back to the banners it is given.
  const block: HomepageBlock = { id: "preview", type: "hero_banner", enabled: true, config: {} };

  return (
    <div
      style={{
        ...themeVars(site.theme_config),
        ...fontVars(site.settings as Record<string, unknown> | undefined),
        ...typeScaleVars(site.settings as Record<string, unknown> | undefined),
        ...layoutVars(site.settings as Record<string, unknown> | undefined),
        fontFamily: "var(--font-body)",
        overflowX: "hidden",
      }}
    >
      <HomepageBlocks
        blocks={[block]}
        locale={locale}
        /* Only this banner: the homepage rotates through all of them, but the
           point here is to look at the one being edited. */
        banners={[banner]}
        siteSlug={site.slug}
        heroFallbacks={{
          eyebrow: copy.home.eyebrow,
          title: copy.home.heroTitle,
          subtitle: copy.home.heroSubtitle,
        }}
      />
    </div>
  );
}

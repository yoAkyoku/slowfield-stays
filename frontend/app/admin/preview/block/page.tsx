import { getBanners, getCurrentSite } from "../../../modules/api";
import { getLocale, t } from "../../../modules/i18n";
import { fontVars, layoutVars, typeScaleVars, themeVars } from "../../../modules/fontPresets";
import HomepageBlocks, { type HomepageBlock } from "../../../modules/home/HomepageBlocks";
import PropertyPageRenderer from "../../../modules/property/PropertyPageRenderer";
import { resolvePreviewRenderer } from "../../../modules/previewRenderer";

/**
 * Live preview of a single homepage block, drawn with the real front-end
 * components and the site's own fonts and theme.
 *
 * The block editor listed each block as a hand-drawn skeleton — grey bars
 * standing in for content — so the only way to see what a block actually looked
 * like was to save and open the site. The config travels in the URL rather than
 * being read back from the database, so the preview follows edits that have not
 * been saved yet.
 *
 * Lives under /admin/ so the middleware's admin token is required, but outside
 * (dashboard) so it carries no admin chrome.
 */
export const dynamic = "force-dynamic";

function decodeConfig(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const json = Buffer.from(decodeURIComponent(raw), "base64").toString("utf8");
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    // A truncated or malformed config previews as an empty block rather than
    // breaking the editor's thumbnail with an error page.
    return {};
  }
}

export default async function AdminBlockPreview(
  props: {
    searchParams: Promise<{ type?: string; cfg?: string; renderer?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const type = String(searchParams.type ?? "");
  if (!type) return null;

  // Which renderer draws the block, not which one the route happened to import:
  // a villa block drawn through HomepageBlocks came out blank for the types only
  // PropertyPageRenderer knows. Validated against the allow-list because
  // everything else on this URL is attacker-shaped input too.
  const renderer = resolvePreviewRenderer(searchParams.renderer);

  const locale = await getLocale();
  const copy = t(locale);
  const [site, banners] = await Promise.all([getCurrentSite(), getBanners()]);

  const block: HomepageBlock = {
    id: "preview",
    type,
    enabled: true,
    config: decodeConfig(searchParams.cfg),
  };

  return (
    <div
      style={{
        ...themeVars(site.theme_config),
        ...fontVars(site.settings as Record<string, unknown> | undefined),
        ...typeScaleVars(site.settings as Record<string, unknown> | undefined),
      ...layoutVars(site.settings as Record<string, unknown> | undefined),
        fontFamily: "var(--font-body)",
        // The thumbnail is a narrow frame; let the block lay itself out for a
        // real viewport and rely on the caller's scaling rather than reflowing
        // into a mobile layout it will never be seen in.
        overflowX: "hidden",
      }}
    >
      {renderer === "property" ? (
        <PropertyPageRenderer
          blocks={[block]}
          locale={locale}
          banners={banners}
          siteSlug={site.slug}
          siteLine={site.contact_config?.line}
        />
      ) : (
        <HomepageBlocks
          blocks={[block]}
          locale={locale}
          banners={banners}
          siteSlug={site.slug}
          heroFallbacks={{
            eyebrow: copy.home.eyebrow,
            title: copy.home.heroTitle,
            subtitle: copy.home.heroSubtitle,
          }}
        />
      )}
    </div>
  );
}

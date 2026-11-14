import type { CSSProperties } from "react";
import type { Banner } from "../../api";
import type { Locale } from "../../i18n";
import { safeCssColor } from "../../fontPresets";
import { cssUrl } from "../../safeCss";
import { cfgT } from "../../tr";
import { HERO_HEIGHT_MAP } from "../../content/PageHero";
import HeroBannerCarousel from "./HeroBannerCarousel";
import { slideMs } from "../../slideTiming";

export default function BlockHeroBanner({
  locale,
  config,
  banners,
}: {
  locale: Locale;
  config: Record<string, unknown>;
  banners?: Banner[];
}) {
  /* Allow-listed, not just typed: this goes into a class name below, where an
     unchecked string with a space attaches arbitrary classes to the hero. The
     keys come from the shared map rather than a fifth hand-written copy of the
     same four strings — a list declared inside a component body is the one that
     drifts. */
  const rawHeight = typeof config.height === "string" ? config.height : "";
  const heightKey = Object.prototype.hasOwnProperty.call(HERO_HEIGHT_MAP, rawHeight) ? rawHeight : "";
  const titleColor = safeCssColor(config.titleColor) || undefined;
  const subtitleColor = safeCssColor(config.subtitleColor) || undefined;

  // CMS-first: when banners are passed in (homepage hero), render the
  // multi-slide carousel and ignore the block's inline image/title/subtitle.
  // The block config still drives presentation (height + text colours).
  // Filter here so that "banners exist but all are image-less" falls through
  // to the manual config instead of rendering an empty section.
  const usableBanners = (banners ?? []).filter((b) => b.image_url);

  const title = cfgT(config, "title", locale);
  const subtitle = cfgT(config, "subtitle", locale);

  // Block-level images → a self-contained carousel (no CMS banners needed). The
  // first slide carries the block's title/subtitle. CMS banners still win when
  // present.
  const blockImages = (Array.isArray(config.images) ? config.images : [])
    .map((it) => (typeof it === "string" ? it : it && typeof it === "object" && "url" in it ? String((it as Record<string, unknown>).url ?? "") : ""))
    .filter(Boolean);

  // Multiple block-level images means the homepage author set an explicit hero
  // carousel — prefer it over a lone CMS banner. (2+ CMS banners still win below.)
  if (blockImages.length > 1 && usableBanners.length < 2) {
    const titleT = config.title as Record<string, string> | string | undefined;
    const subT = config.subtitle as Record<string, string> | string | undefined;
    const mkBi = (v: typeof titleT) => (typeof v === "string" ? { zh: v, en: v } : v && typeof v === "object" ? { zh: v.zh ?? "", en: v.en ?? "" } : { zh: "", en: "" });
    // The block carries one title/subtitle — repeat it on every slide so the
    // copy stays visible as the background image rotates (not just slide 1).
    const trans = { zh: { title: mkBi(titleT).zh, subtitle: mkBi(subT).zh }, en: { title: mkBi(titleT).en, subtitle: mkBi(subT).en } };
    const slides = blockImages.map((url, i) => ({
      id: `hero-img-${i}`,
      image_url: url,
      title,
      subtitle,
      translations: trans,
    })) as unknown as Parameters<typeof HeroBannerCarousel>[0]["banners"];
    return (
      <HeroBannerCarousel banners={slides} locale={locale} height={heightKey} titleColor={titleColor} subtitleColor={subtitleColor} intervalMs={slideMs(config.slide_seconds)} />
    );
  }

  if (usableBanners.length > 0) {
    return (
      <HeroBannerCarousel
        banners={usableBanners}
        locale={locale}
        height={heightKey}
        intervalMs={slideMs(config.slide_seconds)}
        titleColor={titleColor}
        subtitleColor={subtitleColor}
      />
    );
  }

  // Manual fallback: a sub-page hero, or a homepage hero with a single image —
  // accept either config.image or a lone entry in the config.images list.
  const image = String(config.image ?? "") || blockImages[0] || "";

  // Height via CSS class (not inline) so a mobile media query can shrink it.
  const sectionStyle: CSSProperties = {};
  const backgroundImage = cssUrl(image);
  if (backgroundImage) sectionStyle.backgroundImage = backgroundImage;
  const heroClass = `property-hero-banner${heightKey ? ` property-hero-banner--h-${heightKey}` : ""}`;

  return (
    <section
      className={heroClass}
      style={Object.keys(sectionStyle).length ? sectionStyle : undefined}
    >
      {/* The title carries its class here as it does in the carousel branch.
          Without it every hero heading rule missed this element — the banner's
          own 標題字體大小 (--hero-title-size), the site H1 type scale, the
          block's role title variables and the phone size ceiling are all
          written against `.property-hero-banner-content .property-hero-banner-title`.
          A single-image hero is the default path for a sub-page hero, so those
          four controls were silently inert on most villa pages while working on
          the carousel beside them. */}
      <div className="property-hero-banner-content">
        {title && (
          <h1 className="property-hero-banner-title" style={titleColor ? { color: titleColor } : undefined}>
            {title}
          </h1>
        )}
        {subtitle && (
          <p className="property-hero-banner-subtitle" style={subtitleColor ? { color: subtitleColor } : undefined}>
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}

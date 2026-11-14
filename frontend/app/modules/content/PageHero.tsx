import type { CSSProperties } from "react";
import { pickT } from "../tr";
import type { Locale } from "../i18n";
import { cssUrl } from "../safeCss";
import { safeCssColor } from "../fontPresets";

/**
 * The page-level hero every managed page shares.
 *
 * The page editor has carried hero_image / hero_title / hero_subtitle /
 * hero_*_color / hero_height / hero_align for a while, but only the category
 * index read them — so 聯絡我們 had a hero that could not be edited at all, and
 * anything added to one hero had to be re-added to the other by hand. One
 * component reads the config so every page that opts in gets the same controls
 * and the same behaviour.
 *
 * `className` names the page's own hero (.content-index-hero, .contact-hero) so
 * existing per-page styling keeps working; `.page-hero` carries what they share,
 * including the alignment rules.
 */

/** Exported so every hero that honours 頁面 Hero 高度 resolves it the same way.
 *  The stays index used to hardcode 78vh and quietly ignore the setting. */
export const HERO_HEIGHT_MAP: Record<string, string> = {
  small: "320px",
  medium: "clamp(320px, 55vh, 600px)",
  large: "clamp(400px, 75vh, 850px)",
  full: "100vh",
};

export type PageHeroConfig = Record<string, unknown>;

/** Whether the admin has configured a hero at all — callers use this to decide
 *  between the configured hero and their own fallback, so turning it on stays
 *  an explicit act in the page editor rather than something that appears by
 *  itself on every site. */
export function hasPageHero(config: PageHeroConfig, locale: Locale): boolean {
  const image = typeof config.hero_image === "string" ? config.hero_image : "";
  return Boolean(image || pickT(config.hero_title, locale));
}

export default function PageHero({
  config,
  locale,
  className,
  fallbackImage = "",
  fallbackTitle = "",
  fallbackSubtitle = "",
  headingLevel = "h1",
}: {
  config: PageHeroConfig;
  locale: Locale;
  className: string;
  fallbackImage?: string;
  fallbackTitle?: string;
  fallbackSubtitle?: string;
  headingLevel?: "h1" | "h2";
}) {
  const image = (typeof config.hero_image === "string" ? config.hero_image : "") || fallbackImage;
  /* A fallback is for a hero nobody has touched, not for one whose title the
     editor deliberately emptied. Once the key exists in the page config the
     saved value is used verbatim — cleared means cleared, and the hero simply
     renders without a title rather than putting the bundled copy back
     (客戶: 後台沒有設定標題和副標, hero 為何有默認標題). */
  const title = "hero_title" in config
    ? pickT(config.hero_title, locale)
    : fallbackTitle;
  const subtitle = "hero_subtitle" in config
    ? pickT(config.hero_subtitle, locale)
    : fallbackSubtitle;
  /* Through the same sanitiser as every other colour field. `typeof === "string"`
     was the only check here, and the value lands directly in a style attribute:
     `red;background-image:url(https://evil.example/x)` was emitted verbatim and
     Chrome honoured it — an outbound beacon on page load, or
     `position:fixed;inset:0` for a full-viewport overlay on a real
     slowfield.example URL. The villa route already ran safeCssColor over the
     SAME two keys; consolidating into this shared component is where it was
     dropped. Reachable from the group origin because middleware resolves the
     site from `?site=`, so a villa admin's config renders on the parent's
     domain. */
  const titleColor = safeCssColor(config.hero_title_color);
  const subtitleColor = safeCssColor(config.hero_subtitle_color);
  /* The hero mask, per page (客戶: 給每個頁面編輯加個 mask，可調題色和透明度).
     The stylesheet used to wash every hero with a fixed gradient. Measured on
     /brand, that gradient peaked at 0.42 top and 0.94 bottom — where no text
     sits — and fell to 0.19 across the band the title and subtitle occupy, so
     it dimmed the photograph without buying legibility. It is a setting now,
     and the page that needs it can have exactly as much as it needs.

     Same sanitiser as the two colours above: this lands in a style attribute.
     The opacity is coerced and clamped for the same reason, and `0` has to
     survive — a mask deliberately turned down to nothing is not the same as one
     never configured, and `||` would silently treat them alike. */
  const maskColor = safeCssColor(config.hero_mask_color);
  const rawMask = config.hero_mask_opacity;
  const maskPct =
    rawMask === "" || rawMask === null || rawMask === undefined || Number.isNaN(Number(rawMask))
      ? null
      : Math.min(100, Math.max(0, Math.round(Number(rawMask))));
  // No colour, or turned down to zero, draws nothing at all rather than an
  // invisible extra element over the picture.
  const hasMask = Boolean(image) && Boolean(maskColor) && maskPct !== null && maskPct > 0;

  const height = typeof config.hero_height === "string" ? config.hero_height : "";
  /* Allow-listed rather than passed through: it lands in a style attribute. */
  const align = ["left", "center", "right"].includes(String(config.hero_align ?? ""))
    ? String(config.hero_align)
    : "";

  /* 分割 puts the photograph beside the words instead of behind them, running
     it off its own edge of the page. Allow-listed like every other stored value
     that reaches a class name.

     It is not a decoration. Text over a photograph is legible only as far as
     the mask allows, and the mask is a compromise between reading the words and
     seeing the picture: measured on this page's own hero, white copy over the
     photo sits at 1.86:1 against a 3.0 minimum, and the only way to fix it
     within 覆蓋 is to wash out the photograph. Split, the words are on the page
     background at full contrast and the photograph is untouched — the
     compromise disappears rather than being tuned. */
  const heroLayout = config.hero_layout === "split" ? "split" : "overlay";

  const Heading = headingLevel;

  if (heroLayout === "split") {
    return (
      /* No `has-hero-image`: that class means "the photograph IS the
         background", and every rule hung off it — cover sizing, a 78vh
         min-height, white copy, the centred overlay treatment — is written for
         a hero the words sit on top of. Split, the photo is a sibling of the
         words, so the class would be a lie and would drag in a page's overlay
         theming (on /brand it turns the h1 white, on cream). */
      <section className={`page-hero page-hero--split ${className}`}>
        {image && (
          <div className="page-hero-split-media">
            {/* Decorative: the heading beside it names the page already. */}
            <img src={image} alt="" />
          </div>
        )}
        <div
          className={`page-hero-split-copy${align ? ` is-align-${align}` : ""}`}
          style={align ? ({ textAlign: align } as CSSProperties) : undefined}
        >
          {title && <Heading style={titleColor ? { color: titleColor } : undefined}>{title}</Heading>}
          {subtitle && <p style={subtitleColor ? { color: subtitleColor } : undefined}>{subtitle}</p>}
        </div>
      </section>
    );
  }

  return (
    <section
      className={`page-hero ${className}${image ? " has-hero-image" : ""}${hasMask ? " has-hero-mask" : ""}`}
      style={{
        ...(cssUrl(image) ? { backgroundImage: cssUrl(image) } : {}),
        /* The admin's height goes out as a variable, not as min-height: an
           inline min-height outranks every media query, so 全螢幕 meant a
           100vh photo on a phone too and each page opened with a screenful of
           image to scroll past. The stylesheet caps it. */
        ...(Object.prototype.hasOwnProperty.call(HERO_HEIGHT_MAP, height)
          ? ({ "--hero-h": HERO_HEIGHT_MAP[height] } as CSSProperties)
          : {}),
        ...(hasMask
          ? ({ "--hero-mask": maskColor, "--hero-mask-opacity": String(maskPct! / 100) } as CSSProperties)
          : {}),
      }}
    >
      <div
        className={align ? `is-align-${align}` : undefined}
        style={align ? ({ textAlign: align } as CSSProperties) : undefined}
      >
        {title && <Heading style={titleColor ? { color: titleColor } : undefined}>{title}</Heading>}
        {subtitle && <p style={subtitleColor ? { color: subtitleColor } : undefined}>{subtitle}</p>}
      </div>
    </section>
  );
}

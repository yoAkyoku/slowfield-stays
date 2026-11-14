import Link from "next/link";
import type { Locale } from "../../i18n";
import { t } from "../../i18n";
import { cfgT , eyebrowT} from "../../tr";
import { isSafeUrl } from "../../safeHtml";

export type BlockEditorialConfig = {
  image?: string;
  image_position?: "top" | "left" | "right";
  eyebrow?: string | Record<string, string>;
  title?: string | Record<string, string>;
  body?: string | Record<string, string>;
  cta_label?: string | Record<string, string>;
  cta_href?: string;
};

export default function BlockEditorial({ locale, config }: { locale: Locale; config?: BlockEditorialConfig }) {
  const { home: h } = t(locale);
  const c = (config ?? {}) as Record<string, unknown>;
  const image = String(c.image ?? "");
  /* "top" — a large picture with the copy beneath it — is what this block has
     been called since it was named 大圖焦點 / Full-width Feature, and what its
     palette hint has always promised ("一句話配一張大圖"). What it actually
     drew for an image was the same small contained side split as 圖文段落, so
     the one layout the block was named for was the one it could not produce
     (客戶: 大圖焦點沒有弄得很好看 / 品牌故事上方一張主要大圖、下方搭配長篇文字).
     Anything that is not an explicit side keeps the default, so the two side
     layouts stay available and a block saved without the field gets the layout
     its name describes. */
  const rawPosition = String(c.image_position ?? "");
  const side = rawPosition === "left" || rawPosition === "right" ? rawPosition : null;
  const eyebrow = eyebrowT(c, locale, h.point);
  const title = cfgT(c, "title", locale, h.pointTitle);
  const body = cfgT(c, "body", locale, h.pointBody);
  // CTA is optional: only render when a label is explicitly provided (no i18n fallback)
  const ctaLabel = cfgT(c, "cta_label", locale, "");
  const rawCtaHref = String(c.cta_href ?? "/experience");
  // An href off the allow-list falls back to the default; an empty one stays as
  // it was rather than growing a link the author never set.
  const ctaHref = !rawCtaHref || isSafeUrl(rawCtaHref) ? rawCtaHref : "/experience";
  const hasCta = ctaLabel.trim().length > 0;

  // A side image → the same contained left/right split as the rich-text About
  // (client: 圖片小小的、可靜左靜右). property-rich-text--img-left/right drives the
  // side; the media column is a rounded, aspect-4/3 "small" image, not full-bleed.
  if (image && side) {
    const classes = [
      "property-rich-text section property-rich-text--split",
      `property-rich-text--img-${side}`,
    ].join(" ");
    return (
      <section className={classes}>
        <div className="property-rich-split">
          <div className="property-rich-split-text">
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            {title && <h2>{title}</h2>}
            {body && <div className="property-rich-text-body"><p>{body}</p></div>}
            {hasCta && (
              <Link href={ctaHref} className="block-about-cta">
                {ctaLabel}
              </Link>
            )}
          </div>
          <div className="property-rich-split-media">
            {/* Decorative: the block prints the title as a heading beside or
                below this picture, so a repeat of it in `alt` is the same words
                read twice. */}
            <img src={image} alt="" loading="lazy" />
          </div>
        </div>
      </section>
    );
  }

  /* One shell for both the picture-on-top layout and the text-only case.
     Built on `property-rich-text section is-centered` on purpose: that is the
     measure and the centred type the other blocks on a content page already
     use, so this block lands on the same vertical axis instead of the 860px
     left-aligned panel it used to draw — which is what read as a seam between
     sections (客戶: 不要有分割感). It also inherits the 720px body column,
     so the picture is visibly wider than the copy beneath it, and it answers
     the block's 文字對齊 setting through the same rules as 圖文段落. */
  return (
    <section className="property-rich-text section is-centered editorial-feature">
      {image && (
        <figure className="editorial-feature-media">
          {/* alt carries the title because the title IS what the picture
              illustrates; with no title it is decorative and stays empty
              rather than repeating a filename to a screen reader. */}
          <img src={image} alt="" loading="lazy" />
        </figure>
      )}
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      {title && <h2>{title}</h2>}
      {body && (
        <div className="property-rich-text-body">
          <p>{body}</p>
        </div>
      )}
      {hasCta && (
        <Link href={ctaHref} className="block-about-cta">
          {ctaLabel}
        </Link>
      )}
    </section>
  );
}

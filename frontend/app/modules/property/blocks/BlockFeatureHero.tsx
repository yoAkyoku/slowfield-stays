import type { Locale } from "../../i18n";
import { cfgT, eyebrowT } from "../../tr";

/**
 * 主題大圖＋下方小項目 (客戶, 八、內容頁版型).
 *
 * A lead picture that introduces a section, with the several short items it
 * covers underneath. Stacking 大圖焦點 and 圖示重點清單 produced the same two
 * halves but not the same thing: each carried its own block padding and its own
 * heading slot, so the items read as a separate section rather than as the
 * contents of the one above them.
 *
 * Built on the same centred shell as 大圖焦點, so all three picture-led blocks
 * share one measure and one vertical axis.
 */
export type FeatureHeroConfig = {
  image?: string;
  eyebrow?: string | Record<string, string>;
  title?: string | Record<string, string>;
  body?: string | Record<string, string>;
  items?: Array<{ label?: string | Record<string, string>; detail?: string | Record<string, string> }>;
};

export default function BlockFeatureHero({
  locale,
  config,
}: {
  locale: Locale;
  config?: FeatureHeroConfig;
}) {
  const c = (config ?? {}) as Record<string, unknown>;
  const image = String(c.image ?? "");
  const eyebrow = eyebrowT(c, locale);
  const title = cfgT(c, "title", locale);
  const body = cfgT(c, "body", locale);
  /* Level follows what is actually above the items: this block's own title
     when it has one, the page heading when it does not. A fixed h3 under an h1
     is a skipped level. */
  const ItemTitle = title ? "h3" : "h2";

  const items = (Array.isArray(c.items) ? c.items : [])
    .map((raw) => {
      const item = raw as Record<string, unknown>;
      return { label: cfgT(item, "label", locale), detail: cfgT(item, "detail", locale) };
    })
    /* A row with no label still drew its number and an empty heading in the
       block this borrows its shape from; filtered here for the same reason. */
    .filter((item) => item.label);

  if (!image && !title && !body && !items.length) return null;

  return (
    <section className="property-rich-text section is-centered editorial-feature feature-hero">
      {image && (
        <figure className="editorial-feature-media">
          {/* Decorative. The block prints its title as a heading right below,
              so alt={title} had a screen reader read the same words twice — and
              with no title it collapsed to alt="" anyway. */}
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
      {items.length > 0 && (
        <ul className="feature-hero-items">
          {items.map((item, i) => (
            <li key={i} className="feature-hero-item">
              <ItemTitle>{item.label}</ItemTitle>
              {item.detail && <p>{item.detail}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

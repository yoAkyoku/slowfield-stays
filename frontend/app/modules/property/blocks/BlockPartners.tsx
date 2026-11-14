import type { Locale } from "../../i18n";
import { isSafeUrl } from "../../safeHtml";
import { cfgT, eyebrowT } from "../../tr";
import PartnerGrid, { type Partner } from "./PartnerGrid";

/**
 * Partner brands ("合作品牌") — the dining and lifestyle partners behind the
 * service. Admin-managed list of logo + photo + a line of copy + site link.
 *
 * Two layouts, because the same list is asked to do two jobs: a logo wall when
 * the point is who we work with, and cards when each partner needs a sentence
 * of its own. Deliberately not a marquee — a moving strip is unreadable and
 * gives a visitor no way to stop on the one they care about.
 *
 * A partner carrying longer copy opens it in place; see PartnerGrid.
 *
 * Renders nothing until items are added, so it is safe to ship empty.
 */

export default function BlockPartners({ locale, config }: { locale: Locale; config: Record<string, unknown> }) {
  const eyebrow = eyebrowT(config, locale);
  const heading = cfgT(config, "heading", locale);
  const caption = cfgT(config, "caption", locale);
  const layout = config.layout === "logos" ? "logos" : "cards";
  const rawItems = Array.isArray(config.items) ? config.items : [];

  const items: Partner[] = rawItems
    .map((raw) => {
      const it = (raw ?? {}) as Record<string, unknown>;
      return {
        name: cfgT(it, "name", locale),
        desc: cfgT(it, "desc", locale),
        detail: cfgT(it, "detail", locale),
        // Same allow-list the rich-text images use. A partner logo is a URL an
        // editor pasted, and every other image path on the site checks the
        // scheme before rendering it; this one did not.
        logo: isSafeUrl(it.logo) ? String(it.logo) : "",
        image: isSafeUrl(it.image) ? String(it.image) : "",
        // Only absolute http(s) — a partner link points off-site by definition,
        // and anything else here would be a mistake rather than a shortcut.
        href: typeof it.href === "string" && /^https?:\/\//.test(it.href) ? it.href : "",
      };
    })
    .filter((it) => it.name);

  if (!items.length) return null;

  return (
    <section className={`property-partners property-partners--${layout} section`}>
      {(eyebrow || heading || caption) && (
        <div className="property-partners-head">
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          {heading && <h2>{heading}</h2>}
          {caption && <p className="property-partners-caption">{caption}</p>}
        </div>
      )}
      <PartnerGrid items={items} layout={layout} locale={locale} />
    </section>
  );
}

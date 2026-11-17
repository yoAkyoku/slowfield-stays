import type { Locale } from "../../i18n";
import { cfgT, clearableT, eyebrowT } from "../../tr";
import SectionHeading from "../../SectionHeading";

export default function BlockHouseRules({ locale, config }: { locale: Locale; config: Record<string, unknown> }) {
  const zh = locale === "zh";
  /* clearableT, not cfgT: an absent title still takes the built-in one, but a
     title the editor deliberately emptied stays empty. cfgT reads the two the
     same way and hands back the fallback either way, so a 三欄 block placed as a
     continuation of the section above it — which is what the design asks for,
     numbered columns under a heading that is already there — could not avoid
     printing 「入住須知」 over itself. Same rule the eyebrow beside it already
     follows. */
  const title = clearableT(config, "title", locale, zh ? "入住須知" : "House Rules");
  const eyebrow = eyebrowT(config, locale);
  /* 條列 (the two-column run of hairlined rows this block has always drawn) or
     欄位 — the same 01/02/03 items as side-by-side columns, number above the
     copy instead of beside it. Allow-listed rather than passed through: it
     spells a class name. */
  const layout = config.layout === "columns" ? "columns" : "rows";
  const rawItems = Array.isArray(config.items) ? config.items : [];

  const items = rawItems
    .map((raw) => {
      const item = raw as Record<string, unknown>;
      return {
        label: cfgT(item, "label", locale),
        detail: cfgT(item, "detail", locale),
      };
    })
    .filter((item) => item.label);

  if (!items.length) return null;

  return (
    <section className={`property-house-rules section${layout === "columns" ? " is-columns" : ""}`}>
      <SectionHeading eyebrow={eyebrow} title={title} />
      <ul className="property-house-rules-list">
        {items.map((item, i) => (
          <li key={i} className="property-house-rules-item">
            <span className="property-house-rules-num">{String(i + 1).padStart(2, "0")}</span>
            <div className="property-house-rules-content">
              <strong>{item.label}</strong>
              {item.detail && <p>{item.detail}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

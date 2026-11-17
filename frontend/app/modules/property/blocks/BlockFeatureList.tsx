import type { Locale } from "../../i18n";
import { cfgT, eyebrowT } from "../../tr";
import FeatureIcon from "./FeatureIcon";
import SectionHeading from "../../SectionHeading";

/**
 * 特色亮點清單 — split out of the rich-text block (client: 特色亮點移出來，做成
 * 新內容區塊). Same icon + title + detail rows the "about" block already draws
 * (reuses its .block-about-feature* CSS), just as its own placeable block
 * instead of a side effect of filling in a text block's "items".
 */
export type FeatureListConfig = {
  eyebrow?: string | Record<string, string>;
  heading?: string | Record<string, string>;
  layout?: "row" | "grid";
  items?: Array<{ icon?: string; icon_color?: string; label?: string | Record<string, string>; detail?: string | Record<string, string> }>;
};

export default function BlockFeatureList({ locale, config }: { locale: Locale; config?: FeatureListConfig }) {
  const c = (config ?? {}) as Record<string, unknown>;
  const eyebrow = eyebrowT(c, locale);
  const heading = cfgT(c, "heading", locale);
  const layout = c.layout === "grid" ? "grid" : "row";

  const rawItems = Array.isArray(c.items) ? c.items : [];
  const items = rawItems
    .map((raw) => {
      const item = raw as Record<string, unknown>;
      return {
        icon: typeof item.icon === "string" ? item.icon : "",
        iconColor: typeof item.icon_color === "string" ? item.icon_color : "",
        label: cfgT(item, "label", locale),
        detail: cfgT(item, "detail", locale),
      };
    })
    .filter((item) => item.label);

  if (!items.length) return null;

  return (
    <section className="section feature-list-section">
      {(eyebrow || heading) && (
        <div className="section-header">
          <div>
            <SectionHeading eyebrow={eyebrow} title={heading} />
          </div>
        </div>
      )}
      <div className={`block-about-features${layout === "grid" ? " is-grid" : ""}`}>
        {items.map((item, i) => (
          <div key={i} className="block-about-feature">
            <FeatureIcon icon={item.icon} color={item.iconColor} />
            <div className="block-about-feature-info">
              <h3>{item.label}</h3>
              {item.detail && <p>{item.detail}</p>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

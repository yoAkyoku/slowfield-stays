import type { Locale } from "./i18n";
import { cfgT } from "./tr";

export type FeatureItem = { icon: string; iconColor: string; label: string; detail: string };

/**
 * A block's `items` read as feature rows: an icon, its colour, and a label and
 * detail in the reader's language. A row with no label is dropped. The about
 * block, the feature list and the rich-text block's legacy highlights each
 * parsed the list with their own copy of this.
 */
export function featureItems(raw: unknown, locale: Locale): FeatureItem[] {
  const rows = Array.isArray(raw) ? raw : [];
  return rows
    .map((row) => {
      const item = (row ?? {}) as Record<string, unknown>;
      return {
        icon: typeof item.icon === "string" ? item.icon : "",
        iconColor: typeof item.icon_color === "string" ? item.icon_color : "",
        label: cfgT(item, "label", locale),
        detail: cfgT(item, "detail", locale),
      };
    })
    .filter((item) => item.label);
}

import type { Locale } from "./i18n";
import { pickT } from "./tr";

export type GalleryImage = { url: string; caption: string };

/**
 * A gallery block's `images`, ready to draw.
 *
 * Older entries are bare URLs; the editor writes `{ url, caption }`, with the
 * caption bilingual. Both gallery blocks (相片牆 and 圖片集) read the same
 * field and each had its own copy of this. Entries with no URL are dropped,
 * and the caption is resolved to the reader's language.
 */
export function galleryImages(raw: unknown, locale: Locale): GalleryImage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): GalleryImage => {
      if (typeof item === "string") return { url: item, caption: "" };
      if (item && typeof item === "object" && "url" in item) {
        const obj = item as Record<string, unknown>;
        return { url: String(obj.url ?? ""), caption: pickT(obj.caption, locale) };
      }
      return { url: "", caption: "" };
    })
    .filter((img) => img.url !== "");
}

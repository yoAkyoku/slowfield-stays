import type { CmsContentBlock } from "./adminApi";

/**
 * Reading text out of article blocks.
 *
 * Kept out of PageBlockEditor.tsx so these two can be unit tested: that file
 * carries JSX, and the test runner strips types without compiling it. Same
 * arrangement, and the same reason, as localizedValue.ts.
 */

/** Read a possibly-bilingual block field.
 *
 *  Prefers the locale asked for. Without one, the block list always showed
 *  Chinese: an editor working in English typed into a card that went on showing
 *  the Chinese text, so the edit looked like it had not registered. */
export function resolveText(val: unknown, locale?: string): string {
  if (val != null && typeof val === "object" && !Array.isArray(val)) {
    const obj = val as Record<string, string>;
    return (locale ? obj[locale] : "") || obj.zh || obj.en || "";
  }
  return String(val ?? "");
}

/**
 * Plain-text mirror of the blocks, saved alongside them as the `body` column.
 *
 * Hidden blocks are skipped: `body` is what the API and the SEO defaults fall
 * back to, so copy the editor took off the page would otherwise still reach a
 * meta description or a search index.
 *
 * `locale` must be the SITE's language, not the tab the editor has open. This
 * used to be called with no locale at all, so the mirror was pinned to Chinese
 * whatever the page was written in; combined with the canonical columns being
 * filed under the viewer's UI language, an English page's Chinese mirror was
 * saved into `translations.en.body` and served to English readers.
 */
export function extractText(blocks: CmsContentBlock[], locale?: string): string[] {
  return blocks.filter((b) => b.enabled !== false).flatMap((b) => {
    if (b.type === "paragraph" || b.type === "heading" || b.type === "quote") {
      const raw = resolveText((b as { text?: unknown }).text, locale).replace(/<[^>]*>/g, "").trim();
      return raw ? [raw] : [];
    }
    if (b.type === "columns" && b.items) {
      return b.items.flatMap((col) => extractText(col.blocks, locale));
    }
    return [];
  });
}

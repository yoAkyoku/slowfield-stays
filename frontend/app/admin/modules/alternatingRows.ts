/**
 * The two pure rules behind the 圖文交錯 panel.
 *
 * In a plain .ts module for the same reason getVal/setVal are: both are rules
 * the panel shares with something else, and both are worth executing in a test
 * rather than reading. A .tsx module carries JSX the test runner cannot parse.
 */

/** Any value the renderer could find for a field, in either locale.
 *
 *  cfgT falls back across locales, so a row filled in only in English still
 *  renders on the Chinese page. */
function anyLocale(item: Record<string, unknown>, key: string): string {
  const v = item[key];
  if (v != null && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, string>;
    return o.zh || o.en || Object.values(o).find((x) => Boolean(x)) || "";
  }
  return typeof v === "string" ? v : "";
}

/**
 * BlockAlternating's own filter: a row with neither a picture nor any words is
 * an empty grid cell, and the renderer drops it.
 *
 * The panel has to agree with it exactly. Row NUMBERS and picture SIDES are both
 * counted over the rows that survive this, so an empty row in the middle
 * renumbers everything below it — and two filters that disagreed would put 03 in
 * the editor and 02 on the page with no way to tell which was lying.
 */
export function altRowRenders(item: Record<string, unknown>): boolean {
  return Boolean(
    String(item.image ?? "") ||
      anyLocale(item, "title") ||
      anyLocale(item, "body") ||
      anyLocale(item, "eyebrow"),
  );
}

/**
 * Where a single splice-move sends an index.
 *
 * The open row is tracked by index, and a reorder moves the rows out from under
 * it: without this, dragging row 3 to the top left the panel open on whichever
 * row landed in slot 3 — editing a different row's words with nothing on screen
 * to say so. Exact for the one operation both the up/down buttons and the drop
 * perform: remove one element, insert it elsewhere.
 */
export function altReindex(idx: number | null, from: number, to: number): number | null {
  if (idx === null) return null;
  if (idx === from) return to;
  if (from < idx && idx <= to) return idx - 1;
  if (to <= idx && idx < from) return idx + 1;
  return idx;
}

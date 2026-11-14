/**
 * Read the tag filter stored on a content collection block.
 *
 * `filter_tag` is the original single-value setting. Keep reading it so old
 * blocks do not change when the picker becomes multi-select. New saves use
 * `filter_tags`; an explicit empty array therefore clears an old filter too.
 */
export function contentFilterTags(config: Record<string, unknown>): string[] {
  const raw = config.filter_tags;
  const values = Array.isArray(raw)
    ? raw
    : (Object.prototype.hasOwnProperty.call(config, "filter_tags") ? [] : [config.filter_tag]);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const label = String(value ?? "").trim();
    const key = label.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

/** A content entry matches when it carries any selected tag (OR semantics). */
export function hasContentFilterTag(tags: unknown, selected: string[]): boolean {
  if (!selected.length) return true;
  const wanted = new Set(selected.map((tag) => String(tag ?? "").trim().toLowerCase()).filter(Boolean));
  return Array.isArray(tags)
    && tags.some((tag) => wanted.has(String(tag ?? "").trim().toLowerCase()));
}

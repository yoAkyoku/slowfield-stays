/**
 * Resolve the small scroll cue shown at the bottom of a hero.
 *
 * Older banner data occasionally stored the slide count in this field.  A
 * number is not useful copy, so treat it as missing and keep the locale's
 * normal fallback.  This module is shared by the public renderer and the
 * admin editors so they show the same value before and after saving.
 */
export function resolveHeroScrollLabel(
  raw: unknown,
  locale: string,
  fallback?: string,
): string {
  const value = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)[locale]
    : raw;
  const text = typeof value === "string" ? value.trim() : "";
  if (typeof value === "string" && !text) return "";
  if (typeof value !== "string" || /^\d+$/.test(text)) {
    return fallback ?? (locale === "en" ? "Scroll to explore" : "向下探索");
  }
  return text;
}

/**
 * The same field as the editor shows it. It used to be a second function also
 * called resolveHeroScrollLabel, in the block forms, doing something different.
 *
 * Read the value shown in the editor without filling an empty field.
 *
 * The public renderer applies the default label at display time. The editor
 * must keep an empty string visible and writable, otherwise clearing the
 * controlled input immediately replaces it with the default and the author
 * can never save an intentional blank.
 */
export function editableHeroScrollLabel(raw: unknown, locale: string): string {
  const value = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)[locale]
    : raw;
  const text = typeof value === "string" ? value.trim() : "";
  // Numeric leftovers came from an old field-shape collision with the slide
  // count. They are data corruption, not meaningful copy, so show an empty
  // editable value and let the public renderer supply its locale default.
  if (/^\d+$/.test(text)) return "";
  return text;
}


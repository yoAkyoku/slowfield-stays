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

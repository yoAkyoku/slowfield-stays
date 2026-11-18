/**
 * Whether a field has text in any language: its own column, or any
 * translation. The CMS console and the stays console each had a copy; this is
 * the granularity both work at — an entry is listed once, not once per locale.
 */
export function hasAnyLocale(
  record: { translations?: Record<string, Record<string, unknown> | undefined> | null },
  field: string,
): boolean {
  const filled = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  if (filled((record as Record<string, unknown>)[field])) return true;
  return Object.values(record.translations ?? {}).some((fields) => filled(fields?.[field]));
}

export type AboutImageSource = {
  url: string;
  alt?: unknown;
  [key: string]: unknown;
};

/** Read About carousel data, or migrate the two pre-carousel fields.
 *  The editor opts into empty rows so a newly added image can be uploaded;
 *  renderers use the default and ignore rows that do not have an image yet. */
export function normaliseAboutImages(
  config: Record<string, unknown>,
  options: { includeEmpty?: boolean } = {},
): AboutImageSource[] {
  const includeEmpty = options.includeEmpty === true;
  const stored = config.images;
  if (Array.isArray(stored)) {
    return stored.flatMap((raw): AboutImageSource[] => {
      if (typeof raw === "string") {
        const url = raw.trim();
        return url || includeEmpty ? [{ url }] : [];
      }
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
      const item = raw as Record<string, unknown>;
      const url = String(item.url ?? "").trim();
      return url || includeEmpty ? [{ ...item, url }] : [];
    });
  }

  return [config.image, config.image2]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .map((url) => ({ url }));
}

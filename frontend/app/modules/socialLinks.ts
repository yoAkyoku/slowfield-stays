/** The social links a site can set, in the order the header renders them. */
export const SOCIAL_KEYS = [
  "instagram", "facebook", "line", "threads", "tiktok", "twitter", "youtube", "linkedin",
] as const;

export type SocialKey = (typeof SOCIAL_KEYS)[number];

/**
 * Read a site's social links from wherever they are stored.
 *
 * The settings form saves them flat, as settings.social_threads and friends;
 * some sites also carry an older settings.social_links object. Both layouts
 * used to pick ONE source — `social_links ?? { …hand-listed keys… }` — which
 * failed twice over: the hand-listed fallback never mentioned threads or
 * tiktok, so those two could be filled in and never appear; and a site that had
 * any social_links object at all took that branch whole, losing every link
 * added to the form afterwards.
 *
 * Every key is read from every source instead, so adding one to the form is
 * enough to make it show.
 */
export function resolveSocialLinks(
  settings: Record<string, unknown> | null | undefined,
  siteLevelLinks?: Record<string, unknown> | null,
): Record<SocialKey, string> {
  const s = (settings ?? {}) as Record<string, unknown>;
  const nested = {
    ...((siteLevelLinks ?? {}) as Record<string, unknown>),
    ...((s.social_links as Record<string, unknown>) ?? {}),
  };

  const out = {} as Record<SocialKey, string>;
  for (const key of SOCIAL_KEYS) {
    // `||` not `??`: an empty string in an earlier source must fall through to
    // the next, or a property-settings form that saved a blank bare key would
    // permanently shadow the site editor's `social_${key}`.
    const raw = nested[key] || s[key] || s[`social_${key}`] || "";
    out[key] = typeof raw === "string" ? raw.trim() : "";
  }
  return out;
}

/** Only absolute http(s) links reach an href. LINE also accepts a bare @handle,
 *  which the caller turns into a URL before validating. */
export function httpOnly(url: string | undefined): string {
  return /^https?:\/\//i.test(url ?? "") ? (url as string) : "";
}

/**
 * A clickable LINE URL from whatever the admin typed.
 *
 * Six places built this by hand and they did not agree: most escaped the "@"
 * to %40, one did not, and only some accepted a full URL pasted into the same
 * field. The contact page's standing-channels panel skipped it altogether and
 * printed the handle as plain text, so the one place the meeting asked for a
 * LINE entry point was the one place it was not clickable.
 *
 * Accepts a full https URL (returned as-is) or a bare handle with or without
 * the leading "@". Anything else resolves to "" so the caller renders nothing
 * rather than a dead link.
 */
export function lineUrl(handleOrUrl: string | undefined | null): string {
  const raw = (handleOrUrl ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return httpOnly(raw);
  // A LINE id is letters, digits and . _ - , optionally prefixed with @.
  const handle = raw.replace(/^@/, "");
  if (!/^[A-Za-z0-9._-]{2,64}$/.test(handle)) return "";
  return `https://line.me/R/ti/p/%40${handle}`;
}

/**
 * A map link for a written address.
 *
 * The address was the one contact detail rendered as plain text in both
 * renderers, while the phone and email beside it were already tappable — so on
 * a phone you could call and mail with one tap and had to copy the address out
 * by hand. `BlockContactInfo` even computed this URL already and then rendered
 * the address in a `<p>` anyway.
 */
export function mapsUrl(address: string | undefined | null): string {
  const raw = (address ?? "").trim();
  if (!raw) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(raw)}`;
}

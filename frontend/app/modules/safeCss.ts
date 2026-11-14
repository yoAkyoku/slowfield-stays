/**
 * Wrap a value for use inside a CSS `url(...)` in an inline style.
 *
 * React escapes `"` in serialized inline styles but not `;` or `)`, so a value
 * carrying `);` can close the url() and append extra CSS declarations on the
 * server-rendered element (the same SSR-injection class blockStyle.ts guards
 * against for lengths). Any value containing a paren, semicolon, quote or
 * whitespace is not a plausible image URL — drop it rather than risk it.
 */
export function cssUrl(url: unknown): string | undefined {
  if (typeof url !== "string") return undefined;
  const u = url.trim();
  if (!u || /[)(;'"\s]/.test(u)) return undefined;
  return `url(${u})`;
}

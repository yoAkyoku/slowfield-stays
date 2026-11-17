/** Where the backend lives. Every fetch to the API starts from one of these.
 *
 *  `PUBLIC_API_URL` is what a browser can reach; it is inlined at build time, so
 *  client components may import it. `SERVER_API_URL` is for code that only runs
 *  on the server (server components, actions, route handlers): it prefers the
 *  internal address, which skips the public proxy when both run side by side. */
const FALLBACK = "http://localhost:8000/api/v1";

export const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? FALLBACK;

export const SERVER_API_URL = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? FALLBACK;

/** The admin's same-origin proxy to the backend. Client components in the admin
 *  call this instead of the API directly, so the session cookie stays httpOnly. */
export function adminProxyUrl(apiPath: string, site: string): string {
  return `/admin/api/proxy?${new URLSearchParams({ path: apiPath, site })}`;
}

/** Prices are shown in TWD with a fixed locale, so the server and the browser
 *  render the same digits (a bare `toLocaleString()` follows the runtime's
 *  locale and can mismatch on hydration). */
const PRICE = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatPrice(amount: number | string, opts: { from?: boolean } = {}): string {
  const n = Number(amount);
  return `TWD ${PRICE.format(Number.isFinite(n) ? n : 0)}${opts.from ? "+" : ""}`;
}

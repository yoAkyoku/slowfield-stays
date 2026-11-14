/**
 * `next/headers` outside a request.
 *
 * The unit tests import app modules directly, with no Next runtime and no
 * incoming request, so `cookies()` and `headers()` have nothing to read. They
 * answer empty here rather than throwing, which makes any code path that
 * consults them fall through to its documented default — that default is
 * usually the thing being tested.
 *
 * Wired up in tsResolve.hooks.mjs. Deliberately not a silent alias for the real
 * module: a test that needs a specific locale or header must set it up
 * explicitly instead of inheriting one from wherever the suite happens to run.
 */
export function cookies() {
  return { get: () => undefined, getAll: () => [], has: () => false };
}

export function headers() {
  return { get: () => null, has: () => false, entries: () => [][Symbol.iterator]() };
}

export function draftMode() {
  return { isEnabled: false };
}

import assert from "node:assert/strict";
import test from "node:test";

/**
 * Run with: npm test  (node --test, no test framework dependency)
 *
 * The admin proxy's path allow-list.
 *
 * The proxy reads the HttpOnly admin token and forwards the request with a
 * bearer header, so this list is the only thing deciding where a privileged
 * request may go. It used to test the raw query string for "..", which a
 * percent-encoded traversal walks straight past: the URL parser reads "%2E%2E"
 * as a parent segment, so `/admin/%2E%2E/%2E%2E/%2E%2E/docs` was allowed and
 * resolved to `/docs`, outside the `/api/v1` base entirely.
 *
 * Nothing sensitive was reachable that way at the time — but the control did
 * not hold, and the next endpoint mounted outside `/api/v1` would have
 * inherited the hole in silence.
 *
 * The route module cannot be imported here (it pulls in next/server), so the
 * function is mirrored. If the two ever drift, these stop protecting anything —
 * which is why the mirror is a copy of the whole function and not a paraphrase.
 */

const API_URL = "http://backend:8000/api/v1";
const ALLOWED_PATH_PREFIXES = ["/admin/", "/media", "/auth/me"];

function isPathAllowed(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  if (path.includes("@")) return false;
  if (/%2f|%5c|\\/i.test(path)) return false;

  let resolved: URL;
  try {
    resolved = new URL(`${API_URL}${path}`);
  } catch {
    return false;
  }

  const base = new URL(API_URL);
  if (resolved.origin !== base.origin) return false;
  const basePath = base.pathname.replace(/\/+$/, "");
  if (!resolved.pathname.startsWith(`${basePath}/`)) return false;

  const rest = resolved.pathname.slice(basePath.length);
  return ALLOWED_PATH_PREFIXES.some((prefix) => rest.startsWith(prefix));
}

test("the paths the admin actually uses are allowed", () => {
  for (const p of [
    "/admin/media",
    "/admin/cms/pages",
    "/admin/stays/12",
    "/admin/booking-requests/3/restore",
    "/media",
    "/auth/me",
  ]) {
    assert.equal(isPathAllowed(p), true, p);
  }
});

/** The bypass this fix exists for, in every spelling that produced it. */
test("a percent-encoded traversal cannot escape the API base", () => {
  for (const p of [
    "/admin/%2e%2e/%2e%2e/storage/media/x.png",
    "/admin/%2E%2E/%2E%2E/%2E%2E/docs",
    "/admin/%2e%2e/healthz",
    "/media/%2E%2E/%2E%2E/docs",
  ]) {
    assert.equal(isPathAllowed(p), false, p);
    // And the reason: resolution takes it outside /api/v1.
    assert.ok(!new URL(`${API_URL}${p}`).pathname.startsWith("/api/v1/admin/"), p);
  }
});

test("a plain traversal is still rejected", () => {
  for (const p of ["/admin/../../secret", "/admin/..", "/media/../../etc/passwd"]) {
    assert.equal(isPathAllowed(p), false, p);
  }
});

/**
 * An encoded slash is NOT decoded by the URL parser, so the resolved path still
 * begins with an allowed prefix and the resolution check alone lets it through.
 * The backend would 404 it, but something shaped like an escape should not
 * reach the backend at all.
 */
test("an encoded separator is rejected before it is resolved", () => {
  for (const p of ["/admin/..%2f..%2fdocs", "/admin/..%5c..%5cdocs", "/admin/\\..\\..\\docs"]) {
    assert.equal(isPathAllowed(p), false, p);
  }
});

test("the request cannot be repointed at another host", () => {
  for (const p of ["//evil.example/x", "/admin/@evil.example", "https://evil.example/x", ""]) {
    assert.equal(isPathAllowed(p), false, JSON.stringify(p));
  }
});

test("a path outside the allow-list is rejected even inside the API base", () => {
  for (const p of ["/nope", "/stays", "/site/resolve", "/newsletter/subscribe"]) {
    assert.equal(isPathAllowed(p), false, p);
  }
});

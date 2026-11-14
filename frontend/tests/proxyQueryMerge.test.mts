import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readCode } from "./readCode";

/**
 * The admin proxy merges query strings instead of concatenating them.
 *
 * `path` may already carry a query string — `/admin/newsletter/subscribers?visibility=all`
 * is an ordinary thing to ask for — and the proxy also appends its own params
 * (`site`). Appending `?${qs}` to a path that already had a `?` produced two of
 * them, so the backend received `visibility=all?site=hejing` and answered
 * 422 "Invalid visibility". The request was well formed; the proxy corrupted it
 * on the way through, and the failure looked like a bad argument from the
 * caller.
 */

const SRC = readCode("app/admin/api/proxy/route.ts");

test("the path's own query string is parsed out before params are added", () => {
  assert.match(SRC, /const \[pathOnly, pathQuery = ""\] = apiPath\.split\("\?"\);/);
  assert.match(SRC, /new URLSearchParams\(pathQuery\)/);
});

test("the target URL is built from the path without its query string", () => {
  // Using apiPath here again is what produced the doubled "?".
  assert.match(SRC, /const targetUrl = `\$\{API_URL\}\$\{pathOnly\}/);
  assert.doesNotMatch(
    SRC,
    /const targetUrl = `\$\{API_URL\}\$\{apiPath\}/,
    "building from apiPath re-introduces the second question mark",
  );
});

test("the allow-list still checks the full path, not just the trimmed one", () => {
  // The security check must not be narrowed by this change.
  assert.match(SRC, /isPathAllowed\(apiPath\)/);
});

/** The merge itself, reproduced exactly as the route does it. */
function merge(path: string, extra: Record<string, string>): string {
  const [pathOnly, pathQuery = ""] = path.split("?");
  const params = new URLSearchParams(pathQuery);
  for (const [k, v] of Object.entries(extra)) params.set(k, v);
  const qs = params.toString();
  return `${pathOnly}${qs ? `?${qs}` : ""}`;
}

test("params from both sides survive, with exactly one question mark", () => {
  const url = merge("/admin/newsletter/subscribers?visibility=all", { site: "hejing" });
  assert.equal((url.match(/\?/g) ?? []).length, 1);
  const qs = new URLSearchParams(url.split("?")[1]);
  assert.equal(qs.get("visibility"), "all");
  assert.equal(qs.get("site"), "hejing");
});

test("a path with no query string is unchanged apart from the added params", () => {
  assert.equal(merge("/admin/media", { site: "x" }), "/admin/media?site=x");
});

test("a path with no params at all keeps no question mark", () => {
  assert.equal(merge("/admin/media", {}), "/admin/media");
});

test("the proxy's own param wins a collision, since it is the explicit one", () => {
  const url = merge("/admin/x?site=old", { site: "new" });
  assert.equal(new URLSearchParams(url.split("?")[1]).get("site"), "new");
});

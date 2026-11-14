import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { CONTENT_TYPE_TO_CATEGORY, contentCategoryFromType } from "../app/modules/contentRoutes.ts";

/**
 * The frontend and backend content-type maps must agree.
 *
 * They are hand-kept copies on either side of the API. 慢域選品 was added to the
 * page manager but to neither map, so `contentCategoryFromType` fell through to
 * its "page" default and every curation entry would have linked to
 * /page/{slug} instead of /curation/{slug} — invisible while the section was
 * empty, wrong for every entry the moment one was published.
 */

const PY = readFileSync("../backend/app/modules/cms/routes.py", "utf8");

/** The backend table, parsed out of its literal. */
function backendMap(): Record<string, string> {
  const start = PY.indexOf("CONTENT_TYPE_TO_CATEGORY = {");
  const body = PY.slice(start, PY.indexOf("}", start));
  const out: Record<string, string> = {};
  for (const [, k, v] of body.matchAll(/"([\w-]+)":\s*"([\w-]+)"/g)) out[k] = v;
  return out;
}

test("both sides list exactly the same content types", () => {
  const backend = backendMap();
  assert.ok(Object.keys(backend).length > 5, "failed to parse the backend map");
  assert.deepEqual(Object.keys(CONTENT_TYPE_TO_CATEGORY).sort(), Object.keys(backend).sort());
});

test("both sides map each type to the same category", () => {
  const backend = backendMap();
  for (const [type, category] of Object.entries(CONTENT_TYPE_TO_CATEGORY)) {
    assert.equal(backend[type], category, `${type} disagrees across the API`);
  }
});

test("curation resolves to its own section, not the page fallback", () => {
  assert.equal(contentCategoryFromType("curation"), "curation");
});

test("an unknown type still falls back rather than throwing", () => {
  assert.equal(contentCategoryFromType("not-a-type"), "page");
  assert.equal(contentCategoryFromType(undefined), "page");
});

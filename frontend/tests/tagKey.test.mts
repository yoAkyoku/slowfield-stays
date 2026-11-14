import assert from "node:assert/strict";
import test from "node:test";
import { tagKey } from "../app/modules/tr.ts";

/**
 * Tags are free text in the admin, so the same category arrives spelled several
 * ways. Every filter row compares on this key and displays the original string.
 */

test("spellings of the same tag share one key", () => {
  const key = tagKey("Local");
  for (const spelling of ["local", "LOCAL", " Local ", "\tlocal\n"]) {
    assert.equal(tagKey(spelling), key, spelling);
  }
});

test("different tags keep different keys", () => {
  assert.notEqual(tagKey("Local"), tagKey("Lodging"));
});

test("Chinese tags are unaffected — no case to fold, whitespace still trimmed", () => {
  assert.equal(tagKey("在地"), "在地");
  assert.equal(tagKey("  在地 "), "在地");
  assert.notEqual(tagKey("在地"), tagKey("旅宿"));
});

test("a missing or non-string tag collapses to the empty key rather than throwing", () => {
  // Entries are CMS JSON; a tag array can hold a null or a number, and this runs
  // inside a server component where a throw takes down the page.
  for (const bad of [null, undefined, 0, {}, []]) {
    assert.equal(typeof tagKey(bad), "string");
  }
  assert.equal(tagKey(null), "");
  assert.equal(tagKey("   "), "");
});

test("grouping by key merges the duplicate chips but keeps the first spelling", () => {
  // This is the shape the filter rows use: one entry per key, labelled with the
  // casing the editor typed first.
  const tags = ["Local", "local", "Lodging", " LOCAL "];
  const seen = new Map<string, string>();
  for (const tag of tags) {
    const key = tagKey(tag);
    if (key && !seen.has(key)) seen.set(key, tag.trim());
  }
  assert.deepEqual([...seen.values()], ["Local", "Lodging"]);
  assert.equal(tags.filter((t) => tagKey(t) === tagKey("local")).length, 3);
});

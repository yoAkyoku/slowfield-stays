import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";

/**
 * `PUT /sites/{id}` is a full replace. The settings form names every field it
 * saves; the three saves that only change `settings` (homepage blocks, a villa
 * page, the page list) rebuild the rest from the stored site through
 * siteReplacePayload. A field the form saves and that builder does not carry is
 * wiped by the next homepage or page save — page_bg was lost that way once.
 */

/** Top-level keys of the object literal returned by `fnStart`. */
function returnedKeys(src: string, fnStart: string): string[] {
  const at = src.indexOf(fnStart);
  assert.ok(at !== -1, `${fnStart} is gone`);
  const ret = src.indexOf("return {", at);
  /* The returned object's own keys sit at four spaces in; nested objects
     (settings) are indented further and are not counted. */
  const end = src.indexOf("\n  };", ret);
  const body = src.slice(ret, end);
  return [...new Set([...body.matchAll(/^ {4}([a-z_]+)(?::|,$)/gm)].map((m) => m[1]))];
}

test("every field the settings form saves survives a homepage or page save", () => {
  const form = returnedKeys(readCode("app/admin/modules/siteActions.ts"), "function sitePayload(");
  const replace = returnedKeys(readCode("app/admin/modules/sitePayload.ts"), "export function siteReplacePayload(");
  assert.ok(form.length > 20 && replace.length > 20, `could not read the payloads (${form.length}, ${replace.length})`);
  const missing = form.filter((k) => !replace.includes(k));
  assert.deepEqual(missing, [], `siteReplacePayload drops these, so the next page save wipes them: ${missing.join(", ")}`);
});

test("the settings-only saves all go through the one builder", () => {
  for (const file of ["app/admin/modules/homepageActions.ts", "app/admin/modules/propertyPagesActions.ts", "app/admin/modules/siteActions.ts"]) {
    const src = readCode(file);
    assert.match(src, /siteReplacePayload\(/, `${file} no longer uses siteReplacePayload`);
    assert.doesNotMatch(src, /primary_color:\s*site\./, `${file} builds its own full payload again`);
  }
});

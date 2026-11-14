import assert from "node:assert/strict";
import test from "node:test";
import { PREVIEW_RENDERERS, resolvePreviewRenderer } from "../app/modules/previewRenderer.ts";

/**
 * Run with: npm test  (node --test, no test framework dependency)
 *
 * /admin/preview/block renders block config straight out of a URL, so the
 * renderer name has to come off an allow-list: anything else picks the homepage
 * renderer, which is what every caller got before the parameter existed.
 */

test("the two known renderers are returned unchanged", () => {
  for (const name of PREVIEW_RENDERERS) {
    assert.equal(resolvePreviewRenderer(name), name);
  }
});

test("a missing renderer falls back to homepage", () => {
  assert.equal(resolvePreviewRenderer(undefined), "homepage");
  assert.equal(resolvePreviewRenderer(""), "homepage");
});

test("unknown and non-string values fall back to homepage", () => {
  for (const raw of ["Property", "property ", "../../etc", "toString", "constructor", 1, null, {}, ["property"]]) {
    assert.equal(resolvePreviewRenderer(raw), "homepage", String(raw));
  }
});

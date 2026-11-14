import assert from "node:assert/strict";
import test from "node:test";
import { lineUrl } from "../app/modules/socialLinks.ts";

/**
 * Six places built a LINE URL by hand and disagreed: most escaped the "@" to
 * %40 and one did not, some accepted a pasted full URL and others produced
 * `line.me/R/ti/p/https://…`. The contact page skipped it and printed the
 * handle as plain text — the one LINE entry point the meeting asked for was
 * the one that could not be tapped.
 */
test("a bare handle becomes a tappable link, with or without the @", () => {
  assert.equal(lineUrl("@slowfield"), "https://line.me/R/ti/p/%40slowfield");
  assert.equal(lineUrl("slowfield"), "https://line.me/R/ti/p/%40slowfield");
  assert.equal(lineUrl("  @slowfield  "), "https://line.me/R/ti/p/%40slowfield");
});

test("a full URL pasted into the same field is kept, not wrapped again", () => {
  assert.equal(lineUrl("https://lin.ee/abc123"), "https://lin.ee/abc123");
});

test("nothing usable resolves to empty, so callers render no link at all", () => {
  for (const bad of ["", "   ", undefined, null, "@", "javascript:alert(1)", "a b c", "@王小明"]) {
    assert.equal(lineUrl(bad as string), "", JSON.stringify(bad));
  }
});

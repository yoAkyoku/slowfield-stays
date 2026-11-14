import assert from "node:assert/strict";
import test from "node:test";
import { MAP_MODES, resolveMapMode } from "../app/modules/property/blocks/mapMode.ts";

/**
 * The renderer and the admin <select> both resolve a stored config through this,
 * so a mode that no longer exists cannot mean two different things to them.
 */

test("a known mode is returned as-is", () => {
  for (const mode of MAP_MODES) {
    assert.equal(resolveMapMode(mode, 0), mode);
    assert.equal(resolveMapMode(mode, 5), mode);
  }
});

test("a retired mode degrades to what the block actually holds", () => {
  // "illustrated" was removed. A block still carrying it used to fall through
  // every branch and render nothing at all.
  assert.equal(resolveMapMode("illustrated", 3), "pins");
  assert.equal(resolveMapMode("illustrated", 0), "embed");
});

test("an unset or junk mode uses the same rule", () => {
  for (const junk of [undefined, null, "", "  ", 0, {}, ["pins"], "PINS"]) {
    assert.equal(resolveMapMode(junk, 2), "pins", String(junk));
    assert.equal(resolveMapMode(junk, 0), "embed", String(junk));
  }
});

test("the marker count is the usable one, not the raw array length", () => {
  // A retired mode's markers were percent positions, not lat/lng — the caller
  // passes the count that survived parsing, so those resolve to "embed".
  assert.equal(resolveMapMode("illustrated", 0), "embed");
});

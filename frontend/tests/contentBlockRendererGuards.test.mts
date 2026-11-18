import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readCode } from "./readCode";

/**
 * A malformed block must not take a public page down.
 *
 * ContentBlockRenderer recurses for `columns`. The legacy branch guarded its
 * recursion (`block.left ?? []`); the newer `items` branch two lines above did
 * not, so a column saved without a `blocks` array handed `undefined` to the
 * component and threw inside `.map()`. That is a 500 on a page visitors read,
 * caused by one bad field in hand-editable CMS JSON — and every other branch in
 * the file already chooses "draw nothing" over "fail" for content it cannot
 * render.
 *
 * A runtime test would be better, but nothing in this suite can render JSX —
 * node's type stripping does not transform it — so this pins the two guards at
 * the source level instead, which is the same approach
 * noUnawaitedInterpolation.test.mts takes for a bug types cannot catch.
 */

// The recursion lives in ContentBlocks; ContentBlockRenderer only wraps it.
const SOURCE = readCode("app/modules/content/ContentBlocks.tsx");

test("the renderer refuses a non-array instead of throwing", () => {
  assert.match(
    SOURCE,
    /if \(!Array\.isArray\(blocks\)\) return null;/,
    "ContentBlockRenderer must check its blocks prop before mapping over it",
  );
});

test("every recursive call passes an array", () => {
  const recursions = SOURCE.match(/<ContentBlocks\s+oembed=\{oembed\}\s+blocks=\{([^}]*)\}/g) ?? [];

  assert.ok(recursions.length >= 3, `expected the columns branches to recurse, found ${recursions.length}`);
  for (const call of recursions) {
    assert.match(
      call,
      /\?\?\s*\[\]/,
      `recursive render without an array fallback: ${call} — a column with no blocks throws`,
    );
  }
});

test("the guard sits before the map, not after", () => {
  const guard = SOURCE.indexOf("if (!Array.isArray(blocks)) return null;");
  const map = SOURCE.indexOf("{blocks.map((block, index) =>");

  assert.ok(guard !== -1 && map !== -1, "both the guard and the map should be present");
  assert.ok(guard < map, "a guard after the map would never run");
});

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readStyles } from "./readCode";

/**
 * The 關於 block's copy column had one number doing two unrelated jobs.
 *
 * `padding: <y> clamp(24px,4vw,56px) <y> var(--gutter)` put the page gutter on
 * the outer side and the picture gap on the inner one, and the comment above it
 * claimed "max-width grows by the difference, so widening the gutter moves the
 * column inward instead of squeezing the text". max-width was a fixed 700px, so
 * it never grew. Two symptoms followed, both reported:
 *
 *   - 調整兩側留白，圖與文的間距沒有明顯變化 — correct, and by construction:
 *     the setting is the OUTER padding; the gap is the INNER one.
 *   - 容器成長方形，避免不必要的換行 — a 300px 左右留白 inside a 576px column
 *     left 319px of text, and a two-line heading broke onto three.
 *
 * Measured before: outer 210.6px / gap 46.5px / text 319px / heading 3 lines.
 * Measured after:  outer 129.6px / gap 27.9px / text 418px / heading 2 lines.
 *
 * The invariant is not the numbers — it is that the two sides are INDEPENDENT
 * values, and that the outer one is bounded by what it leaves the text rather
 * than by a constant. A fixed cap would also stop the squeeze, but it would
 * throw away the author's setting on a wide screen where there is room for it.
 */

const CSS = readStyles("app/globals.css");

/** The `.block-about-copy { … }` declaration block, contents only. */
function copyRule(): string {
  const start = CSS.indexOf(".block-about-copy {");
  assert.ok(start >= 0, ".block-about-copy rule not found");
  const open = CSS.indexOf("{", start);
  const close = CSS.indexOf("}", open);
  return CSS.slice(open + 1, close);
}

test("the picture gap is its own variable, not the page gutter", () => {
  const rule = copyRule();
  assert.match(rule, /--about-gap:/, "no --about-gap declared");
  // The inner side must reference the gap variable, so changing the page
  // gutter cannot silently change the distance to the image.
  assert.match(rule, /padding:[^;]*var\(--about-gap\)/, "the gap variable is not used in padding");
});

test("the outer side is bounded by the text it leaves, not by a constant", () => {
  const rule = copyRule();
  assert.match(rule, /--about-text-min:/, "no text floor declared");
  const edge = /--about-edge:\s*([^;]+);/.exec(rule);
  assert.ok(edge, "no --about-edge declared");
  const value = edge![1];
  // Still driven by the author's setting…
  assert.match(value, /var\(--gutter\)/, "the author's 左右留白 is no longer honoured");
  // …but capped against the measure rather than a hard-coded width. A cap that
  // never mentions the floor is the fixed-number version this replaced.
  assert.match(value, /var\(--about-text-min\)/, "the cap ignores the text floor");
  assert.match(value, /\bmin\(/, "the cap is not a min()");
});

test("the outer and inner sides are not the same value", () => {
  const rule = copyRule();
  const padding = /(?:^|\n)\s*padding:\s*([^;]+);/.exec(rule);
  assert.ok(padding, "no padding shorthand on .block-about-copy");
  const sides = padding![1];
  assert.ok(
    sides.includes("var(--about-gap)") && sides.includes("var(--about-edge)"),
    `padding must carry both sides independently, got: ${sides}`,
  );
  /* The two sides of the shorthand, not two different strings' offsets. This
     compared `indexOf(gap)` with `lastIndexOf(edge)` — two substrings starting
     with different characters can never begin at the same offset, so it was
     arithmetically always true and the regression it names (both sides
     collapsing to one token) passed. */
  const parts = sides.trim().split(/\s+(?![^(]*\))/);
  assert.equal(parts.length, 4, `expected a four-value padding, got: ${sides}`);
  assert.notEqual(parts[1], parts[3], "both sides resolved to the same token");
});

test("the mirrored image-left rule swaps the same two variables", () => {
  const start = CSS.indexOf(".block-about--image-left .block-about-copy {");
  assert.ok(start >= 0, "mirrored rule not found");
  const body = CSS.slice(CSS.indexOf("{", start) + 1, CSS.indexOf("}", start));
  // Gap faces the image on the left, edge faces the page on the right.
  assert.match(body, /padding-left:\s*var\(--about-gap\)/);
  assert.match(body, /padding-right:\s*var\(--about-edge\)/);
});

test("the paragraph does not re-cap a measure the column already caps", () => {
  const start = CSS.indexOf(".block-about-copy p {");
  assert.ok(start >= 0, ".block-about-copy p rule not found");
  const body = CSS.slice(CSS.indexOf("{", start) + 1, CSS.indexOf("}", start));
  const maxWidth = /max-width:\s*([^;]+);/.exec(body);
  assert.ok(maxWidth, "max-width declaration missing — keep it explicit so the intent is readable");
  assert.equal(
    maxWidth![1].trim(),
    "none",
    "a second cap here only ever narrows the column further (it held 319px inside a 576px column)",
  );
});

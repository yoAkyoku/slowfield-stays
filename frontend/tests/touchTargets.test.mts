import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readStyles } from "./readCode";

/**
 * Interactive controls meet the 24x24 CSS px floor (WCAG 2.5.8).
 *
 * These were all under it, and two of them were worse than merely small:
 * `.bulk-select-checkbox` is layered over `.stay-catalog-link`, which covers
 * the whole stay card, so a near miss opened the edit page instead of ticking
 * the box; and `.pbe-block--mini .pbe-block-actions button` includes 刪除.
 *
 * Where the small size IS the design — the gallery dots are 8px on purpose —
 * the target is enlarged with padding under `box-sizing: content-box`, so the
 * control looks unchanged and still takes a thumb.
 */

const CSS = readStyles("app/globals.css");

/**
 * The declaration body for an exact selector.
 *
 * Found by string search rather than a built regex: the selectors here contain
 * `.`, `[`, `]` and `"`, and escaping them into a pattern is more ways to be
 * wrong than the lookup is worth.
 */
/**
 * The declaration body for an exact selector.
 *
 * Found by string search rather than a built regex: these selectors contain
 * `.`, `[`, `]` and `"`, and escaping them into a pattern is more ways to be
 * wrong than the lookup is worth. The match must start a line, so a selector
 * is never found inside a longer, more specific one.
 */
function rule(selector: string): string {
  const needle = String.fromCharCode(10) + selector + " {";
  const at = CSS.indexOf(needle);
  assert.ok(at !== -1, `rule not found: ${selector} — was it renamed?`);
  const open = at + needle.length;
  const close = CSS.indexOf("}", open);
  assert.ok(close !== -1, `unterminated rule: ${selector}`);
  // Comments are stripped: they sit between declarations and contain colons,
  // which would otherwise be parsed as property names.
  return stripComments(CSS.slice(open, close));
}

function stripComments(css: string): string {
  let out = "";
  let i = 0;
  for (;;) {
    const begin = css.indexOf("/*", i);
    if (begin === -1) return out + css.slice(i);
    out += css.slice(i, begin);
    const finish = css.indexOf("*/", begin);
    if (finish === -1) return out;
    i = finish + 2;
  }
}

/**
 * A pixel value from a declaration body.
 *
 * Parsed by splitting declarations rather than with a pattern: template
 * literals swallow regex escapes, and a silently non-matching regex here would
 * make every one of these tests pass by finding nothing.
 */
function px(body: string, prop: string): number | null {
  for (const declaration of body.split(";")) {
    const [name, value] = declaration.split(":");
    if (!value || name.trim() !== prop) continue;
    const size = Number.parseInt(value.trim(), 10);
    return Number.isNaN(size) ? null : size;
  }
  return null;
}

/** Controls sized directly. */
const SIZED = [
  ".bulk-select-checkbox",
  ".rsp-chip-x",
  ".pbe-block--mini .pbe-block-actions button",
  // Row-select boxes in every admin table (the CMS lists' .cms-checkbox-cell
  // became the kit's table).
  '.admin-shell .a-table input[type="checkbox"]',
];

for (const selector of SIZED) {
  test(`${selector} is at least 24x24`, () => {
    const body = rule(selector);
    for (const prop of ["width", "height"]) {
      const size = px(body, prop);
      assert.ok(size !== null, `${selector} declares no ${prop}`);
      assert.ok(size >= 24, `${selector} has ${prop}: ${size}px, below the 24px floor`);
    }
  });
}

/** Controls given a floor rather than a fixed size. */
/* .nl-search-clear became the kit SearchInput's built-in clear button. The
   villa footer no longer renders a social-icon row (.property-footer-social);
   its links live in the shared footer, covered by .footer-social-icons a. */
const FLOORED = [".a-search__clear", ".footer-social-icons a"];

for (const selector of FLOORED) {
  test(`${selector} has a 24px minimum`, () => {
    const body = rule(selector);
    for (const prop of ["min-width", "min-height"]) {
      const size = px(body, prop);
      assert.ok(size !== null, `${selector} declares no ${prop}`);
      assert.ok(size >= 24, `${selector} has ${prop}: ${size}px, below the 24px floor`);
    }
  });
}

test("the gallery dot stays 8px but its tap target does not", () => {
  /* The dot is small by design — the fix must not have inflated the visual.

     This used to read the geometry of a `::before` with `inset: -8px`, and that
     pseudo-element carried `pointer-events: none`: it enlarged nothing, so the
     test was asserting the size of a box that could not be clicked, and would
     have stayed green with the real target at 8px. The rule has been removed.

     What actually makes the target is on the button itself — `content-box` plus
     8px of padding, so the 8px dot sits in a 24px border box. Measured on the
     home page: 24x24 (40x24 once `.is-active` widens the dot), with
     elementFromPoint at its centre returning the button. */
  const dot = rule(".stay-card-gallery-dots button");
  // Height, not width: `.is-active` widens the dot, so height is the axis that
  // has to clear the floor on every dot rather than only the current one.
  const visual = px(dot, "height");
  assert.equal(visual, 8, "the dot itself should still be 8px");
  assert.match(
    dot,
    /box-sizing:\s*content-box/,
    "under the global border-box the padding would eat the dot instead of adding to the target",
  );
  const pad = px(dot, "padding");
  assert.ok(pad !== null, "the dot declares no padding, and the padding is what makes its target");
  assert.ok(
    visual! + pad! * 2 >= 24,
    `${visual}px dot + 2x${pad}px padding is ${visual! + pad! * 2}px, under the 24px floor`,
  );
});

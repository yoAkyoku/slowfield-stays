import assert from "node:assert/strict";
import test from "node:test";
import { readStyles, cssRules, splitSelectorList } from "./readCode";

/**
 * Every block on a page starts and ends its content on the same two x-positions.
 *
 * 客戶: 左右留白(寬度)要對齊. The earlier pass in this change set gave every block
 * FRAME the same `--block-measure`, which is necessary and was not sufficient:
 * two of the shapes on the rebuilt brand-story page pay a different inset
 * INSIDE that frame, and what a reader sees is where the words start.
 *
 * The arithmetic, once, so the rules below can be read against it:
 *
 *   `.property-block-contained > .section` is capped at --block-measure and
 *   then pays `var(--gutter)` of its own, so its content is
 *   `measure - 2 * gutter`. Anything that wants its content on those same two
 *   positions has to be capped at the same measure AND pay the same gutter.
 *
 * Two rules were not, and both were measured wrong in the browser before being
 * fixed here:
 *
 *   · `.property-block-pair` capped itself at `measure + 2 * clamp(16px, 4vw,
 *     48px)` and paid that clamp. That put its columns on the neighbours'
 *     FRAME rather than on their content — a whole gutter too wide — and the
 *     private clamp was 46px where the gutter was 70. Measured at 1920 on a
 *     villa page: sections' content 467..1443, the pair's columns 355..1555.
 *
 *   · the stacked `.block-about-copy` paid `--about-gap`, the space that holds
 *     the copy off the PICTURE beside it — and stacked there is no picture
 *     beside it. Measured at 820: the photograph and every other block on
 *     98..711, the heading it belongs to on 69..711.
 *
 * Both are the same mistake: an inset invented for this block instead of the
 * one the page already uses. So each assertion below is "reads --gutter", not
 * "equals 48px" — a figure that merely matches today would drift the moment the
 * gutter clamp is retuned, and drift silently, because nothing renders red.
 */

const CSS = readStyles("app/globals.css");
const RULES = cssRules(CSS);

function ruleFor(selector: string, atRule = ""): { selector: string; body: string; atRule: string } | undefined {
  return RULES.find(
    (r) => r.atRule === atRule && splitSelectorList(r.selector).some((s) => s.trim() === selector),
  );
}

test("a section's content inset is the page gutter, which is what the rest of this file compares against", () => {
  /* The premise. If `.section` stops paying --gutter, every assertion below is
     comparing against the wrong thing and should be re-derived rather than
     left passing. */
  const section = ruleFor(".section");
  assert.ok(section, ".section is gone — re-anchor this file");
  assert.match(
    section.body,
    /padding:\s*var\(--section-y\)\s+var\(--gutter\)/,
    "`.section` no longer pays var(--gutter) on its sides; the alignment target has moved",
  );
});

test("a pair stands in a standalone block's frame, not a wider one", () => {
  const pair = ruleFor(".property-block-pair");
  assert.ok(pair, ".property-block-pair is gone — re-anchor this file");
  assert.match(
    pair.body,
    /max-width:\s*var\(--block-measure[^;]*\);/,
    "the pair's frame is no longer the plain shared measure — a `+ 2 * …` term here is the bug that put its columns a gutter outside every neighbour",
  );
  assert.doesNotMatch(
    pair.body,
    /max-width:\s*calc\(/,
    "the pair's frame is a calc again; the frame and the inset are two separate decisions and this is where they got confused",
  );
});

test("a pair pays the same inset a section pays, out of the same variable", () => {
  const pair = ruleFor(".property-block-pair");
  assert.ok(pair);
  /* The pair strips `.section` padding off the blocks inside it
     (`.property-block-pair .section { padding: 0 }`), so it owes that padding
     in their place. Any literal length here is a second opinion about the page
     gutter. */
  assert.match(
    pair.body,
    /padding-inline:\s*var\(--pair-pad-x\)/,
    "the pair's horizontal inset is no longer a variable",
  );
  assert.match(
    pair.body,
    /--pair-pad-x:\s*var\(--gutter\)/,
    "--pair-pad-x is not the page gutter any more; a private figure here is 24px out at 1151 and looks right at 1920",
  );
  /* And the vertical must stay a separate property. As the `padding` shorthand
     it silently reset the inline value written above it. */
  assert.match(pair.body, /padding-block:\s*clamp\(/, "the pair's vertical padding is gone");
  assert.doesNotMatch(
    pair.body,
    /(^|;)\s*padding:\s/,
    "the `padding` shorthand is back on the pair — it resets padding-inline and the alignment fix becomes a no-op",
  );
  // The blocks inside really are stripped, which is why the pair owes it.
  const inner = ruleFor(".property-block-pair .section");
  assert.ok(inner, "the pair no longer zeroes its children's padding — re-check who pays the gutter");
  assert.match(inner.body, /padding:\s*0/);
});

test("side by side, the about block's text-width floor is scaled to its column, not to the page", () => {
  /* `--about-edge` is the outer inset, capped by a floor that refuses to inset
     past `--about-text-min`. That floor guards ONE COLUMN — roughly half the
     block — and was written against the VIEWPORT at 36vw, so between about 900
     and 1250 it demanded more width than the column had and pulled the outer
     edge in below the page gutter. The block then ran ~10px past every
     neighbour on its outer side with no 左右留白 set on it at all: the guard
     firing on precisely the case it exists to leave alone.

     Measured on the live /brand at 1151 before the fix: every other section's
     content 139..1012, this block 139..1022. 1280 and above agreed already, and
     so did everything below 900, where the halves stack — which is why a spot
     check at two widths missed it.

     Asserted as a bound rather than an exact figure: anything at or under half
     the viewport tracks the column, and the 280/440 ends are what actually stop
     a large 左右留白, so those are pinned instead. */
  const copy = ruleFor(".block-about-copy");
  assert.ok(copy, ".block-about-copy is gone — re-anchor this test");
  const m = copy.body.match(/--about-text-min:\s*clamp\(\s*(\d+)px\s*,\s*(\d+(?:\.\d+)?)vw\s*,\s*(\d+)px\s*\)/);
  assert.ok(m, "--about-text-min is no longer a clamp of px/vw/px — re-derive the bound below");
  assert.ok(
    Number(m[2]) <= 18,
    `--about-text-min grows at ${m[2]}vw; the column it guards is about half the viewport, so anything above 18vw makes the floor fire against the DEFAULT gutter and the block overhangs its neighbours`,
  );
  assert.equal(m[1], "280", "the floor's lower end moved; that is what actually protects a squeezed column");
  assert.equal(m[3], "440", "the floor's upper end moved");
  /* And the edge still takes the SMALLER of the gutter and that floor — if it
     stopped reading --gutter, the block would ignore the page axis entirely. */
  assert.match(
    copy.body,
    /--about-edge:\s*min\(var\(--gutter\)/,
    "--about-edge no longer starts from the page gutter",
  );
});

test("stacked, both halves of the about block take the page edge rather than the gap between them", () => {
  const stacked = RULES.filter(
    (r) =>
      /@media \(max-width: 900px\)/.test(r.atRule) &&
      splitSelectorList(r.selector).some((s) => s.trim() === ".block-about-copy") &&
      /padding-inline/.test(r.body),
  );
  assert.equal(stacked.length, 1, "the stacked .block-about-copy no longer sets its own padding-inline");
  assert.match(
    stacked[0].body,
    /padding-inline:\s*var\(--gutter\)/,
    "the stacked about copy is inset by something other than the page gutter again",
  );
  /* All four selectors. The copy and the picture each have a base rule and a
     mirrored one for a left-hand picture, and the mirrored pair is (0,2,0) —
     it would otherwise keep its own edges straight through this media query.
     Half a fix here is worse than none: it puts the two halves of one block on
     two different edges, which is what the homepage was measured doing. */
  const selectors = splitSelectorList(stacked[0].selector).map((s) => s.trim()).sort();
  assert.deepEqual(
    selectors,
    [
      ".block-about--image-left .block-about-copy",
      ".block-about--image-left .block-about-media",
      ".block-about-copy",
      ".block-about-media",
    ].sort(),
    "the stacked rule no longer covers both halves and both picture sides",
  );
  /* Not --about-edge: it carries a floor that refuses to inset past
     --about-text-min, and on a 319px phone column that floor fires against the
     DEFAULT gutter — 24px where the picture above pays 28. */
  assert.doesNotMatch(stacked[0].body, /--about-edge/, "the stacked copy is back on --about-edge, whose floor fires at 375px");
});

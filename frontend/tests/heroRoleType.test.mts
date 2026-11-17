import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readStyles, readCode } from "./readCode";

/**
 * The banner hero on the same per-role footing as a block.
 *
 * A banner used to carry one `_style.align` that positioned the eyebrow, the
 * title, the subtitle and the buttons together — 客戶: banner 字體需要能單獨改
 * 字體、大小、對齊, and 眉眼和標題的對齊是同步的，內容需要另外分開對齊. The fix
 * reuses the block role system rather than growing a second one: the carousel
 * runs the banner's `translations` through the same `roleTypeVars` and spends
 * the result on `.hero-content`.
 *
 * Two hazards are specific to this component and are what this file pins:
 *
 *  1. The title and subtitle carry INLINE colours from the hero block's own
 *     settings. An inline declaration beats a variable, so the block colour has
 *     to stand down when the banner's own role sets one — otherwise the more
 *     specific choice is the one that gets ignored.
 *  2. The subtitle is centred with auto margins driven by the hero-wide align,
 *     and the buttons by a hero-wide justify-content. Both have to yield to a
 *     role that set its own alignment, or the layout drags the text back.
 */

const SRC = readCode("app/modules/home/HomeHeroCarousel.tsx");
const CSS = readStyles("app/globals.css");

test("the carousel feeds the banner's own translations through roleTypeVars", () => {
  assert.match(SRC, /import \{ roleTypeVars \} from "\.\.\/blockStyle"/, "roleTypeVars is not imported");
  // Read from the ACTIVE slide: a carousel styles each banner separately, and
  // reading the first one would freeze every slide to the first one's look.
  assert.match(
    SRC,
    /roleTypeVars\(\s*\(active\?\.translations/,
    "role type is not read from the active slide",
  );
  assert.match(SRC, /\.\.\.\(roleVars as React\.CSSProperties\)/, "the variables are never spent on an element");
});

test("the block-level title colour stands down for a banner's own title colour", () => {
  assert.match(
    SRC,
    /blockTitleColor && !roleVars\["--r-title-color"\]/,
    "an inline title colour would beat the role variable and win",
  );
});

test("the block-level subtitle colour stands down the same way", () => {
  assert.match(SRC, /blockSubtitleColor && !roleVars\["--r-body-color"\]/);
});

test("the hero-wide centring yields to a subtitle that set its own alignment", () => {
  assert.match(
    SRC,
    /align === "center" && !roleVars\["--r-body-align"\]/,
    "auto margins would keep pulling an explicitly aligned subtitle back to the middle",
  );
});

test("the button row yields to the CTA role's own alignment", () => {
  assert.match(SRC, /roleVars\["--r-cta-self"\]\s*\n?\s*\?\?/, "hero-ctas ignores the CTA role alignment");
});

test("the hero rules read the role variables, outside the site type scale", () => {
  // Precedence: this banner → the site H1 scale → the banner's own size token
  // → the hard default. The role has to be the outermost term or the site
  // setting would win over the more specific one.
  // There are two rules starting `.hero h1,` — an earlier one that only sets
  // text-wrap, and the type-scale group that actually sizes the heading. Find
  // it by what it contains, not by which comes first; matching the first one
  // reported "no role variable" against a rule that never had a size.
  const heroH1 = /\{([^{}]*--type-h1-size[^{}]*)\}/.exec(CSS);
  assert.ok(heroH1, ".hero h1 type-scale rule not found");
  assert.match(heroH1![1], /font-size:\s*var\(--r-title-size,\s*var\(--type-h1-size/);
  assert.match(heroH1![1], /font-family:\s*var\(--r-title-font,\s*var\(--type-h1-family/);

  /* `.hero p` is set in more than one place (base rules, then the site refresh
     layer); the property has to read the role variable wherever it is set, and
     a later rule is where the winning value is. */
  const heroP = [...CSS.matchAll(/\.hero p \{([\s\S]*?)\}/g)].map((m) => m[1]).join("\n");
  assert.ok(heroP, ".hero p rule not found");
  assert.match(heroP, /font-size:\s*var\(--r-body-size,/);
  assert.match(heroP, /text-align:\s*var\(--r-body-align,/);
  assert.doesNotMatch(heroP, /font-size:\s*(?!\s|var\(--r-body-size|min\(var\(--r-body-size)/, "a .hero p font-size skips the role variable");
});

test("the phone ceiling keeps the role size inside its min()", () => {
  // The cap is a ceiling, not a replacement — a role size below it must still
  // win on a phone, the same rule the type scale already follows.
  assert.match(CSS, /min\(var\(--r-title-size,\s*var\(--type-h1-size/);
});

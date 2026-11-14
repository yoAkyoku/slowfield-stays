import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readStyles } from "./readCode";

/**
 * A responsive override must not be declared before the rule it overrides.
 *
 * Media queries add no specificity. `@media (max-width: 560px) { .x { a: 1 } }`
 * and a later plain `.x { a: 2 }` tie, so source order decides and the plain
 * rule wins at every width — the responsive rule is dead, silently.
 *
 * This has now happened four times in this file: `.se-tab`'s padding, the SOP
 * panel's phone positioning, `.hpb-overlay__title`'s wrap, and the readiness
 * grids (whose fix was to restate the collapses at the end of the file). It is
 * invisible in review because the CSS reads correctly — you have to know which
 * declaration came first.
 *
 * Only the selectors below are checked. A blanket scan of a 34,000-line file
 * produces mostly noise: it is normal and correct for a base rule to follow an
 * unrelated media block, and only a clash on the SAME property for the SAME
 * selector is a bug.
 */

const CSS = readStyles("app/globals.css");

/** Selectors whose responsive behaviour has been broken this way before. */
/* .se-tab (the stay editor's step tabs) became the kit <Segmented size="tabs">,
   and the hover-revealed .inquiry-actions-cell bar became the always-visible
   kit <RowActions>; neither has a responsive override left to shadow. */
const WATCHED = [
  { selector: ".admin-sop-panel", property: "position" },
  { selector: ".admin-sop-panel", property: "min-width" },
  { selector: ".hpb-overlay__title", property: "flex" },
];

type Declaration = { at: number; inMedia: boolean };

/** Comments can contain braces, which would throw the depth count off. */
function stripComments(css: string): string {
  let out = "";
  let i = 0;
  for (;;) {
    const begin = css.indexOf("/*", i);
    if (begin === -1) return out + css.slice(i);
    // Replaced with spaces, not removed, so every offset still lines up.
    out += css.slice(i, begin);
    const finish = css.indexOf("*/", begin);
    if (finish === -1) return out + " ".repeat(css.length - begin);
    out += " ".repeat(finish + 2 - begin);
    i = finish + 2;
  }
}

const CLEAN = stripComments(CSS);

/**
 * Every place `property` is declared for exactly `selector`, and whether that
 * declaration sits inside an @media block.
 *
 * Nesting is decided by counting unbalanced braces before the rule rather than
 * by walking the file: at depth 0 a rule is top level, at depth 1 it is inside
 * an at-rule. Simple, and it cannot drift out of sync the way a stateful walk
 * over 34,000 lines can.
 */
function declarations(selector: string, property: string): Declaration[] {
  const out: Declaration[] = [];

  /* Every rule in the file, matched as "selector list { body }".
   *
   * This used to search for the literal `selector + " {"`, which can only find
   * a selector that is the LAST one in its list. The rule that matters here —
   * the touch override for `.inquiry-actions-cell .admin-row-actions` — is
   * written in a comma group, so the needle never matched it, `responsive` came
   * back empty, and the function below returned before asserting anything. The
   * test was green and inert: appending a plain `opacity: 0` for that selector,
   * the exact shadowing it exists to catch, left all five cases passing.
   *
   * Matching the whole list and then splitting on commas finds a selector
   * wherever it sits. `[^{}]` keeps each match inside one rule, so an at-rule's
   * own `@media (...) {` opener can never be mistaken for a selector.
   */
  const RULE = /([^{}]+)\{([^{}]*)\}/g;
  for (let match = RULE.exec(CLEAN); match !== null; match = RULE.exec(CLEAN)) {
    const selectors = match[1].split(",").map((one) => one.trim()).filter(Boolean);
    if (!selectors.includes(selector)) continue;

    let depth = 0;
    for (const ch of CLEAN.slice(0, match.index)) {
      if (ch === "{") depth += 1;
      else if (ch === "}") depth -= 1;
    }

    for (const declaration of match[2].split(";")) {
      if (declaration.split(":")[0]?.trim() === property) {
        out.push({ at: match.index, inMedia: depth > 0 });
      }
    }
  }
  return out;
}

for (const { selector, property } of WATCHED) {
  test(`${selector} { ${property} } — the responsive override is not shadowed`, () => {
    const found = declarations(selector, property);
    assert.ok(found.length > 0, `no "${property}" declared for ${selector} — renamed?`);

    const lastPlain = found.filter((d) => !d.inMedia).at(-1);
    const responsive = found.filter((d) => d.inMedia);
    if (!lastPlain || responsive.length === 0) return; // only one of the two exists

    for (const override of responsive) {
      assert.ok(
        override.at > lastPlain.at,
        `${selector} sets "${property}" inside a media query at offset ${override.at}, ` +
          `but declares it again outside one at ${lastPlain.at}. Media queries add no ` +
          `specificity, so the later plain rule wins at every width and the responsive ` +
          `rule does nothing. Move the override below the base rule.`,
      );
    }
  });
}

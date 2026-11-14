import assert from "node:assert/strict";
import test from "node:test";
import { readStyles } from "./readCode.mts";

/**
 * Two leftovers from the fixed-track / split-type-level sweeps.
 *
 * 1. 旅遊專欄卡片標題 had the same split the stay card had, in a worse form: the
 *    base was a `font:` SHORTHAND with every value written in, so all four 字級
 *    properties moved nothing on those cards, while the lead variant bound its
 *    size alone to --type-h4-size. And H4 is SMALLER than H3 in the ladder, so
 *    the bigger card answered to the smaller level — setting 小標 and 次小標
 *    could invert the two. Base on H3, lead on H2: one level apart, in the
 *    direction the sizes already run.
 *
 * 2. `.property-features-category-grid` holds every group in the block, and
 *    every group has to draw the same columns. It was briefly auto-fit, to close
 *    the empty tracks a three-item row leaves at the end of a four-track grid —
 *    and auto-fit collapses those tracks, so the survivors take 1fr each and the
 *    column rhythm becomes a function of the item count. Measured on hejing
 *    at 1430: 3 items drew 326.4px tracks, 4 items drew 238.8px, one above the
 *    other. A partial last row is what a grid looks like; three groups on three
 *    different rhythms is not.
 */

const CSS = readStyles("app/globals.css");

type Decl = { at: number; value: string; media: string };

function declarations(selector: string, property: string): Decl[] {
  const out: Decl[] = [];
  const RULE = /([^{}]+)\{([^{}]*)\}/g;
  let cursor = 0, depth = 0, media = "";
  for (let m = RULE.exec(CSS); m; m = RULE.exec(CSS)) {
    for (const ch of CSS.slice(cursor, m.index)) {
      if (ch === "{") depth += 1;
      else if (ch === "}") { depth -= 1; if (depth === 0) media = ""; }
    }
    const at = CSS.lastIndexOf("@media", m.index);
    if (depth > 0 && at > -1) media = CSS.slice(at, CSS.indexOf("{", at)).replace(/\s+/g, " ").trim();
    cursor = m.index + m[0].length;
    if (!m[1].split(",").map((x) => x.replace(/\s+/g, " ").trim()).includes(selector)) continue;
    for (const d of m[2].split(";")) {
      const c = d.indexOf(":");
      if (c === -1) continue;
      if (d.slice(0, c).trim() !== property) continue;
      out.push({ at: m.index, value: d.slice(c + 1).replace(/\s+/g, " ").trim(), media: depth > 0 ? media : "" });
    }
  }
  return out;
}

const BASE = ".journal-mag-card-body h3";
const LEAD = ".journal-mag-card--lead .journal-mag-card-body h3";

test("the card title is no longer frozen in a font shorthand", () => {
  /* `font:` sets size, weight, line-height and family at once from literals, so
     no type level could reach any of them. */
  assert.equal(declarations(BASE, "font").length, 0,
    "the shorthand is back, and the 字級 panel moves nothing on these cards again");
});

test("all four properties come from the same level", () => {
  for (const [sel, level] of [[BASE, "h3"], [LEAD, "h2"]] as Array<[string, string]>) {
    for (const prop of ["font-size", "font-weight", "line-height", "font-family"]) {
      const winner = declarations(sel, prop).filter((d) => !d.media).at(-1);
      assert.ok(winner, `${sel} no longer sets ${prop}`);
      assert.match(winner!.value, new RegExp(`--type-${level}-`),
        `${sel} takes ${prop} from somewhere other than ${level.toUpperCase()}`);
    }
  }
});

test("the lead card is tied to a LARGER level than the base", () => {
  /* The specific incoherence: the bigger card was on H4 while the base was on
     nothing, and H4 sits below H3. Whatever the levels are, the lead's must be
     the higher one or the two can swap when the scale is set. */
  const rank = (v: string) => ["h1", "h2", "h3", "h4"].findIndex((h) => v.includes(`--type-${h}-size`));
  const base = declarations(BASE, "font-size").filter((d) => !d.media).at(-1)!.value;
  const lead = declarations(LEAD, "font-size").filter((d) => !d.media).at(-1)!.value;
  assert.ok(rank(lead) > -1 && rank(base) > -1, "one of the two is not on a type level at all");
  assert.ok(rank(lead) < rank(base), `lead is on a smaller level (${lead}) than the base (${base})`);
});

test("a site that never opened the 字級 panel renders exactly as before", () => {
  // The previous literals, kept as the fallbacks, so the change is invisible
  // until the scale is actually set.
  const base = declarations(BASE, "font-size").filter((d) => !d.media).at(-1)!.value;
  assert.ok(base.includes("clamp(1rem, 1.8vw, 1.35rem)"), `base fallback changed: ${base}`);
  const lead = declarations(LEAD, "font-size").filter((d) => !d.media).at(-1)!.value;
  assert.ok(lead.includes("clamp(1.2rem, 2.5vw, 1.8rem)"), `lead fallback changed: ${lead}`);
  const weight = declarations(BASE, "font-weight").filter((d) => !d.media).at(-1)!.value;
  assert.ok(weight.includes("400"), `base weight fallback changed: ${weight}`);
  const line = declarations(BASE, "line-height").filter((d) => !d.media).at(-1)!.value;
  assert.ok(line.includes("1.3"), `base line-height fallback changed: ${line}`);
});

test("every group of facilities draws the same columns", () => {
  /* One template for the whole block. The block stacks its groups vertically, so
     the columns of 亮點設施 sit directly above the columns of 友善服務 and any
     disagreement between them is visible as a wobble down the page.

     That is what a track count derived from the ITEM COUNT produces, and it is
     why auto-fit is wrong here specifically: it collapses the tracks it cannot
     fill, the survivors take 1fr each, and a three-item group and a four-item
     group end up on different rhythms. The empty track at the end of a partial
     row is the price, and it is the cheaper one. */
  const winner = declarations(".property-features-category-grid", "grid-template-columns")
    .filter((d) => !d.media).at(-1);
  assert.ok(winner, "the facilities grid no longer declares its columns");
  assert.match(winner!.value, /repeat\(\s*\d+\s*,/,
    `the facilities grid must name a fixed number of tracks, as repeat(N, …); found ${winner!.value}`);
  assert.doesNotMatch(winner!.value, /auto-fit|auto-fill/,
    `auto-fit is back (${winner!.value}); it makes the column rhythm depend on how many items a group holds`);
});

test("the narrow-screen counts still win", () => {
  /* Four tracks is right on a wide screen and unreadable on a phone. Those steps
     are inside breakpoints and must still come after the base rule. */
  const all = declarations(".property-features-category-grid", "grid-template-columns");
  const scoped = all.filter((d) => d.media);
  assert.ok(scoped.length >= 2, "the 2-column and 1-column steps are gone");
  assert.ok(scoped.every((d) => d.at > all.filter((x) => !x.media).at(-1)!.at),
    "a breakpoint step now sits before the base rule, so it cannot win");
});

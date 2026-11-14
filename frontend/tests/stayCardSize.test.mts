import assert from "node:assert/strict";
import test from "node:test";
import { readStyles } from "./readCode";

/**
 * The parent site's stay cards are the size of every other CMS index card.
 *
 * 客戶: 母站住宿頁的卡片太大，可以跟其他CMS頁一樣.
 *
 * Measured at 1440px before the fix, /stays drew a 379×710 card with a 4/5
 * portrait photo and a 32px title, against the 343×514 card with a 4/3 photo
 * that /journal, /curation, /news and /dining all share. Three page-local rules
 * caused it, and each is asserted below, because each is the kind of value
 * somebody nudges back while tuning something else.
 *
 * Every assertion here is about the LAST matching rule, never the first. There
 * are three unconditional `.stays-grid` rules in this stylesheet and the file
 * is 35,000 lines long; the first is not the one the browser obeys. The first
 * draft of this test read the rule at line 2364, passed on values nothing
 * renders, and reported a row-gap that had been overridden 19,000 lines later.
 */

const CSS = readStyles("app/globals.css");

/** The bodies of every top-level rule whose whole selector is `sel`, in file
 *  (and therefore cascade) order. */
function topLevelRules(sel: string): string[] {
  const marks = [...CSS.matchAll(new RegExp(`\\n${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{`, "g"))];
  assert.ok(marks.length, `no top-level \`${sel}\` rule`);
  return marks.map((m) => {
    const open = CSS.indexOf("{", m.index!);
    const close = CSS.indexOf("}", open);
    assert.ok(close > open, `the rule \`${sel}\` is unterminated`);
    return CSS.slice(open + 1, close);
  });
}

/** The last top-level `sel` rule — the one that wins at full width. */
function lastTopLevelRule(sel: string): string {
  const all = topLevelRules(sel);
  return all[all.length - 1];
}

/** The last top-level `sel` rule that actually declares `prop`. A later rule
 *  setting only font-weight does not replace an earlier one's font-size, so
 *  "the effective value" is not simply "the last rule". */
function effective(sel: string, prop: string): string {
  const all = topLevelRules(sel).filter((body) => new RegExp(`(^|[\\s;])${prop}:`).test(body));
  assert.ok(all.length, `no top-level \`${sel}\` rule declares ${prop}`);
  return all[all.length - 1];
}

/** Where the winning `.stays-grid` rule starts; its breakpoints follow it. */
const TOP = CSS.lastIndexOf("\n.stays-grid {");

/** A whole `@media (max-width: Npx)` block. Inner braces are indented and the
 *  closing one is not, so the first `\n}` ends the query. */
function mediaBlock(px: number, from = 0): string {
  const at = CSS.indexOf(`@media (max-width: ${px}px) {`, from);
  assert.ok(at > -1, `no @media (max-width: ${px}px) after offset ${from}`);
  const end = CSS.indexOf("\n}", at);
  return CSS.slice(at, end);
}

test("the stays grid uses the shared index gap", () => {
  const stays = lastTopLevelRule(".stays-grid");
  // .articles-grid — every other CMS index — is `gap: 28px`.
  assert.match(
    lastTopLevelRule(".articles-grid"),
    /gap:\s*28px/,
    "the index gap moved; this test is now comparing against nothing",
  );
  assert.match(stays, /column-gap:\s*28px/, "the stays column gap no longer matches the other indexes");
  assert.match(stays, /row-gap:\s*28px/, "the stays row gap no longer matches the other indexes");
  // The old values, which put 60px between columns and 100px between rows.
  assert.ok(!/clamp\(60px,\s*8vw,\s*100px\)/.test(stays), "the oversized row gap is back");
});

test("a stay photo is only portrait once the grid is one column wide", () => {
  /* 4/5 belongs to the phone, where the card is full width. On a grid it makes
     the card half again as tall as an article card. The page-level override is
     gone, so the photo falls back to .stay-card-media's own 4/3. */
  const rules = [...CSS.matchAll(/\.stays-grid \.stay-card-media \{[^}]*\}/g)];
  assert.equal(rules.length, 1, `expected one .stays-grid .stay-card-media rule, found ${rules.length}`);
  assert.match(rules[0][0], /aspect-ratio:\s*4 \/ 5/, "the phone card is no longer portrait");
  // It must sit inside the one-column query, not apply at every width.
  assert.ok(
    mediaBlock(640, TOP).includes(rules[0][0]),
    "the portrait crop escaped the 640px breakpoint and applies to the multi-column grid again",
  );
});

test("the stay card title is the size it is everywhere else", () => {
  const base = effective(".stay-card-body h3", "font-size");
  const size = (rule: string) => rule.match(/clamp\([^)]*\)/)?.[0];
  assert.ok(size(base), "the base stay card title lost its size");

  /* The page-level rule may declare the same size as the base one, or not
     declare a size at all — deleting the override entirely is the cleanest way
     to reach the shared value, and an earlier version of this test forbade it:
     it demanded the rule exist and carry a font-size, so a behaviour-neutral
     cleanup turned it red. What must not happen is a DIFFERENT size. */
  const overrides = topLevelRules(".stays-grid .stay-card-body h3")
    .filter((body) => /(^|[\s;])font-size:/.test(body));
  if (overrides.length === 0) return;
  assert.equal(
    size(overrides[overrides.length - 1]),
    size(base),
    "the /stays title is being bumped away from the size the same card uses on the homepage",
  );
});

test("the stay columns step three → two → one", () => {
  assert.match(
    lastTopLevelRule(".stays-grid"),
    /grid-template-columns:\s*repeat\(3,/,
    "the widest layout is no longer three columns",
  );

  /* The 2-column step is what stops a tablet showing one enormous card: the
     page used to go from three columns straight to one at 820px, which left a
     single 665×1027 portrait card. Both steps must come AFTER the top-level
     rule — an equal-specificity rule wins by position whatever its media query
     says, which is how a dead 1200px 2-column step came to exist here. */
  const two = mediaBlock(900, TOP);
  assert.match(
    two,
    /\.stays-grid \{\s*grid-template-columns:\s*repeat\(2,/,
    "the 2-column step is gone — the grid jumps from three columns to one",
  );
  /* The span reset travels with it: an earlier ≤900px rule still puts the cards
     on a six-track grid with `grid-column: span 3`, and three tracks of a
     two-track grid is one card per row again. */
  assert.match(
    two,
    /\.stays-grid \.stay-card \{\s*grid-column: auto;/,
    "the six-track span is not reset, so the 2-column grid still shows one card per row",
  );

  const one = mediaBlock(640, TOP);
  assert.match(
    one,
    /\.stays-grid \{\s*grid-template-columns:\s*minmax\(0, 1fr\);/,
    "the 1-column step is gone",
  );

  /* Nothing after the breakpoints may set the columns again. */
  const after = CSS.indexOf(one) + one.length;
  const stragglers = [...CSS.slice(after).matchAll(/\.stays-grid[^{,]*\{[^}]*grid-template-columns/g)];
  assert.equal(
    stragglers.length,
    0,
    `${stragglers.length} later rule(s) set .stays-grid columns and will outrank the breakpoints`,
  );
});

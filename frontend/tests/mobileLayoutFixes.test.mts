import assert from "node:assert/strict";
import test from "node:test";
import { readCode, readStyles } from "./readCode.mts";

/**
 * Three things a phone showed that a desktop did not.
 *
 * 1. 橫向捲動 drew arrows on one row and not on another, with identical block
 *    settings — the difference was whether the block happened to have category
 *    chips, because that is what decided which of TWO rail implementations ran.
 * 2. The 選單 button sat 4px from the screen edge under a header asking for
 *    12px of padding: neither the brand nor the actions could shrink, so the
 *    row overflowed to the right.
 * 3. Stacked, images kept their own proportions — a portrait shot 276×414
 *    beside a landscape one 276×184 in the same carousel — because the rules
 *    that let a paired photo match its neighbour's column stayed on when there
 *    was no neighbour left.
 */

const CSS = readStyles("app/globals.css");
const BLOCK_STAYS = "app/modules/home/blocks/BlockStays.tsx";

/* ── 1. one rail, not two ────────────────────────────────────────────────── */

test("the collection row's rail is the component, not just a class", () => {
  const src = readCode(BLOCK_STAYS);
  assert.match(src, /<ScrollRail\s+className=\{`\$\{rowClass\} is-rail`\}/,
    `${BLOCK_STAYS}: the rail branch no longer renders ScrollRail, so the row scrolls without arrows`);
  /* The exact shape that caused it: `is-rail` appended to a plain div's
     className. The class makes it scroll; only the component draws arrows. */
  assert.doesNotMatch(src, /<div className=\{`\$\{rowClass\}\$\{useRail \? " is-rail" : ""\}`\}/,
    "the bare-div rail is back — it scrolls but has no arrows");
});

test("both rail paths agree, so chips no longer decide the behaviour", () => {
  /* CardTagFilter (the chip path) has always used the component. The other path
     now does too; if either stops, the two disagree again. */
  const src = readCode(BLOCK_STAYS);
  assert.match(src, /<CardTagFilter[\s\S]{0,300}rail=\{useRail\}/,
    "the chip path stopped passing the rail through");
  assert.match(readCode("app/modules/home/blocks/CardTagFilter.tsx"), /ScrollRail/,
    "CardTagFilter no longer uses ScrollRail either");
});

test("a short row still refuses the rail", () => {
  // The suppression below three cards is deliberate and must survive the change.
  assert.match(readCode(BLOCK_STAYS), /cardCount > 0 && cardCount < 3/,
    "the short-row threshold is gone; a two-card row would try to scroll");
});

/* ── shared: the last declaration outside an at-rule, and inside one ─────── */

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
    const sels = m[1].split(",").map((s) => s.replace(/\s+/g, " ").trim());
    if (!sels.includes(selector)) continue;
    for (const d of m[2].split(";")) {
      const c = d.indexOf(":");
      if (c === -1) continue;
      if (d.slice(0, c).trim() !== property) continue;
      out.push({ at: m.index, value: d.slice(c + 1).replace(/\s+/g, " ").trim(), media: depth > 0 ? media : "" });
    }
  }
  return out;
}

/* ── 2. the header fits inside its own padding ───────────────────────────── */

test("the brand may give way when the row does not fit", () => {
  const winner = declarations(".site-header .brand", "flex-shrink").at(-1);
  assert.ok(winner, ".site-header .brand no longer declares flex-shrink at all");
  assert.notEqual(winner!.value, "0",
    "the brand cannot shrink, so the actions are pushed past the header's padding again");
});

test("the header's gap has a phone-sized floor", () => {
  const winner = declarations(".site-header", "gap").at(-1);
  assert.ok(winner, ".site-header no longer declares a gap");
  const floor = winner!.value.match(/clamp\(\s*(\d+)px/);
  assert.ok(floor, `expected a clamp() with a floor, got: ${winner!.value}`);
  assert.ok(Number(floor![1]) <= 12,
    `the gap floor is ${floor![1]}px — a desktop figure a 390px phone gets in full`);
});

test("the logo scales rather than squashing when the brand shrinks", () => {
  /* It is an <img> with a FIXED height, so a width-only squeeze distorts it.
     object-fit is what makes shrinking safe. */
  const fit = declarations(".site-header .brand-logo", "object-fit").at(-1);
  assert.ok(fit, "the logo has no object-fit, so shrinking the brand would distort the mark");
  assert.equal(fit!.value, "contain");
});

/* ── 3. one height per group on a phone ──────────────────────────────────── */

test("a stacked room photo has a ratio instead of its own proportions", () => {
  const winner = declarations(".property-room-photo", "aspect-ratio").at(-1);
  assert.ok(winner, "the stacked room photo has no aspect-ratio, so each picture keeps its own height");
  assert.match(winner!.media, /max-width/, "the ratio was applied at every width, not just stacked");
  assert.equal(winner!.value, "3 / 2");
});

test("a stacked paired gallery has one too", () => {
  const sel = ".property-block-pair .property-image-gallery:not(.has-card-ratio) .property-image-gallery-item";
  const all = declarations(sel, "aspect-ratio");
  assert.ok(all.length >= 2, "expected the unpaired override AND the stacked restoration");
  const winner = all.at(-1)!;
  assert.match(winner.media, /max-width/, "the stacked restoration is not inside a breakpoint");
  assert.notEqual(winner.value, "auto", "stacked, the gallery is back to keeping each photo's own shape");
});

test("the overflow is cropped from the top, not the middle", () => {
  for (const sel of [".property-room-photo img", ".property-block-pair .property-image-gallery-item img"]) {
    const pos = declarations(sel, "object-position").at(-1);
    assert.ok(pos, `${sel} has no object-position, so the crop takes the ceiling and the floor equally`);
    assert.match(pos!.value, /top|0%|0px/, `${sel} crops from ${pos!.value}, not the top`);
  }
});

test("the room photo fills its ratio box rather than letterboxing", () => {
  const h = declarations(".property-room-photo img", "height").at(-1);
  assert.ok(h, ".property-room-photo img no longer sets a height");
  assert.notEqual(h!.value, "auto",
    "height:auto is what let each photo keep its own proportions in the first place");
  const fit = declarations(".property-room-photo img", "object-fit").at(-1);
  assert.equal(fit?.value, "cover", "without cover the picture is letterboxed inside the ratio box");
});

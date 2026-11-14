import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readStyles, readCode } from "./readCode";

/**
 * Nothing on 聯絡我們 is drawn in a black frame.
 *
 * 客戶: 上面那個有黑框的拿掉，留下面兩個那種類型 — the 通訊處 area was shown with
 * the central contact card framed in near-black `var(--ink)` above a stack of
 * plain hairline cards, and the framed version was rejected outright. The frame
 * is a single `border` declaration, so it comes back the moment anyone restyles
 * that card; these lock the surfaces to the same hairline the office cards use.
 *
 * Asserted on the LAST declaration that reaches each surface, not on the
 * presence of a correct one. globals.css is 35k lines and restyles the same
 * contact selectors in three separate places — a fix declared early and
 * clobbered later reads as present and renders as broken, which is how this
 * page's earlier border and width bugs survived review. A `.contact-page`-
 * qualified rule counts as a clobberer, because it wins on specificity too.
 */

/* Comments are stripped first. Several of these rules are introduced by a
   paragraph of prose containing commas and colons, and a rule scanner that
   keeps them reads the prose as part of the selector list — every rule below
   silently goes missing and the file passes by finding nothing. */
const CSS = readStyles("app/globals.css").replace(/\/\*[\s\S]*?\*\//g, " ");

/** Innermost `selector { declarations }` rules, in file order. An @media
 *  prelude cannot match because a selector may not contain a brace. */
const RULES = [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
  selectors: m[1].split(",").map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean),
  body: m[2],
}));

/** Does this selector style the element itself, rather than a descendant? */
const hits = (sel: string, target: string) => sel === target || sel.endsWith(` ${target}`);

/** Every declaration of `prop` that lands on `target`, in file order. */
function declarations(target: string, prop: string): string[] {
  const out: string[] = [];
  for (const rule of RULES) {
    if (!rule.selectors.some((s) => hits(s, target))) continue;
    for (const decl of rule.body.split(";")) {
      const name = decl.slice(0, decl.indexOf(":")).trim();
      if (name === prop) out.push(decl.slice(decl.indexOf(":") + 1).trim());
    }
  }
  return out;
}

/** A colour that would read as a drawn black outline against the cream page. */
function isInky(value: string): boolean {
  if (/var\(\s*--ink\b/.test(value)) return true;
  if (/(^|[^-\w])(black|#000|#000000)([^-\w]|$)/i.test(value)) return true;
  // rgb()/rgba() where every channel is dark and the alpha is not a hairline wash.
  const rgb = value.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*(?:[,/]\s*([\d.]+))?\s*\)/);
  if (rgb) {
    const [r, g, b] = [rgb[1], rgb[2], rgb[3]].map(Number);
    const alpha = rgb[4] === undefined ? 1 : Number(rgb[4]);
    if (r < 60 && g < 60 && b < 60 && alpha > 0.5) return true;
  }
  return false;
}

/* The two surfaces the client compared: the central card that carried the
   frame, and the 通訊處 card whose treatment was the one to keep. */
const SURFACES = [".page-block-contact-info", ".contact-office"];

for (const surface of SURFACES) {
  test(`${surface} is not framed in black`, () => {
    const borders = [...declarations(surface, "border"), ...declarations(surface, "border-color")];
    assert.ok(borders.length > 0, `${surface} declares no border at all — the scan found nothing`);
    for (const value of borders) {
      assert.ok(!isInky(value), `${surface} is framed with ${value} — the rejected black box`);
    }
  });

  test(`${surface} keeps the hairline the reference uses`, () => {
    const borders = declarations(surface, "border");
    assert.ok(borders.length > 0, `${surface} no longer draws an edge`);
    const last = borders[borders.length - 1]!;
    assert.match(
      last,
      /var\(\s*--line\b/,
      `the edge that wins on ${surface} is ${last}, not the shared hairline`,
    );
  });
}

test("the central card is optional, so a page listing 通訊處 need not show it", () => {
  // Restyling the framed card is half the answer; the other half is that a page
  // can leave it out entirely and keep its values, which is what /contact does.
  const src = readCode("app/modules/content/PageBlocks.tsx");
  assert.ok(src.includes("config.show_primary !== false"), "the card is unconditional again");
  const villa = readCode("app/modules/property/blocks/BlockContactInfo.tsx");
  assert.ok(
    villa.includes("config.show_primary !== false"),
    "the villa renderer ignores the toggle, so the same block differs by page",
  );
});

test("the 通訊處 cards are separated rather than welded into one frame", () => {
  // Each office is a different place with a different address; flush against one
  // another they read as a single boxed table rather than as the independent
  // entries that were asked for (客戶: 每個通訊處獨立呈現).
  const gaps = declarations(".contact-offices", "gap");
  assert.ok(gaps.length > 0, "the office list sets no gap");
  const last = gaps[gaps.length - 1]!;
  assert.ok(Number.parseFloat(last) > 0, `the offices are welded together: gap ${last}`);
});

test("the comment stripper has not swallowed the file", () => {
  // The scan above is only as good as its input: if a change to the comment
  // pattern ate the stylesheet, every assertion here would pass by finding
  // nothing at all. This is the canary for that.
  assert.ok(RULES.length > 2000, `only ${RULES.length} rules parsed out of globals.css`);
  assert.ok(
    RULES.some((r) => r.selectors.includes(".contact-office")),
    "the 通訊處 card rule is not being seen by the scan",
  );
});

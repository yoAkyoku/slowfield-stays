import assert from "node:assert/strict";
import test from "node:test";
import { readCode, readStyles } from "./readCode.mts";

/**
 * One defect, five places: a grid that names a FIXED number of tracks (or a
 * fixed position per child) while the component filling it renders a VARIABLE
 * number of children, because the underlying fields are optional or the list
 * comes from the CMS.
 *
 * The case that started it: `.contact-office` declared
 * `minmax(200px, 1fr) 1.5fr 0.9fr 1.2fr` — a branch name plus exactly THREE
 * field columns — while ContactOffices renders up to FOUR optional fields
 * (地址 / 電話 / Email / LINE) through a <dl> set to `display: contents`, so
 * every pair became a direct item of that four-track grid. Filling in LINE made
 * a fifth item and it wrapped onto a second row, landing under the branch name
 * (客戶: 加了 line 資訊就不夠寬了). Widening the page could not help — with four
 * tracks declared a fifth item wraps at ANY width, which is why removing the
 * page's 左右留白 changed nothing.
 *
 * Every assertion here is POSITIONAL: the LAST declaration of the property on
 * that selector outside an at-rule. globals.css is 36,000 lines with a long
 * tail of overrides, so "the file mentions the right value somewhere" is not
 * evidence that the right value wins.
 */

const CSS = readStyles("app/globals.css");

/* ── the last-winning declaration, and whether it is inside a breakpoint ──── */

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

/** The declaration that governs at full width — no breakpoint involved. */
function winner(selector: string, property: string): Decl | undefined {
  return declarations(selector, property).filter((d) => d.media === "").at(-1);
}

/**
 * How many columns a track list actually declares.
 *
 * Split at the top level only: `minmax(200px, 1fr)` is ONE track and the comma
 * inside it must not be read as a separator. `repeat(3, …)` counts as three.
 * A list built with auto-fit / auto-fill has no fixed count at all and is
 * reported as Infinity — that is the shape this whole file is arguing for.
 */
function trackCount(value: string): number {
  if (/auto-fit|auto-fill/.test(value)) return Infinity;
  const tracks: string[] = [];
  let depth = 0, cur = "";
  for (const ch of value) {
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    if (/\s/.test(ch) && depth === 0) { if (cur) tracks.push(cur); cur = ""; }
    else cur += ch;
  }
  if (cur) tracks.push(cur);
  let n = 0;
  for (const t of tracks) {
    const rep = /^repeat\((\d+),/.exec(t);
    n += rep ? Number(rep[1]) : 1;
  }
  return n;
}

/**
 * A selector's class/attribute/pseudo-class count — the middle CSS specificity
 * column. No id or element weighting is needed: nothing compared in this file
 * uses either.
 */
function specificity(selector: string): number {
  return (selector.match(/\.[A-Za-z_-]|:[a-z-]+\(|:[a-z-]+(?!\()|\[/g) ?? []).length;
}

/* ── 1. 通訊處 with a 說明 — the same bug, in the other branch ────────────── */

/* OfficeCard wraps the row in .contact-office-summary only when the office
   carries a note, and that row had kept the four-track list the plain card was
   fixed for. An office with a 說明 AND all four fields put LINE on a second row
   at the branch name's left edge — measured at x=93 against a head at x=93,
   while the same office without a note put it at x=351, under 地址. */

test("a 通訊處 row is a name and everything else, not a name plus N fields", () => {
  for (const sel of [".contact-office", ".contact-office-summary", ".contact-office.has-note .contact-office-summary"]) {
    const w = winner(sel, "grid-template-columns");
    assert.ok(w, `${sel} no longer declares grid-template-columns at full width`);
    assert.equal(trackCount(w!.value), 2,
      `${sel} declares ${trackCount(w!.value)} tracks (${w!.value}) — one per field again, so the ` +
      `${trackCount(w!.value)}th field wraps under the branch name at any width`);
  }
});

test("the fields lay themselves out instead of being handed to the row", () => {
  const w = winner(".contact-office.has-note .contact-office-fields", "display");
  assert.ok(w, ".contact-office.has-note .contact-office-fields declares no display at full width");
  assert.notEqual(w!.value, "contents",
    "`display: contents` promotes every field into the row's grid again, which is what tied " +
    "the row to a fixed number of them");
  assert.equal(w!.value, "grid");
});

test("and they wrap among themselves, collapsing tracks they cannot fill", () => {
  for (const sel of [".contact-office-fields", ".contact-office.has-note .contact-office-fields"]) {
    const w = winner(sel, "grid-template-columns");
    assert.ok(w, `${sel} declares no track list at full width`);
    assert.equal(trackCount(w!.value), Infinity,
      `${sel} declares a fixed ${trackCount(w!.value)} tracks (${w!.value}); auto-fit is what lets ` +
      "an office with two fields close the gap and one with four wrap tidily");
  }
});

test("the renderer really can emit four fields, so the two-track shape is required", () => {
  const src = readCode("app/modules/content/ContactOffices.tsx");
  for (const field of ["地址", "電話", "Email 或其他聯絡資訊", "LINE"]) {
    assert.ok(src.includes(field), `ContactOffices no longer renders the ${field} field`);
  }
  assert.match(src, /contact-office-field/, "the field wrapper class is gone");
});

/* ── 2. 拼貼 gallery — hand-placed grid lines against an open-ended count ─── */

/* LightboxGallery caps the count at six, so `--n6` is the bucket for 6, 7, 8 …
   photos while every wrapper also carries `property-collage--n6`, the staggered
   three-column wall. The wall won the columns and the hand-placed
   `grid-column: 5 / 7` stayed, so columns 4–6 were created implicitly at 0px:
   photos 3 and 6 rendered 19px wide out of a 197px column. */

test("--n6 is a bucket for six OR MORE photos, not a six-photo composition", () => {
  const src = readCode("app/modules/property/LightboxGallery.tsx");
  assert.match(src, /Math\.min\(images\.length,\s*6\)/,
    "LightboxGallery no longer caps the count at 6 — re-check what --n6 now means");
  assert.match(src, /property-scatter--n\$\{n\}[\s\S]{0,60}property-collage--n\$\{n\}/,
    "the wrapper no longer carries both class families, so the collision premise has changed");
});

test("nothing hand-places a photo inside the 6+ wall", () => {
  const placed = /\.property-scatter--n6[^{}]*:nth-child\([^)]*\)[^{}]*\{[^{}]*grid-(?:column|row)/g;
  const hits = CSS.match(placed) ?? [];
  assert.equal(hits.length, 0,
    `${hits.length} hand-placed grid lines are back on .property-scatter--n6 (e.g. ${hits[0]}). ` +
    "The wall declares three columns; `grid-column: 5 / 7` makes columns 4-6 implicitly at 0px.");
});

test("and the 6+ bucket declares no fixed grid of its own", () => {
  for (const prop of ["grid-template-columns", "grid-template-rows", "aspect-ratio"]) {
    assert.equal(winner(".property-scatter--n6", prop), undefined,
      `.property-scatter--n6 declares ${prop} again; it fights .property-collage--n6, which is ` +
      "the only layout here that copes with a seventh photo");
  }
  const wall = winner(".property-collage--n6", "grid-template-columns");
  assert.ok(wall, ".property-collage--n6 no longer declares the wall's tracks");
  assert.match(wall!.value, /repeat\(3,/, `the wall is ${wall!.value}, not three columns`);
});

test("the phone overlap fallback skips the count that has no corner geometry", () => {
  /* At ≤640px a scatter collage goes back to being absolutely positioned corner
     photos — and those coordinates exist for n2–n5 only. Sent down that path,
     --n6 became a display:block box of absolutely positioned items with no
     left/top/width/height at all: all nine photos stacked on one 31×39px spot. */
  const guarded = declarations(".property-scatter.property-collage:not(.property-collage--n6)", "display");
  assert.equal(guarded.at(-1)?.value, "block",
    "the ≤640px overlap fallback no longer sets display: block on the guarded selector — re-read this test");
  assert.match(guarded.at(-1)!.media, /max-width:\s*640px/,
    "the fallback moved out of the phone breakpoint");
  /* The unguarded selector still carries the DESKTOP rule (`display: grid`);
     what must not come back is an unguarded `display: block`, which is the
     fallback itself. */
  assert.equal(
    declarations(".property-scatter.property-collage", "display").filter((d) => d.value === "block").length,
    0,
    "an UNGUARDED `.property-scatter.property-collage { display: block }` is back, so --n6 is " +
    "caught by the overlap fallback again — and it has no corner coordinates to fall back TO");

  const items = ".property-scatter:not(.property-collage--n6) .property-scatter-item.property-collage-item";
  assert.equal(declarations(items, "position").at(-1)?.value, "absolute",
    "the guarded ≤640px rule no longer positions the collage items — re-read this test");
  assert.equal(
    declarations(".property-scatter .property-scatter-item.property-collage-item", "position")
      .filter((d) => d.media !== "").length,
    0,
    "--n6's photos are absolutely positioned inside a breakpoint again with nothing to position them");
});

/* ── 3. split 聯絡表單 — an optional first column ─────────────────────────── */

test("a split contact form with no heading takes the whole row", () => {
  const src = readCode("app/modules/content/ContactFormBlock.tsx");
  assert.match(src, /\{\(eyebrow \|\| title \|\| subtitle\) && \(/,
    "the header is no longer conditional — re-check whether the form can still be the only item");
  const w = winner(".page-block-contact-form.is-split > .inquiry-form:only-child", "grid-column");
  assert.ok(w, "nothing rescues the form when 眉標/標題/副標 are all blank: as the only grid item it " +
    "sits in the 0.62fr heading track and draws 345px wide inside a 1147px block");
  assert.match(w!.value, /1\s*\/\s*-1/, `the form spans ${w!.value}, not the full row`);
});

/* ── 4. 相片拼貼牆 — three tracks and a two-row lead tile ─────────────────── */

test("one or two photos do not sit in a three-column wall", () => {
  assert.equal(trackCount(winner(".home-gallery-grid.count-1", "grid-template-columns")?.value ?? ""), 1,
    "count-1 is not one column: a single photo drew 331px wide and 488px tall with 677px of nothing beside it");
  assert.equal(trackCount(winner(".home-gallery-grid.count-2", "grid-template-columns")?.value ?? ""), 2,
    "count-2 is not two columns, so the third track stays empty");
});

test("the lead tile stops spanning two rows it cannot fill", () => {
  const LEAD = ".home-gallery-item:nth-child(1)";
  const lead = winner(LEAD, "grid-row");
  assert.equal(lead?.value, "span 2", "the wall's lead tile no longer spans two rows — re-read this test");
  for (const n of [1, 2, 3]) {
    const sel = `.home-gallery-grid.count-${n} .home-gallery-item:nth-child(1)`;
    const w = winner(sel, "grid-row");
    assert.ok(w, `${sel} does not cancel the row span, so ${n} photo(s) leave a 240px hole below them`);
    assert.equal(w!.value, "span 1");
    /* It beats the span-2 rule on SPECIFICITY, not source order — the cancel
       sits earlier in the file than the rule it overrides, and would silently
       lose if it ever stopped being the more specific of the two. */
    assert.ok(specificity(sel) > specificity(LEAD),
      `${sel} is no longer more specific than ${LEAD}, so the two-row span wins again`);
  }
});

test("count-3 keeps no desktop track list, so the phone rule still narrows it", () => {
  /* .home-gallery-grid.count-3 would out-specify the ≤900px two-column rule,
     which has one class fewer — three photos would stay in three columns on a
     phone. Three IS the base count, so it needs no rule of its own. */
  assert.equal(winner(".home-gallery-grid.count-3", "grid-template-columns"), undefined,
    "count-3 declares its own tracks and now beats the ≤900px phone rule");
});

test("the count class the CSS keys on is still the one the component emits", () => {
  assert.match(readCode("app/modules/home/HomePhotoGallery.tsx"), /count-\$\{Math\.min\(shown\.length,\s*6\)\}/,
    "HomePhotoGallery no longer emits count-N, so every count-N rule above is dead");
});

/* ── 5. 交通與聯繫 cards — up to three, never exactly three ───────────────── */

test("the contact cards close the tracks they have no card for", () => {
  const w = winner(".property-contact-cards", "grid-template-columns");
  assert.ok(w, ".property-contact-cards declares no track list at full width");
  assert.equal(trackCount(w!.value), Infinity,
    `the cards sit in a fixed ${trackCount(w!.value)}-track grid (${w!.value}); each card is drawn only ` +
    "when its own CMS fields are filled, so an address-only block left two empty columns");
});

/* ── 6. 入住須知 — "the last two" is only the last ROW when the count is even ─ */

test("only the bottom row of the house rules drops its hairline", () => {
  /* 入住須知 items come from the CMS in any number and lay out two per row.
     `:nth-last-child(-n+2)` names the final row only for an even count: with
     five rules the fourth is in the RIGHT column of the MIDDLE row, and it lost
     its border there — the hairline under 規則 3 crossed the left half of the
     list and stopped in the middle. Measured: item 4 at row y=201 with
     border-bottom 0px while item 3, beside it, had 0.8px. */
  const rules = CSS.match(/\.property-house-rules-item:nth-last-child\([^)]*\)[^{}]*\{[^{}]*border-bottom/g) ?? [];
  assert.ok(rules.length > 0, "nothing clears the last row's border any more — re-read this test");
  for (const r of rules) {
    assert.doesNotMatch(r, /nth-last-child\(\s*-n\s*\+\s*2\s*\)/,
      "`-n+2` is back: it takes the second-to-last item whichever column it is in, " +
      "so an odd number of rules leaves a hairline running half way across the list");
  }
  const last = winner(".property-house-rules-item:nth-last-child(2):nth-child(odd)", "border-bottom");
  assert.equal(last?.value, "none",
    "the left-column half of the last row keeps a border, so an even count draws a rule under the list");
  /* Two columns is what the odd-child reasoning depends on. */
  const cols = winner(".property-house-rules-list", "grid-template-columns");
  assert.equal(cols?.value, "1fr 1fr",
    `the list is ${cols?.value}; the :nth-child(odd) test for "left column" only holds at two columns`);
  /* At one column every item is its own row, so the odd-child clause must be
     taken back — otherwise the second-to-last rule loses its border on a phone. */
  const phone = declarations(".property-house-rules-item:nth-last-child(2):nth-child(odd)", "border-bottom")
    .filter((d) => d.media !== "").at(-1);
  assert.ok(phone, "the one-column breakpoint no longer restores the second-to-last border");
  assert.notEqual(phone!.value, "none");
});

test("the rules really are a CMS list of any length", () => {
  assert.match(readCode("app/modules/property/blocks/BlockHouseRules.tsx"), /items\.map\(\(item, i\) =>/,
    "BlockHouseRules no longer maps a variable list, so the row arithmetic above may not apply");
});

test("all three cards really are optional", () => {
  /* Anchored on the CARD, not on the bare condition: the classic layout in the
     same file gates an address column and a directions panel on the identical
     `{address && (` / `{directions && (`, so a condition-only match stays green
     while the card it is supposed to be describing has become unconditional. */
  const src = readCode("app/modules/property/blocks/BlockContactInfo.tsx");
  for (const [cond, label] of [["hasReach", "聯絡我們"], ["address", "地址"], ["directions", "如何抵達"]]) {
    assert.match(src, new RegExp(`\\{${cond} && \\(\\s*<div className="property-contact-card">`),
      `the ${label} card is no longer drawn only when its own fields are filled`);
  }
});

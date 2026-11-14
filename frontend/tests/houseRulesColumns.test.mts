import assert from "node:assert/strict";
import test from "node:test";
import { readCode, readStyles, cssRules, splitSelectorList } from "./readCode";
import { jsxTags } from "./sourceEval";

/**
 * 編號條列 as three columns.
 *
 * The block draws 01/02/03 items as a two-column run of hairlined rows, which
 * reads as a list. The brand-story design sets the same three items side by
 * side with the number above its copy — three principles of equal weight — and
 * there was no way to ask for it.
 *
 * The interesting part is not the grid. It is that every selector for the
 * variant is (0,3,0) while the block's existing phone rule caps
 * `.property-house-rules-list` at (0,1,0), so a three-column rule written the
 * obvious way outranks the phone override and a 375px screen gets three 90px
 * columns. That is the same breakpoint inversion this stylesheet has been
 * carrying in four other places; the test below is what stops it coming back
 * here.
 */

const COMPONENT = "app/modules/property/blocks/BlockHouseRules.tsx";
const CSS = readStyles("app/globals.css");
const RULES = cssRules(CSS);

/** Every rule whose selector list mentions `.is-columns` inside this block. */
const COLUMN_RULES = RULES.filter((r) =>
  splitSelectorList(r.selector).some((s) => s.includes(".property-house-rules.is-columns")),
);

test("the class is emitted for the stored value, and only for that value", () => {
  const src = readCode(COMPONENT);
  /* Allow-listed, not passed through: it spells a class name, and the config it
     comes from is editor-writable. `config.layout` reaching className directly
     would put an arbitrary stored string into the markup. */
  assert.match(
    src,
    /const layout = config\.layout === "columns" \? "columns" : "rows"/,
    "the 版型 value is no longer narrowed to the two the stylesheet draws",
  );
  const section = jsxTags(COMPONENT).find((t) => t.tag === "section");
  assert.ok(section, "the block no longer renders a <section>");
  assert.match(
    String(section.attrs.get("className")),
    /is-columns/,
    "the section no longer carries is-columns — the CSS variant is unreachable",
  );
});

test("the three-column grid is written narrow-first so a phone cannot inherit it", () => {
  const grid = COLUMN_RULES.filter((r) => /grid-template-columns/.test(r.body));
  assert.ok(grid.length >= 2, "expected a base grid and a widened one; found " + grid.length);

  const base = grid.find((r) => r.atRule === "");
  assert.ok(base, "the variant has no unconditional grid — a phone would fall through to the two-column default");
  assert.match(base.body, /grid-template-columns:\s*1fr\s*;/, "the variant's base layout is no longer a single column");

  const wide = grid.filter((r) => r.atRule !== "");
  assert.ok(wide.length > 0, "the three-column grid is unconditional — it would apply at 375px too");
  for (const r of wide) {
    /* A `max-width` cap here would be the inversion: the rule is more specific
       than the phone rule it would have to lose to. Only a min-width query can
       express "three columns from here up" without a specificity fight. */
    assert.match(
      r.atRule,
      /@media \(min-width:/,
      `the three-column rule is gated on ${r.atRule} — a max-width cap cannot outrank a (0,3,0) selector`,
    );
    assert.match(r.body, /repeat\(3,/, "the widened grid is no longer three columns");
  }
});

test("the rows layout's hairlines do not survive into the columns", () => {
  /* The row treatment is a bottom border per item plus two `:last-child` /
     `nth-last-child` exceptions that reason about a LEFT COLUMN. In a
     three-column grid those selectors name the wrong cells, so the variant
     turns the border off rather than trying to restate them. */
  const item = COLUMN_RULES.find((r) => r.selector.includes(".property-house-rules-item") && r.atRule === "");
  assert.ok(item, "the columns variant no longer restyles the item");
  assert.match(item.body, /border-bottom:\s*none/, "the row hairline is back under the columns");
  assert.match(item.body, /display:\s*block/, "the number sits beside its copy again rather than above it");
});

test("文字外觀 › 標題 still reaches an item title in the columns layout", () => {
  /* The rows layout threads `--r-title-size` through
     `.property-house-rules-content strong`. The variant overrides that
     declaration at higher specificity, so it has to keep the variable or the
     role control silently stops working for exactly this layout — the defect
     class the whole 角色排版 change set exists to close. */
  const strong = COLUMN_RULES.find((r) => r.selector.includes("strong"));
  assert.ok(strong, "the columns variant no longer sizes its item titles");
  assert.match(
    strong.body,
    /font-size:\s*var\(--r-title-size,/,
    "the columns variant hardcodes its title size, so 文字外觀 › 標題 › 字級 does nothing here",
  );
});

test("the editor offers 版型 and writes the key the renderer reads", () => {
  const src = readCode("app/admin/modules/blockForms.tsx");
  const at = src.indexOf("export function HouseRulesConfigForm");
  assert.ok(at > 0, "HouseRulesConfigForm is gone — re-anchor this test");
  const form = src.slice(at, src.indexOf("export function", at + 10));
  assert.match(form, /aria-label=\{zh \? "版型" : "Layout"\}/, "編號條列 no longer offers a 版型 control");
  /* The exact key and value the component narrows on. A control writing
     `variant` or `"three"` would save, preview, and change nothing on the
     page. */
  assert.match(form, /layout: v === "columns" \? "columns" : undefined/, "the 版型 control no longer writes config.layout");
  assert.match(form, /\["columns", zh \? "三欄"/, "the 三欄 option is gone or renamed");
});

test("a collection placed under an existing heading can be left headless", () => {
  /* Same defect, same fix, one block over. `BlockStays` read its headline with
     cfgT, which hands back the built-in 為你嚴選的台灣旅宿 for an empty string as
     well as an absent key — so a 內容集合 dropped under a heading the page
     already carries printed a second one over itself and there was no way to
     turn it off.

     Safe to change because nothing depended on the old behaviour: all five
     stays blocks live on the site today carry a real headline (checked against
     the parent and both villa sites before the change). */
  const src = readCode("app/modules/home/blocks/BlockStays.tsx");
  assert.match(
    src,
    /const headline = clearableT\(c, "headline", locale, h\.headline\)/,
    "the collection headline is back on cfgT, so an emptied heading reappears as the built-in one",
  );
  /* And an empty one must render nothing rather than an empty <h2>, which is
     what the guard is for — three layouts draw it. */
  const guarded = [...src.matchAll(/\{headline && <h2>\{headline\}<\/h2>\}/g)].length;
  const bare = [...src.matchAll(/(?<!\{headline && )<h2>\{headline\}<\/h2>/g)].length;
  assert.equal(bare, 0, `${bare} of the collection's headings render an empty <h2> when the heading is cleared`);
  assert.equal(guarded, 3, `expected all three layouts to guard the heading, found ${guarded}`);
});

test("a collection with nothing in its header does not reserve the header's space", () => {
  /* Clearing the heading was only half of it. `.section-header` carries 24px of
     padding and 32px of margin below it whether or not it holds anything, so a
     collection with both fields cleared still pushed its cards 56px down from
     an empty box — measured on /brand, and indistinguishable to the reader from
     the heading gap they had just asked to close.

     All three layouts, because all three draw a header. */
  const src = readCode("app/modules/home/blocks/BlockStays.tsx");
  const guards = [...src.matchAll(/\{\(eyebrow \|\| headline\) && \(/g)].length;
  assert.equal(guards, 3, `expected all three layouts to skip an empty header, found ${guards}`);
  /* And the guard has to wrap the header ELEMENT, not just its contents — the
     padding belongs to the box, so an empty box is the whole problem. */
  for (const cls of ["section-header", "home-showcase-head", "home-news-head"]) {
    const at = src.indexOf(`className="${cls}`);
    assert.ok(at > 0, `${cls} is gone — re-anchor this test`);
    const before = src.slice(Math.max(0, at - 260), at);
    assert.match(
      before,
      /\{\(eyebrow \|\| headline\) && \($/m,
      `the ${cls} box still renders when both fields are cleared, reserving its own padding`,
    );
  }
});

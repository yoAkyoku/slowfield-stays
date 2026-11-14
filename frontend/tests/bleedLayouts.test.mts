import assert from "node:assert/strict";
import test from "node:test";
import { readCode, readStyles, cssRules, splitSelectorList } from "./readCode";
import { jsxTags } from "./sourceEval";
import { altRowRenders, altReindex } from "../app/admin/modules/alternatingRows.ts";

/**
 * The two layouts the brand-story design asks for: a hero whose photograph sits
 * BESIDE the words, and rows whose photographs run off their own edge of the
 * page, numbered 01 / 02 / 03.
 *
 * Both are one idea — take the picture out from UNDER the text. That is not
 * decoration. Text over a photograph is legible only as far as the mask allows,
 * and the mask trades the picture against the words: measured on /brand's own
 * hero, white copy over the photo sits at 1.86:1 against a 3.0 minimum, and the
 * only way to fix it within the overlay is to wash the photograph out. Split,
 * the words are on the page background at full contrast and the photograph is
 * untouched.
 *
 * The bleed arithmetic is `calc(50% - 50vw)`. A percentage margin resolves
 * against the CONTAINING BLOCK's width, and both containers are centred, so
 * that is exactly the distance from the container's edge to the window's. It is
 * the same expression blockStyle already uses for a full-bleed band, and the
 * tests below pin that sameness: a page must not hold two ideas of where the
 * edge is.
 */

const CSS = readStyles("app/globals.css");
const RULES = cssRules(CSS);
const ALT = "app/modules/property/blocks/BlockAlternating.tsx";
const HERO = "app/modules/content/PageHero.tsx";

function ruleFor(selector: string, atRule = "") {
  return RULES.find((r) => r.atRule === atRule && splitSelectorList(r.selector).some((s) => s.trim() === selector));
}

/* ── 圖文交錯 · 出血 ─────────────────────────────────────────────────── */

test("the bleed layout is a narrowed value, not a stored class name", () => {
  const src = readCode(ALT);
  assert.match(
    src,
    /const layout = c\.layout === "bleed" \? "bleed" : "framed"/,
    "the 版型 value is no longer narrowed to the two the stylesheet draws",
  );
  const section = jsxTags(ALT).find((t) => t.tag === "section");
  assert.ok(section, "the block no longer renders a <section>");
  assert.match(String(section.attrs.get("className")), /is-bleed/, "the section never carries is-bleed");
});

test("the row number comes from the position, never from stored state", () => {
  /* The same reason this block derives the picture's SIDE from the index: a
     stored number goes stale the moment a row is inserted or reordered, and it
     goes stale silently. */
  const src = readCode(ALT);
  assert.match(
    src,
    /String\(i \+ 1\)\.padStart\(2, "0"\)/,
    "the row number is no longer counted from the row's position",
  );
  assert.doesNotMatch(src, /item\.num|item\.number/, "a per-row number field is back; it will drift on reorder");
  // Decorative: the row's real name is the heading beside it.
  assert.match(src, /className="alternating-num" aria-hidden="true"/, "the ordinal is announced as content");
});

test("each row can carry its own label beside the block's", () => {
  /* The design puts a Latin label over each row (DESIGN / PRIVACY / SERVICE).
     One eyebrow for the whole block cannot say three different things. */
  const src = readCode(ALT);
  assert.match(src, /eyebrow: cfgT\(item, "eyebrow", locale\)/, "the per-row label is no longer read");
  /* And a row that has ONLY a label still renders — otherwise the filter drops
     a row an author is midway through filling in. */
  assert.match(
    src,
    /\.filter\(\(item\) => item\.image \|\| item\.title \|\| item\.body \|\| item\.eyebrow\)/,
    "a row carrying only a label is dropped",
  );
});

test("each picture bleeds off its own side, on the one named distance", () => {
  const right = ruleFor(".alternating-section.is-bleed .property-rich-text--img-right .property-rich-split-media");
  const left = ruleFor(".alternating-section.is-bleed .property-rich-text--img-left .property-rich-split-media");
  assert.ok(right && left, "the bleed rules are gone — re-anchor this test");
  assert.match(
    right.body,
    /margin-right:\s*calc\(-1 \* var\(--bleed-out\)\)/,
    "the right-hand picture no longer reaches the window",
  );
  assert.match(
    left.body,
    /margin-left:\s*calc\(-1 \* var\(--bleed-out\)\)/,
    "the left-hand picture no longer reaches the window",
  );
  /* Each picture bleeds on ITS OWN side only. Bleeding both would make the row
     a full-width band and there would be nowhere for the copy to sit. */
  assert.doesNotMatch(right.body, /margin-left:\s*calc\(/, "the right-hand picture also bleeds left");
  assert.doesNotMatch(left.body, /margin-right:\s*calc\(/, "the left-hand picture also bleeds right");
});

test("a picture that runs off the page has no rounded corner to round", () => {
  /* The framed layout gives every picture an 18px radius and a shadow. On an
     edge the window itself cuts, a radius reads as a rendering mistake. */
  const img = ruleFor(".alternating-section.is-bleed .alternating-row .property-rich-split-media img");
  assert.ok(img, "the bleed picture no longer overrides the framed treatment");
  assert.match(img.body, /border-radius:\s*0/, "the bleeding picture kept its rounded corners");
  assert.match(img.body, /box-shadow:\s*none/, "the bleeding picture kept its drop shadow");
});

test("the bleed row's copy is left-aligned, and still defers to 文字外觀", () => {
  /* A contained block centres its heading and eyebrow by default —
     `.property-block-contained:not(.is-text-align) .section h2` resolves to
     `var(--r-title-align, center)` at (0,3,1). Right for a boxed section, wrong
     for a column beside a full-bleed photograph. These overrides match that
     specificity and sit later, and every one keeps its role variable: an
     override that hardcoded `left` would take 對齊 away from the block. */
  for (const [sel, v] of [
    [".alternating-section.is-bleed .alternating-row :is(h2, h3)", "--r-title-align"],
    [".alternating-section.is-bleed .alternating-row .eyebrow", "--r-eyebrow-align"],
    [".alternating-section.is-bleed .alternating-row .property-rich-text-body", "--r-body-align"],
  ] as Array<[string, string]>) {
    const rule = ruleFor(sel);
    assert.ok(rule, `${sel} is gone — the bleed row's copy centres itself again`);
    assert.match(
      rule.body,
      new RegExp(`text-align:\\s*var\\(${v}, left\\)`),
      `${sel} either stopped defaulting to left, or stopped deferring to ${v}`,
    );
  }
});

test("the bleed row's two columns are written narrow-first", () => {
  /* `.property-rich-split` is collapsed to one column at (0,1,0) inside
     `@media (max-width: 820px)`. The bleed selector is (0,4,0), so writing the
     two columns unconditionally outranks that collapse at EVERY width and a
     phone keeps two columns, one of them a picture bleeding off the screen.
     Measured at 390 before the fix: the grid stayed 2-up and the row's photo ran
     188..456 on a 390px window.

     Same breakpoint inversion this stylesheet has been carrying in five other
     places, and the same fix: the base value is the narrow one, so there is
     nothing to invert. */
  const cols = RULES.filter(
    (r) => /grid-template-columns/.test(r.body) && r.selector.includes(".alternating-section.is-bleed"),
  );
  assert.ok(cols.length > 0, "the bleed row no longer sets its columns — re-anchor this test");
  for (const r of cols) {
    assert.match(
      r.atRule,
      /@media \(min-width:/,
      `the bleed row's columns are set in "${r.atRule || "no query"}"; only a min-width query can express "two columns from here up" without outranking the phone collapse`,
    );
  }
});

test("stacked, a bleeding picture takes the whole window rather than one edge", () => {
  /* With no copy beside it, a photograph that reaches one edge and stops short
     of the other reads as a mistake. Measured at 390 before the fix: the hero
     photo ran 0..334 on a 390px window. */
  const rows = RULES.filter(
    (r) =>
      /@media \(max-width: 820px\)/.test(r.atRule) &&
      r.selector.includes(".alternating-section.is-bleed") &&
      /margin-left/.test(r.body),
  );
  assert.equal(rows.length, 1, "the stacked bleed row no longer takes the whole window");
  assert.match(rows[0].body, /margin-left:\s*calc\(-1 \* var\(--bleed-out\)\)/);
  assert.match(rows[0].body, /margin-right:\s*calc\(-1 \* var\(--bleed-out\)\)/);

  const hero = RULES.filter(
    (r) => /@media \(max-width: 899px\)/.test(r.atRule) && r.selector.includes("page-hero-split-media"),
  );
  assert.equal(hero.length, 1, "the stacked split hero no longer takes the whole window");
  assert.match(hero[0].body, /margin-right:\s*calc\(-1 \* var\(--bleed-out\)\)/);
});

/* ── 主視覺 · 分割 ───────────────────────────────────────────────────── */

test("the split hero is a narrowed value and does not claim the photo is its background", () => {
  const src = readCode(HERO);
  assert.match(
    src,
    /const heroLayout = config\.hero_layout === "split" \? "split" : "overlay"/,
    "hero_layout is no longer narrowed to the two the stylesheet draws",
  );
  /* `has-hero-image` means "the photograph IS the background". Every rule hung
     off it — cover sizing, a 78vh min-height, white copy, the centred overlay
     treatment — is written for a hero the words sit on top of. On /brand it
     turns the h1 white, which on cream is invisible. */
  const split = src.slice(src.indexOf('if (heroLayout === "split")'), src.indexOf("return (\n    <section"));
  assert.ok(split.length > 0, "the split branch is gone — re-anchor this test");
  assert.doesNotMatch(split, /has-hero-image/, "the split hero claims the photograph is its background");
  assert.match(split, /page-hero--split/, "the split hero carries no class of its own");
  // The picture is decorative: the heading beside it names the page.
  assert.match(split, /<img src=\{image\} alt="" \/>/, "the split hero's photograph is announced twice");
});

test("the split hero's rules are last in the file and reach (0,2,0)", () => {
  /* `.page-hero` has no base rule; a hero is dressed by the page class it is
     given, and `.content-index-brand .content-index-hero` sets a 640px
     min-height, centres its text and italicises its paragraph at (0,2,0) and
     (0,3,1). Ties go to whoever is later, so BOTH the doubled class and the
     position are load-bearing. */
  const idx = CSS.indexOf(".page-hero--split.page-hero--split");
  assert.ok(idx > 0, "the split hero rules are gone, or no longer double the class to raise specificity");
  const after = CSS.slice(idx);
  assert.doesNotMatch(
    after,
    /\.content-index-hero\s*\{/,
    "a .content-index-hero rule now sits after the split hero's, so the ties it depends on flip",
  );
  const root = ruleFor(".page-hero--split.page-hero--split");
  assert.ok(root, "the split hero's own rule is gone");
  assert.match(root.body, /text-align:\s*left/, "the split hero centres its copy again");
  assert.match(root.body, /background:\s*none/, "the split hero kept a page's overlay background");
});

test("a hero title that wraps has room to wrap into", () => {
  /* The overlay hero's title is one short line and is set as a display lockup:
     `.content-index-brand .content-index-hero h1` gives it `line-height: .84`
     and `-0.055em` of tracking. Split, the title is a sentence that wraps, and
     0.84 puts each line 16% INSIDE the one above it. Measured live at 1001: a
     60.7px title on a 51.0px line, the second line overlapping the first by
     10px. Negative tracking is a Latin display device; on CJK at that size the
     glyphs touch.

     The line-height still defers to the site's own setting — pinning it flat
     would take 標題行高 away from this hero alone. */
  const h1 = ruleFor(".page-hero--split.page-hero--split .page-hero-split-copy h1");
  assert.ok(h1, "the split hero no longer overrides the display lockup its title inherits");
  assert.match(
    h1.body,
    /line-height:\s*var\(--type-h1-line,\s*1\.2[0-9]?\)/,
    "the split hero's title is back on a line-height tuned for one short line",
  );
  assert.match(h1.body, /letter-spacing:\s*normal/, "the split hero's title kept its negative tracking");
});

test("the reading measure caps the paragraph, not the title", () => {
  /* 46ch is a body measure, and it sat on the whole copy column, so it capped
     the title too: at 1440 the column is ~460px wide and 46ch cut that to 410,
     which set the 16-character zh title on FOUR lines with the last one a
     single character and a full stop. The paragraph is the thing that has a
     reading length; the title wants the column. */
  const copy = ruleFor(".page-hero--split.page-hero--split .page-hero-split-copy");
  assert.ok(copy, "the split hero's copy column rule is gone — re-anchor this test");
  assert.doesNotMatch(copy.body, /max-width/, "a measure is back on the column, where it squeezes the title too");

  const p = ruleFor(".page-hero--split.page-hero--split .page-hero-split-copy p");
  assert.ok(p, "the split hero's paragraph rule is gone — re-anchor this test");
  assert.match(p.body, /max-width: *46ch/, "the subtitle lost its reading measure");

  const title = ruleFor(".page-hero--split.page-hero--split .page-hero-split-copy h1");
  assert.match(title.body, /text-wrap: *balance/, "the title fills instead of balancing, which is what left the orphan");
});

test("the split hero bleeds on the same one figure the rows do", () => {
  const media = ruleFor(".page-hero--split.page-hero--split .page-hero-split-media");
  assert.ok(media, "the split hero's picture no longer bleeds");
  assert.match(
    media.body,
    /margin-left:\s*calc\(-1 \* var\(--bleed-out\)\)/,
    "the split hero's picture no longer reaches the window",
  );
});

test("the bleed distance is declared once, and counts both gutters", () => {
  /* One declaration, two layouts. It cannot live at :root: a var() inside a
     custom property is substituted on the element that DECLARES it, so --gutter
     would freeze at the site value and 左右留白 would stop moving a block's
     bleed along with its inset.

     Two gutters, because <main> pays one and the section pays another inside
     it. Counting one left a 28px sliver of page down both sides of every
     bleeding photograph on a phone: measured at 375, the section box runs
     28..347 and its content 56..319, so the distance from a stacked cell to the
     window is 56, not 28. */
  const decl = RULES.filter((r) => /--bleed-out\s*:/.test(r.body));
  assert.equal(decl.length, 1, `the bleed distance is declared in ${decl.length} places; it is one figure`);
  assert.deepEqual(
    splitSelectorList(decl[0].selector)
      .map((x) => x.trim())
      .sort(),
    [".alternating-section.is-bleed", ".page-hero--split.page-hero--split"].sort(),
    "the two bleeding layouts no longer share the one declaration",
  );
  assert.match(
    decl[0].body,
    /2 \* var\(--gutter\)\s*\+\s*max\(\(100vw - 2 \* var\(--gutter\) - var\(--block-measure, 1200px\)\) \/ 2, 0px\)/,
    "the bleed distance stopped counting both gutters, or stopped stopping at the measure",
  );
  /* After the split hero's own rules. Those win their ties on position, and a
     hero selector appearing earlier moves the index the test above measures
     from — which is the only reason this declaration sits at the end. */
  assert.ok(
    CSS.indexOf("--bleed-out:") > CSS.lastIndexOf(".page-hero--split.page-hero--split .page-hero-split-copy"),
    "the declaration moved above the split hero's own rules, where it breaks their position",
  );
});

test("alternating rows mirror, tracks and all", () => {
  /* --img-left swaps the ORDER of the two cells and not the two track sizes, so
     the copy took the 1.15fr track and the picture took the 0.85fr one:
     measured at 1430, copy 412 / picture 557 on rows 01 and 03 against copy 557
     / picture 412 on row 02. One row in three read as a smaller photograph with
     a looser paragraph beside it. */
  const two = RULES.filter(
    (r) => /min-width: 821px/.test(r.atRule) && /grid-template-columns/.test(r.body) && r.selector.includes("is-bleed"),
  );
  assert.equal(two.length, 2, `the bleed row's columns are set in ${two.length} rules, not 2`);
  const left = two.find((r) => r.selector.includes("--img-left"));
  const base = two.find((r) => !r.selector.includes("--img-left"));
  assert.ok(left && base, "neither rule targets the img-left rows — re-anchor this test");
  const cols = (body: string) => (body.match(/grid-template-columns:\s*([^;]+)/) || [])[1]?.trim();
  const tracks = cols(base.body);
  assert.ok(tracks, "the bleed row no longer sets its columns");
  assert.equal(
    cols(left.body),
    tracks.split(/\s+/).reverse().join(" "),
    "the img-left rows no longer mirror the tracks, only the order",
  );
});

/* ── the controls behind both ────────────────────────────────────────── */

test("both layouts are reachable from the CMS and write the keys the renderers read", () => {
  const forms = readCode("app/admin/modules/blockForms.tsx");
  /* From the row list to the end of the config form. The per-row fields moved
     into AlternatingRows when the panel was redesigned, so a slice that stopped
     at the next `export function` stopped containing them — and this test went
     red while both controls still worked. */
  const at = forms.indexOf("function AlternatingRows");
  const end = forms.indexOf("export function", forms.indexOf("export function AlternatingConfigForm") + 10);
  assert.ok(at > 0 && end > at, "the 圖文交錯 panel is gone — re-anchor this test");
  const form = forms.slice(at, end);
  assert.match(form, /layout: v === "bleed" \? "bleed" : undefined/, "the 版型 control no longer writes config.layout");
  assert.match(form, /setVal\(x, "eyebrow", editLocale/, "the per-row label has no field in the editor");

  const editor = readCode("app/admin/(dashboard)/sites/[id]/pages/[pageKey]/PropertyBlockEditor.tsx");
  assert.match(editor, /name="_hero_layout"/, "the hero layout never reaches the form post");
  assert.match(editor, /setHeroLayout\("?/, "the hero layout control is gone");

  /* The save action is a full replace and names every hero key explicitly, so a
     key it does not name is a control that saves and vanishes. */
  const action = readCode("app/admin/modules/propertyPagesActions.ts");
  assert.match(action, /rawHeroLayout === "split" \? "split" : ""/, "the stored hero layout is no longer allow-listed");
  assert.match(action, /hero_layout: heroLayout/, "the hero layout is not persisted by the page save");
});

/* ── the panel ───────────────────────────────────────────────────────── */

test("the panel counts rows the way the page counts them", () => {
  /* The panel shows each row's number and which side its picture lands on, and
     both are counted AFTER BlockAlternating drops the rows with nothing in them.
     An empty row in the middle therefore renumbers everything below it. Two
     filters that disagreed would put 03 in the panel and 02 on the page, with
     nothing to say which one was lying — so this executes the editor's filter
     against the cases the renderer's own covers. */
  assert.equal(altRowRenders({}), false, "a blank row is counted");
  assert.equal(altRowRenders({ image: "/a.jpg" }), true, "a picture on its own no longer renders");
  assert.equal(altRowRenders({ eyebrow: { zh: "設計" } }), true, "a row with only a label is dropped");
  /* cfgT falls back across locales, so a row written only in English renders on
     the Chinese page too — the panel has to look in both slots or it numbers
     that row out of the run. */
  assert.equal(altRowRenders({ title: { en: "Only English" } }), true, "a row written in one language only is dropped");
  assert.equal(altRowRenders({ title: { zh: "" } }), false, "an emptied field counts as content");

  const src = readCode(ALT);
  assert.match(
    src,
    /\.filter\(\(item\) => item\.image \|\| item\.title \|\| item\.body \|\| item\.eyebrow\)/,
    "the renderer's filter moved; altRowRenders has to move with it",
  );
  /* And the side is still derived from the position, which is what makes the
     panel's badge safe to draw from the same number. */
  assert.match(src, /const imgLeft = flip \? i % 2 === 0 : i % 2 === 1/, "the picture's side is no longer derived from the row's position");
});

test("reordering carries the open row with it", () => {
  /* The open row is tracked by index and a reorder moves the rows out from under
     it: untracked, dragging row 3 to the top leaves the panel open on whichever
     row lands in slot 3, and the next keystroke edits a different row's words
     with nothing on screen to say so. */
  assert.equal(altReindex(2, 2, 0), 0, "the row being moved does not take the open panel with it");
  assert.equal(altReindex(0, 2, 0), 1, "a row the move pushed down did not shift");
  assert.equal(altReindex(1, 2, 0), 2, "a row the move pushed down did not shift");
  assert.equal(altReindex(3, 2, 0), 3, "a row outside the moved range shifted anyway");
  assert.equal(altReindex(0, 0, 2), 2, "the row being moved down does not take the open panel with it");
  assert.equal(altReindex(1, 0, 2), 0, "a row the move pulled up did not shift");
  assert.equal(altReindex(2, 0, 2), 1, "a row the move pulled up did not shift");
  assert.equal(altReindex(null, 0, 2), null, "a closed panel opened itself on a reorder");
});

test("a row can be reordered without a mouse, and the panel says which side it lands on", () => {
  const forms = readCode("app/admin/modules/blockForms.tsx");
  const at = forms.indexOf("function AlternatingRows");
  const panel = forms.slice(at, forms.indexOf("export function AlternatingConfigForm"));
  assert.ok(at > 0 && panel.length > 200, "the 圖文交錯 row panel is gone — re-anchor this test");

  /* HTML5 drag and drop never fires on a touch screen, so on a phone or tablet
     the grip alone means the rows cannot be reordered at all. The block list has
     carried this pair all along; the rows take the same one. */
  assert.match(panel, /moveTo\(i, i - 1\)/, "上移 is gone, and the grip is the only way to reorder");
  assert.match(panel, /moveTo\(i, i \+ 1\)/, "下移 is gone, and the grip is the only way to reorder");
  assert.match(panel, /draggable/, "the rows can no longer be dragged");
  /* On the grip, never on the row: on the row it swallows every text selection
     inside the fields. */
  const grip = panel.slice(panel.indexOf("hpb-handle"), panel.indexOf("hpb-handle") + 400);
  assert.match(grip, /draggable/, "draggable moved off the grip");

  /* The summary is the whole point of the redesign: a collapsed row has to say
     what it holds and where it lands. */
  assert.match(panel, /hpb-altrow__num/, "the row's number is gone from its summary");
  /* The exact className, closing quote and all. Written loosely, each of these
     also matched the neighbour that MODIFIES it — hpb-altrow__thumb is-none is
     the empty placeholder and hpb-altrow__side is-muted is the badge an empty
     row gets — so deleting the real thumbnail and the real side badge left both
     assertions green. */
  assert.match(panel, /className="hpb-altrow__thumb"/, "the row's picture is gone from its summary");
  assert.match(panel, /className="hpb-altrow__side">/, "the row no longer says which side its picture lands on");
  assert.match(panel, /sideOf\(n as number\)/, "the side badge stopped being derived from the row position");
  assert.ok(/圖左/.test(panel) && /圖右/.test(panel), "the side badge no longer names a side");
  assert.match(panel, /aria-expanded=\{open\}/, "the collapsed row does not announce that it opens");
});

test("the layout picker draws the two layouts, and keeps its radiogroup", () => {
  const forms = readCode("app/admin/modules/blockForms.tsx");
  const at = forms.indexOf("export function AlternatingConfigForm");
  const form = forms.slice(at, forms.indexOf("export function", at + 10));
  assert.match(form, /className="hpb-altpick"/, "the 版型 control is back to two words");
  assert.match(form, /hpb-altpick__fig/, "the layout figures are gone");
  /* The figure is the control; the label is still the accessible name. Losing
     either the roles or the arrow keys would make the picture a downgrade. */
  assert.match(form, /role="radiogroup"/, "the layout picker lost its radiogroup role");
  assert.match(form, /onKeyDown=\{radioGroupKeys\}/, "the layout picker lost its arrow keys");
  assert.match(form, /aria-checked=\{layout === v\}/, "the layout picker no longer announces which option is set");
  assert.match(form, /aria-hidden="true"/, "the decorative figure is read out as content");

  const css = readStyles("app/globals.css");
  /* The one difference between the two figures is where the photograph's edge
     lands, so that is the declaration worth pinning. */
  assert.match(css, /\.hpb-altpick__fig\.is-bleed \.hpb-altpick__photo \{[^}]*margin-right: -7px/, "the 出血 figure no longer runs its photo off the edge");
  assert.match(css, /\.hpb-altpick__fig\.is-framed \.hpb-altpick__photo \{[^}]*border-radius/, "the 框內 figure no longer shows a framed photo");
});

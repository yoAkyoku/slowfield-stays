import assert from "node:assert/strict";
import test from "node:test";
import { readCode, readEditorSurface } from "./readCode";
import { evaluateExpression, jsxTags } from "./sourceEval";
import { blockStyle, isBlockBgColor, paintsOwnBackground } from "../app/modules/blockStyle.ts";

/**
 * Three block controls that saved without complaint and then did nothing.
 *
 * Found by rendering the real components through /admin/preview/block twice —
 * baseline against one changed key — and diffing the markup. Two of the three
 * came back byte-identical, which is the whole defect: the editor accepted the
 * value, the page never mentioned it, and there was no error to notice.
 *
 * The precedence and predicate tests below EXECUTE the code they are about
 * rather than grepping for it. `blockStyle` is imported and called; the two
 * editor guards are lifted out of their files with the TypeScript parser and
 * run against real configs. A substring search would pass just as happily
 * against a guard on the wrong key.
 */

const HOME_EDITOR = "app/admin/(dashboard)/homepage/HomepageBlockEditor.tsx";
const PAGE_EDITOR = "app/admin/(dashboard)/sites/[id]/pages/[pageKey]/PropertyBlockEditor.tsx";
const EDITORS: Array<[string, string]> = [
  ["homepage", HOME_EDITOR],
  ["site page", PAGE_EDITOR],
];

/* ── 1. 透明度 without a 背景顏色 ───────────────────────────────────────── */

test("blockStyle spends _bgOpacity only where there is a colour to spend it on", () => {
  /* The renderer's own behaviour, run rather than read. `_bgOpacity` is read
     inside the `if (bgColor)` branch and nowhere else, so on its own it reaches
     no declaration at all — measured on the preview route, a rich_text block
     with `_bgOpacity: 30` and no colour renders byte-identical to one without
     it, inline style attribute included (absent in both). */
  assert.equal(
    blockStyle({ _bgOpacity: 30 }),
    undefined,
    "a block whose only setting is 透明度 now produces a style — re-check whether the editor should still hide the slider",
  );
  const painted = blockStyle({ _bgColor: "#ff0000", _bgOpacity: 30 });
  assert.equal(painted?.backgroundColor, "rgba(255, 0, 0, 0.3)", "透明度 no longer reaches the background alpha");
  const opaque = blockStyle({ _bgColor: "#ff0000" });
  assert.equal(opaque?.backgroundColor, "rgba(255, 0, 0, 1)", "an unset 透明度 no longer means fully opaque");
});

/**
 * The guard a Field is offered under, lifted from the editor source.
 *
 * Anchored on the field's own label so it cannot pick up an unrelated guard,
 * and the extraction asserts it found something — a renamed label fails loudly
 * here instead of leaving a test that quietly checks nothing.
 */
function guardBefore(src: string, pattern: RegExp, what: string): string {
  const m = src.match(pattern);
  assert.ok(m, `${what}: the guard is gone, or the field it guards was renamed`);
  return m![1].replace(/\s+/g, " ").trim();
}

for (const [where, file] of EDITORS) {
  test(`the ${where} editor offers 透明度 only where the block has a colour to fade`, () => {
    const src = readEditorSurface(file);
    const expression = guardBefore(
      src,
      /\{([^\n]+?) && \(\n\s*<Field label=\{zh \? "透明度"/,
      `${file} 透明度`,
    );
    /* Compiled and called, not matched. A guard that reads the wrong key —
       `selected.config._bgOpacity`, say — is the same shape as the right one
       and a regex cannot tell them apart. */
    /* `paintsOwnBackground` joined this guard when the newsletter stopped being
       offered the generic 背景顏色 (see newsletterOwnBackground.test.mts). The
       configs below carry no type, so it answers false for every one of them and
       the assertions are unchanged — but it has to be IN SCOPE or the lifted
       expression throws before any of them run. */
    const gate = evaluateExpression(expression, ["selected", "isBlockBgColor", "paintsOwnBackground"]) as (
      ctx: Record<string, unknown>,
    ) => unknown;
    const shown = (config: Record<string, unknown>) =>
      Boolean(gate({ selected: { config }, isBlockBgColor, paintsOwnBackground }));

    assert.equal(shown({}), false, "透明度 is offered on a block with no background colour, where nothing reads it");
    assert.equal(shown({ _bgOpacity: 40 }), false, "a stored 透明度 alone brings the slider back with nothing to fade");
    assert.equal(shown({ _bgColor: "" }), false, "a cleared colour still offers the slider");
    assert.equal(shown({ _bgColor: "#ff0000" }), true, "透明度 is withheld from a block that HAS a background");
    assert.equal(shown({ _bgColor: "#f00" }), true, "the three-digit hex form no longer counts as a background");
    /* The strict half. blockStyle paints nothing for a colour hexToRgb rejects,
       so the slider would be inert beside it too. */
    assert.equal(shown({ _bgColor: "red" }), false, "透明度 is offered beside a colour the page will not paint");
  });

  test(`the ${where} editor says so when a typed 色碼 will not paint`, () => {
    const src = readEditorSurface(file);
    const expression = guardBefore(
      src,
      /\{([\s\S]{0,300}?) && \(\n\s*<p style=\{\{ color: "#b3261e"/,
      `${file} 色碼 warning`,
    );
    const gate = evaluateExpression(expression, ["selected", "isBlockBgColor"]) as (
      ctx: Record<string, unknown>,
    ) => unknown;
    const warns = (config: Record<string, unknown>) =>
      Boolean(gate({ selected: { config }, isBlockBgColor }));

    // Nothing typed is not an error — it is the default.
    assert.equal(warns({}), false, "the block warns about a colour nobody has typed");
    assert.equal(warns({ _bgColor: "" }), false, "clearing the box raises a warning");
    assert.equal(warns({ _bgColor: "   " }), false, "whitespace in the box raises a warning");
    assert.equal(warns({ _bgColor: "#ffffff" }), false, "a valid colour is reported as broken");
    assert.equal(warns({ _bgColor: "#fff" }), false, "the three-digit hex form is reported as broken");
    // The values that reach the page as nothing at all.
    for (const bad of ["red", "rgb(255,0,0)", "ffffff", "#ff00", "var(--accent)"]) {
      assert.equal(warns({ _bgColor: bad }), true, `「${bad}」 saves clean and paints nothing, with no warning`);
    }

    // The warning has to be reachable prose, not a bare red rule.
    const zh = src.includes("色碼要寫成 #ffffff 或 #fff");
    const en = src.includes("must be written as #ffffff or #fff");
    assert.ok(zh, `${file}: no Chinese guidance under the 色碼 box`);
    assert.ok(en, `${file}: no English guidance under the 色碼 box`);
  });
}

test("the editors' warning and the page's behaviour cannot drift apart", () => {
  /* isBlockBgColor is the editors' rule and blockStyle is the page's, and they
     have to be the same rule. Rather than pin the regex twice, run both: for
     every candidate the predicate must agree with whether blockStyle actually
     emitted a background. A second copy of the rule in the admin is exactly how
     the two would come apart. */
  const candidates = [
    "#fff", "#ffffff", "#FFF", "#AbC123", "#000000",
    "red", "rgb(255,0,0)", "rgba(0,0,0,.5)", "ffffff", "#ff00", "#fffffff",
    "", "   ", "#ffffff;background-image:url(x)", "var(--accent)", "transparent",
  ];
  const disagreed: string[] = [];
  for (const value of candidates) {
    const paints = Boolean(blockStyle({ _bgColor: value })?.backgroundColor);
    if (paints !== isBlockBgColor(value)) disagreed.push(`${JSON.stringify(value)} (page=${paints}, editor=${isBlockBgColor(value)})`);
  }
  assert.deepEqual(disagreed, [], `the editor's rule and the page's disagree about: ${disagreed.join(", ")}`);

  // Non-strings reach here from a hand-edited config; neither side may throw.
  for (const junk of [undefined, null, 42, {}, ["#fff"]]) {
    assert.equal(isBlockBgColor(junk), false, `${JSON.stringify(junk)} is accepted as a colour`);
  }
});

/* ── 2. 主視覺 標題 ─────────────────────────────────────────────────────── */

test("the hero title is not labelled with a slide it is not confined to", () => {
  /* Both hero renderers repeat the block's one title over the whole carousel,
     deliberately — the label said 顯示於第一張, which sends an author looking
     for the per-slide title fields that do not exist. */
  const src = readCode("app/admin/modules/blockForms.tsx");
  /* Scoped to this form's own body. readCode blanks ordinary block and line
     comments but NOT a JSX comment expression, so a file-wide search here also
     matched the note beside the fix explaining what the label used to say — the
     assertion failed against source that was already correct. */
  const form = src.slice(
    src.indexOf("export function HeroBannerConfigForm("),
    src.indexOf("export function RoomsConfigForm("),
  );
  assert.ok(form.length > 500, "HeroBannerConfigForm moved — re-anchor this slice");
  assert.ok(!form.includes("顯示於第一張"), "the hero title claims the first slide again");
  assert.ok(!form.includes("shown on first slide"), "the English hero title label claims the first slide again");
  assert.match(form, /label=\{zh \? "標題（每張都會顯示）" : "Title \(shown on every slide\)"\}/,
    "the hero title field lost the label that matches what the renderers do");
});

test("…because both hero renderers really do repeat it over every slide", () => {
  /* The half that makes the label true. If either renderer ever gives a slide
     its own title, this label becomes the wrong one and should go back. */

  // The villa hero copies the block's title onto each synthesised slide.
  const banner = readCode("app/modules/property/blocks/BlockHeroBanner.tsx");
  const slides = banner.slice(banner.indexOf("const slides = blockImages.map("), banner.indexOf("as unknown as Parameters"));
  assert.ok(slides.length > 40, "BlockHeroBanner no longer builds its slides from blockImages — re-anchor this slice");
  /* Whole lines, not substrings. `includes("title,")` is also satisfied by
     `subtitle,`, so a mutation that made the title first-slide-only
     (`title: i === 0 ? title : ""`) left this green — the assertion was reading
     the wrong property. A shorthand property is the entire line. */
  const lines = slides.split("\n").map((l) => l.trim());
  for (const key of ["title,", "subtitle,", "translations: trans,"]) {
    assert.ok(
      lines.includes(key),
      `a block-image slide no longer carries \`${key}\` unconditionally — the title is per-slide again, so the field's label should say so`,
    );
  }

  /* The group hero draws ONE heading for the whole carousel: the slides are
     backgrounds and .hero-content sits outside them. Counted from the parsed
     tree rather than the raw text, so a heading added inside the slide map is
     caught however the line is wrapped. */
  const tags = jsxTags("app/modules/home/HomeHeroCarousel.tsx");
  const headings = tags.filter((t) => t.tag === "h1");
  assert.equal(headings.length, 1, `HomeHeroCarousel draws ${headings.length} headings — a per-slide title would need a different label`);
  const slide = tags.find((t) => t.attrs.get("className")?.includes("hero-slide"));
  assert.ok(slide, "the hero slide element is gone");
  assert.ok(!slide!.fullText.includes("<h1"), "the group hero moved its heading inside the slide, so the title IS per-slide now");
});

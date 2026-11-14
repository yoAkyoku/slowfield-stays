import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readCode } from "./readCode";
import { blockStyle, blockWrapperAttrs } from "../app/modules/blockStyle.ts";
import { safeCssColor } from "../app/modules/fontPresets.ts";

/**
 * Everything blockStyle returns is interpolated into a style attribute on a
 * block an editor controls, so the allow-list matters as much as the layout.
 */

test("no styling settings means no style object at all", () => {
  assert.equal(blockStyle({}), undefined);
  assert.equal(blockStyle({ _padX: "not a number" }), undefined);
});

test("side spacing caps on a phone instead of eating the screen", () => {
  // A bare 180px applied on a 390px phone as well, leaving 186px of content:
  // headings broke every four characters. The editor's figure is a ceiling.
  const style = blockStyle({ _padX: 180 }) as Record<string, unknown>;
  assert.equal(style["--gutter"], "min(180px, max(20px, 8vw, calc((100vw - 320px) * 0.25)))");
});

test("a large figure is not swallowed by the phone cap on a desktop", () => {
  // The cap was `8vw` alone, which is 154px on a 1920px monitor — so a block
  // set to 280 rendered at 154 and every figure above roughly 190 did nothing
  // at all. The linear term reaches 280px at 1440px wide and keeps going, and
  // max() takes whichever cap is most generous.
  const style = blockStyle({ _padX: 280 }) as Record<string, unknown>;
  const gutter = String(style["--gutter"]);
  assert.match(gutter, /^min\(280px,/, "the editor's figure must be the first term");
  assert.ok(gutter.includes("100vw - 320px"), "no term that grows with the window");
  assert.ok(gutter.includes("8vw"), "the phone cap must still be one of the options");
});

test("side spacing replaces the page gutter rather than adding to it", () => {
  // Setting --gutter is the whole mechanism: .section already reads it, so the
  // number in the editor is the number on the page. Writing paddingLeft here
  // instead would stack on top of the site's own gutter.
  const style = blockStyle({ _padX: 88 }) as Record<string, unknown>;
  assert.equal(style.paddingLeft, undefined);
  assert.equal(style["--gutter"], "min(88px, max(20px, 8vw, calc((100vw - 320px) * 0.25)))");
});

test("a coloured block keeps its full-bleed padding and caps inside it", () => {
  const style = blockStyle({ _bgColor: "#283d34", _padX: 120 }) as Record<string, unknown>;
  assert.equal(style.width, "100vw");
  assert.equal(style.paddingLeft, "calc(50vw - 50% + min(120px, max(20px, 8vw, calc((100vw - 320px) * 0.25))))");
  assert.equal(style.paddingRight, style.paddingLeft);
  /* Zero, not "left alone". This used to assert `undefined`, on the reading that
     a full-bleed block pads itself and should not touch the gutter — but the
     inner .section reads --gutter and kept applying the site's, so the chosen
     figure was ADDED to it. The uncoloured branch below replaces the gutter, so
     one control behaved two different ways depending on whether a background had
     been picked, and the editor's number matched the page in only one of them.
     The module's own contract is "side spacing REPLACES the page's gutter";
     zeroing it here is what makes that true when a colour is set too. */
  assert.equal(style["--gutter"], "0px");
  assert.equal(style["--block-pad-x"], "0px");
});

test("out-of-range or non-numeric spacing is dropped, not passed through", () => {
  for (const bad of ["12px", "1e3", -1, 401, NaN, null, undefined, {}]) {
    const style = (blockStyle({ _padX: bad, _bgColor: "#283d34" }) ?? {}) as Record<string, unknown>;
    assert.equal(style["--gutter"], undefined, String(bad));
    // The full-bleed default survives; only the rejected figure is missing.
    assert.equal(style.paddingLeft, "calc(50vw - 50%)", String(bad));
  }
});

test("nothing an editor can type reaches the style attribute as a second declaration", () => {
  const style = blockStyle({
    _padX: 88,
    _padY: 40,
    _bgColor: "#fff",
    _fontSize: "18px",
    _lineHeight: "1.6",
    _textAlign: "center",
  }) as Record<string, unknown>;
  for (const [key, value] of Object.entries(style)) {
    assert.ok(!/[;{}]/.test(String(value)), `${key} carries a declaration separator`);
  }
});

test("a colour the editor could not produce is ignored rather than written as NaN", () => {
  const style = blockStyle({ _bgColor: "red; background-image: url(x)" }) as Record<string, unknown>;
  assert.equal(style.backgroundColor, undefined);
  assert.equal(style.width, undefined);
});

test("an unknown text alignment is dropped", () => {
  assert.equal(blockStyle({ _textAlign: "middle" }), undefined);
  const style = blockStyle({ _textAlign: "center" }) as Record<string, unknown>;
  assert.equal(style.textAlign, "center");
});

/* ── The wrapper element's id and classes ───────────────────────────────── */

test("a block with no styling still gets its bleed class", () => {
  assert.deepEqual(blockWrapperAttrs({}, undefined), {
    id: undefined,
    className: "property-block-contained",
  });
  assert.equal(blockWrapperAttrs({ full_bleed: true }, undefined).className, "property-block-full-bleed");
});

test("區塊標記 becomes the element id on every page that renders a block", () => {
  // The page renderer used to drop this while the property renderer kept it, so
  // an anchor set on a category-page block was saved, shown in the editor, and
  // did nothing when a nav item pointed at it.
  const attrs = blockWrapperAttrs({ anchor: "rooms" }, undefined);
  assert.equal(attrs.id, "rooms");
  assert.equal(attrs.className, "property-anchor property-block-contained");
});

test("an empty or non-string anchor is no anchor", () => {
  for (const bad of ["", undefined, null, 0, {}, ["rooms"]]) {
    assert.equal(blockWrapperAttrs({ anchor: bad }, undefined).id, undefined, String(bad));
  }
});

test("style flags become the classes the stylesheet keys on", () => {
  const style = blockStyle({ _fontSize: "18px", _lineHeight: "1.6", _textAlign: "center", _padX: 88 });
  const { className } = blockWrapperAttrs({ anchor: "faq", full_bleed: true }, style);
  for (const cls of [
    "property-anchor",
    "property-block-styled",
    "is-font-size",
    "is-line-height",
    "is-text-align",
    "property-block-full-bleed",
  ]) {
    assert.ok(className.split(" ").includes(cls), cls);
  }
});

test("a flag the block did not set does not become a class", () => {
  const style = blockStyle({ _padY: 40 });
  const { className } = blockWrapperAttrs({}, style);
  assert.ok(!className.includes("is-font-size"));
  assert.ok(!className.includes("is-text-align"));
  assert.ok(!className.includes("property-anchor"));
  assert.ok(className.includes("property-block-styled"));
});

/**
 * Every colour an editor can set must reach the page through safeCssColor.
 *
 * PageHero checked `typeof === "string"` and nothing else, while the villa
 * route ran safeCssColor over the SAME two config keys — the sanitiser was
 * dropped when the two heroes were consolidated into one component. Measured
 * output before the fix:
 *
 *   hero_title_color = "red;background-image:url(https://evil.example/x)"
 *   → <h1 style="color:red;background-image:url(https://evil.example/x)">
 *
 * Chrome honoured it: an outbound request on every page load, and
 * `position:fixed;inset:0` gives a full-viewport overlay on a real
 * slowfield.example URL. Reachable from the group origin because middleware
 * resolves the site from `?site=`, so this is not "an admin breaks their own
 * villa".
 */
test("no hero colour reaches a style attribute without the sanitiser", () => {
  const src = readCode("app/modules/content/PageHero.tsx");
  for (const key of ["hero_title_color", "hero_subtitle_color"]) {
    /* Every line that reads the key, not the first one. `find` meant a second,
       unsanitised read added below the sanitised one left this green — on an
       assertion whose whole job is to stop a stored value reaching a style
       attribute raw. */
    const lines = src.split("\n").filter((l) => l.includes(`config.${key}`));
    assert.ok(lines.length, `${key} is no longer read at all`);
    for (const line of lines) {
      assert.match(
        line,
        /safeCssColor\(/,
        `${key} is read without safeCssColor: ${line.trim()}`,
      );
    }
  }
  assert.match(src, /import \{ safeCssColor \}/, "safeCssColor is used without being imported");
});

test("that sanitiser refuses a colour carrying a second declaration", () => {
  // The property the test above protects. Asserted here by execution so a
  // future loosening of safeCssColor cannot pass the source check above.
  for (const payload of [
    "red;background-image:url(https://evil.example/x)",
    "blue;position:fixed;inset:0;z-index:99999",
    "red}body{background:red",
    "red !important",
  ]) {
    assert.equal(safeCssColor(payload), "", payload);
  }
  for (const good of ["#ffffff", "red", "rgb(1, 2, 3)"]) {
    assert.equal(safeCssColor(good), good, good);
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { layoutVars } from "../app/modules/fontPresets.ts";

/**
 * These values are interpolated into a style attribute on every page, so the
 * allow-list matters as much as the behaviour.
 */

test("named steps resolve to lengths", () => {
  const vars = layoutVars({ layout: { gutter: "narrow", section_gap: "roomy" } });
  assert.match(vars["--gutter"], /^clamp\(/);
  assert.match(vars["--section-y"], /^clamp\(/);
});

test("a plain pixel number is accepted, capped so it cannot eat a phone screen", () => {
  // The number is a desktop figure. Left as a bare px it applied on a 390px
  // phone too, where a 180px gutter left 186px of content and headings broke
  // every four characters — so it is emitted as a ceiling, not a constant.
  assert.equal(layoutVars({ layout: { gutter: "40" } })["--gutter"], "min(40px, max(20px, 8vw, calc((100vw - 320px) * 0.25)))");
});

test("the capped gutter is still built only from digits the allow-list passed", () => {
  // The min()/max() wrapper must not become a way to smuggle a second
  // declaration into the style attribute: only /^\d{1,3}$/ ever reaches it.
  const value = layoutVars({ layout: { gutter: "120" } })["--gutter"];
  assert.equal(value, "min(120px, max(20px, 8vw, calc((100vw - 320px) * 0.25)))");
  assert.ok(!/[;{}]/.test(value), "no declaration separators in the emitted value");
});

test("anything else is dropped rather than passed through", () => {
  for (const gutter of ["url(x)", "10px;background:red", "calc(1px*2)", "-5", "9999", "expression(1)"]) {
    assert.equal(layoutVars({ layout: { gutter } })["--gutter"], undefined, gutter);
  }
});

test("ui scale is clamped to a legible range", () => {
  assert.equal(layoutVars({ layout: { ui_scale: 1.2 } })["--ui-scale"], "1.2");
  for (const bad of [0.1, 3, "big", NaN, null]) {
    assert.equal(layoutVars({ layout: { ui_scale: bad } })["--ui-scale"], undefined, String(bad));
  }
});

test("no settings means no variables, so the stylesheet defaults stand", () => {
  assert.deepEqual(layoutVars(undefined), {});
  assert.deepEqual(layoutVars({}), {});
  assert.deepEqual(layoutVars({ layout: {} }), {});
});

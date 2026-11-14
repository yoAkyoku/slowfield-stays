import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode.mts";

test("home banner keeps its full-bleed image behind the copy", () => {
  const css = readCode("app/globals.css");
  const slide = css.match(/\.hero-slide\s*\{([^}]+)\}/)?.[1] ?? "";
  assert.match(slide, /background-size:\s*cover/);
  assert.doesNotMatch(slide, /scale\(/);
  assert.match(css, /\.hero\.hero-carousel\s*\{[^}]*margin-top:\s*calc\(-1 \* var\(--site-header-h/s);
  assert.doesNotMatch(css, /hero-complete-image/);
});

test("portrait home hero keeps copy over the image instead of stacking it below", () => {
  const css = readCode("app/globals.css");
  assert.match(css, /\.hero\s*\{[^}]*display:\s*grid/s);
  assert.doesNotMatch(css, /\.hero\.hero-carousel\s*\{\s*display:\s*flex;\s*flex-direction:\s*column/);
  assert.doesNotMatch(css, /\.site-header\.is-home\s*\{[^}]*background:\s*var\(--paper\);[^}]*color:\s*var\(--ink\)/s);
});

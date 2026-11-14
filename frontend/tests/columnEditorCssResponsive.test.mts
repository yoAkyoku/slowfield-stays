import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";
test("column ratios use a CSS variable without an inline grid override", () => {
  const src = readCode("app/admin/(dashboard)/cms/PageBlockEditor.tsx");
  assert.match(src, /"--pbe-column-tracks": items.map/);
  assert.doesNotMatch(src, /style=\{narrow \? undefined/);
});
test("the stylesheet owns wide ratios and mobile stacking", () => {
  const css = readCode("app/globals.css");
  assert.match(css, /grid-template-columns: var\(--pbe-column-tracks, 1fr\)/);
  assert.match(css, /\.pbe-columns-editor \{ grid-template-columns: 1fr; \}/);
});

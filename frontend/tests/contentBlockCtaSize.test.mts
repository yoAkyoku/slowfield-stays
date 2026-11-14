import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";
const css = readCode("app/globals.css");
const block = css.match(/\.content-block-cta \{([^}]+)\}/)?.[1] ?? "";
test("published content buttons have the same padded button shape as preview", () => {
  assert.match(block, /padding: 10px 24px/);
  assert.match(block, /border-radius: 6px/);
  assert.match(block, /font-size: var\(--r-cta-size, 13px\)/);
});
test("published content buttons retain a usable mobile target and wrap long labels", () => {
  assert.match(block, /min-height: 44px/);
  assert.match(block, /max-width: 100%/);
  assert.match(block, /overflow-wrap: anywhere/);
});

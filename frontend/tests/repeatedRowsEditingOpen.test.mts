import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";
const src = readCode("app/admin/modules/blockForms.tsx");
test("row content decides its initial expansion only once", () => {
  assert.match(src, /useState<boolean\[\]>\(\(\) => items.map\(\(item\) => !hasContent\(item\)\)\)/);
  assert.match(src, /collapsible \? open\[i\] : true/);
  assert.doesNotMatch(src, /open\[i\] \?\? !hasContent\(items\[i\]\)/);
});
test("new rows stay open while their first fields are filled", () => {
  assert.match(src, /\[\.\.\.open, true\], \{ kind: "add" \}/);
});
test("reordering carries the expansion state with each row", () => {
  assert.match(src, /\[nextOpen\[i\], nextOpen\[j\]\] = \[nextOpen\[j\], nextOpen\[i\]\]/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";
const src = readCode("app/admin/(dashboard)/inquiries/page.tsx");
test("legacy inbox kind is validated before filtering merged rows", () => {
  assert.match(src, /searchParams.kind === "booking" \|\| searchParams.kind === "inquiry"/);
  assert.match(src, /!kindFilter \|\| inquiry.kind === kindFilter/);
});
test("submitting other filters preserves the legacy inbox kind", () => {
  assert.match(src, /kindFilter && <input name="kind" type="hidden" value=\{kindFilter\}/);
});
test("the restricted inbox scope is visible and reset clears it", () => {
  assert.match(src, /目前僅顯示訂房請求/);
  assert.match(src, /const resetHref = "\/admin\/inquiries"/);
});

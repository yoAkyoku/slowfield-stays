import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";

test("renaming a managed search label preserves its stored value", () => {
  const source = readCode("app/admin/(dashboard)/sites/[id]/SearchOptionsField.tsx");
  assert.match(source, /const value = String\(raw\?\.value[\s\S]*localized\.zh/);
  assert.match(source, /value: r\.value\?\.trim\(\) \|\| r\.zh\.trim\(\)/);
  assert.doesNotMatch(source, /value: r\.zh\.trim\(\) \}\)/);
});

test("managed search options preserve independent Chinese and English labels", () => {
  const source = readCode("app/admin/(dashboard)/sites/[id]/SearchOptionsField.tsx");
  assert.match(source, /label:\s*\{\s*zh:\s*r\.zh\.trim\(\),\s*en:\s*r\.en\.trim\(\)\s*\}/);
  assert.doesNotMatch(source, /en:\s*\(r\.en\s*\|\|\s*r\.zh\)/);
  assert.match(source, /中文與英文為獨立顯示名稱/);
});

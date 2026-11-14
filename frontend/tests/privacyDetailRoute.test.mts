import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";
const src = readCode("app/(site)/privacy/[identifier]/page.tsx");
test("a privacy slug is resolved as a real article, not redirected by its name", () => {
  assert.doesNotMatch(src, /if \(params.identifier === CATEGORY\)/);
  assert.match(src, /resolvePage\(CATEGORY, params.identifier\)/);
});
test("only a resolved canonical mismatch triggers detail redirection", () => {
  assert.match(src, /if \(page.slug && requestedPath !== canonicalPath\)/);
  assert.match(src, /redirect\(canonicalPath\)/);
});
test("privacy details keep body block and text rendering", () => {
  assert.match(src, /<ContentBlockRenderer blocks=\{blocks\}/);
  assert.match(src, /paragraphs.map/);
});

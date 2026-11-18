import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";
const src = readCode("app/(site)/privacy/[identifier]/page.tsx");
// The canonical redirect and the body are shared by every CMS detail route.
const shared = readCode("app/modules/content/entryRoute.tsx");
test("a privacy slug is resolved as a real article, not redirected by its name", () => {
  assert.doesNotMatch(src, /if \(params.identifier === CATEGORY\)/);
  assert.match(src, /resolvePage\(CATEGORY, params.identifier\)/);
});
test("only a resolved canonical mismatch triggers detail redirection", () => {
  assert.match(src, /redirectToCanonical\(page, CATEGORY, params.identifier\)/);
  assert.match(shared, /if \(page.slug && requestedPath !== canonicalPath\)/);
  assert.match(shared, /redirect\(canonicalPath\)/);
});
test("privacy details keep body block and text rendering", () => {
  assert.match(src, /<EntryBody page=\{page\}/);
  assert.match(shared, /<ContentBlockRenderer blocks=\{blocks\}/);
  assert.match(shared, /paragraphs.map/);
});

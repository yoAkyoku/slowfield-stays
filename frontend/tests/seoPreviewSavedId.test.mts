import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";
test("saved pages without custom slugs preview their real ID URL", () => {
  const src = readCode("app/admin/modules/SeoPreview.tsx");
  assert.match(src, /slug \|\| \(pageId \? String\(pageId\) : "draft-id"\)/);
  assert.match(src, /\[defaults, origin, slugMode, pageId\]/);
});
test("the article editor supplies its persisted page ID to SEO preview", () => {
  const src = readCode("app/admin/(dashboard)/cms/PageFormEditor.tsx");
  assert.match(src, /slugMode="page"\s+pageId=\{page\?\.id\}/);
});

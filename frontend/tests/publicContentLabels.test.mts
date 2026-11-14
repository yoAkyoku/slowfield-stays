import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";
test("list card fallbacks use the localized section title rather than type codes", () => {
  const src = readCode("app/modules/content/ContentListPage.tsx");
  assert.match(src, /<span>\{copy.title\}<\/span>/);
  assert.match(src, /cardTagsT\(page, locale\).join\(" \/ "\) \|\| copy.title/);
  assert.doesNotMatch(src, /<span>\{page.content_type\}/);
});
test("privacy detail fallback is localized without changing CMS text", () => {
  const src = readCode("app/(site)/privacy/[identifier]/page.tsx");
  assert.match(src, /locale === "zh" \? "隱私政策" : "Privacy"/);
  assert.match(src, /const pageTitle = trs\(page, "title", locale\)/);
  assert.match(src, /const pageBody = trs\(page, "body", locale\)/);
});

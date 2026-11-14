import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";

test("content screens avoid the repeated route tabs", () => {
 for (const path of ["app/admin/(dashboard)/cms/page.tsx", "app/admin/(dashboard)/cms/categories/page.tsx", "app/admin/(dashboard)/cms/tags/page.tsx", "app/admin/(dashboard)/content-pages/page.tsx"]) {
  assert.doesNotMatch(readCode(path), /ContentManagementNav/);
 }
});
test("placements use a semantic table with scoped actions", () => {
 const page=readCode("app/admin/(dashboard)/content-pages/page.tsx");
 assert.match(page, /<table/); assert.match(page, /scope="row"/);
 assert.match(page, /articleCategories\(a\)\.some\(k=>selected.includes\(k\)\)/);
 assert.match(page, /site_users:read/);
 assert.doesNotMatch(page, /admin-task-queue/);
});
test("tag management removes duplicate card metrics and quick tasks", () => {
 const page=readCode("app/admin/(dashboard)/cms/tags/page.tsx");
 assert.match(page, /ContentTagEditModal/); assert.match(page, /<table/);
 assert.doesNotMatch(page, /content-tag-readiness-grid|quickFilters/);
});
test("article filter choices include every placement", () => {
 const page=readCode("app/admin/(dashboard)/cms/page.tsx");
 assert.match(page, /pages\.flatMap\(\(page\) => articleCategories\(page\)\)/);
});

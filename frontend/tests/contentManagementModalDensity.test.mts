import assert from "node:assert/strict";
import test from "node:test";

import { readCode } from "./readCode";

const TAG_MODALS = readCode("app/admin/(dashboard)/cms/tags/ContentTagModals.tsx");
const CATEGORY_MODAL = readCode("app/admin/(dashboard)/cms/categories/CategoryModal.tsx");
const LISTING_MODAL = readCode("app/admin/(dashboard)/content-pages/ListingCategoriesModal.tsx");
const CREATE_PAGE_MODAL = readCode("app/admin/(dashboard)/content-pages/CreateWebsitePageModal.tsx");
const USAGE_MODAL = readCode("app/admin/(dashboard)/cms/tags/TagUsageModal.tsx");

test("CMS edit modals keep the close control and one primary submit action", () => {
  /* Built on the kit <Dialog>: its header × is the close control, so each
     footer carries the one submit and no Cancel / Archive beside it. */
  for (const modal of [TAG_MODALS, CATEGORY_MODAL, LISTING_MODAL, CREATE_PAGE_MODAL]) {
    assert.match(modal, /<Dialog\b/);
    assert.doesNotMatch(modal, /(?:zh \? )?["'](?:取消|封存|Cancel|Archive)["']/);
  }
  assert.equal((TAG_MODALS.match(/type="submit"/g) ?? []).length, 2);
  for (const modal of [CATEGORY_MODAL, LISTING_MODAL, CREATE_PAGE_MODAL]) {
    assert.equal((modal.match(/type="submit"/g) ?? []).length, 1);
  }
  assert.match(TAG_MODALS, /name="status"/);
});

test("category and tag workspaces do not repeat the content-module navigation", () => {
  const categoriesPage = readCode("app/admin/(dashboard)/cms/categories/page.tsx");
  const tagsPage = readCode("app/admin/(dashboard)/cms/tags/page.tsx");

  assert.doesNotMatch(categoriesPage, /ContentManagementNav|content-management-nav/);
  assert.doesNotMatch(tagsPage, /ContentManagementNav|content-management-nav/);
});

test("tag usage opens an accessible dialog with a related-article list", () => {
  // The kit <Dialog> is the modal (named by its title via aria-labelledby, see kitDialog.mts).
  assert.match(USAGE_MODAL, /<Dialog\b/);
  assert.match(USAGE_MODAL, /aria-haspopup="dialog"/);
  const tagsPage = readCode("app/admin/(dashboard)/cms/tags/page.tsx");
  assert.match(tagsPage, /usage\.relatedArticles\.length \? <Card flush><ListRows>/);
  assert.match(tagsPage, /usage\.relatedArticles\.map/);
  assert.match(tagsPage, /topicArticleIds\.has\(page\.id\)/);
  assert.match(tagsPage, /cardArticleIds\.has\(page\.id\)/);
  assert.match(tagsPage, /Array\.from\(new Set\(\[page\.content_type/);
  assert.doesNotMatch(tagsPage, /tag-usage-detail/);
});

test("topic filtering and badges exclude card-only tag references", () => {
  const tagsPage = readCode("app/admin/(dashboard)/cms/tags/page.tsx");
  const usage = readCode("app/admin/modules/tagUsage.ts");

  assert.match(tagsPage, /usageFilter === "topics" \? usage\.topicArticles\.length > 0/);
  assert.match(tagsPage, /topicArticleIds\.size > 0/);
  assert.match(usage, /const topicArticles = activePages\.filter/);
  assert.match(usage, /const cardArticles = activePages\.filter/);
  assert.match(usage, /relatedArticles = Array\.from\(new Map/);
});

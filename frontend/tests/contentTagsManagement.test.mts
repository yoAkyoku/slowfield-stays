import assert from "node:assert/strict";
import test from "node:test";

import { readCode } from "./readCode";

test("content tag management is site-scoped and permission-gated", () => {
  const page = readCode("app/admin/(dashboard)/cms/tags/page.tsx");
  const api = readCode("app/admin/modules/adminApi.ts");
  const actions = readCode("app/admin/modules/cmsActions.ts");

  assert.match(page, /hasPermission\(profile\.permissions, "cms:read"\)/);
  assert.match(page, /hasPermission\(profile\.permissions, "cms:write"\)/);
  assert.match(page, /getAdminContentTags\(true\)/);
  assert.match(api, /export type AdminContentTag/);
  assert.match(api, /\/cms\/tags/);
  assert.match(actions, /\/cms\/tags/);
});

test("tag usage scans the full article catalogue and links collection locations by their actual permissions", () => {
  const page = readCode("app/admin/(dashboard)/cms/tags/page.tsx");
  const api = readCode("app/admin/modules/adminApi.ts");
  const pagination = readCode("app/admin/modules/adminPagePagination.ts");

  assert.match(api, /export const getAdminPagesAll = cache/);
  assert.match(api, /const pageSize = 500/);
  assert.match(api, /collectAllPages\(/);
  assert.match(pagination, /skip \+= batch\.length/);
  assert.match(page, /getAdminPagesAll\("active"\)/);
  assert.match(page, /siteId=\{currentSite\?\.id\}/);
  assert.match(page, /hasPermission\(profile\.permissions, "site_users:write"\)/);
  assert.match(page, /const actionLabel = canManageSitePages \?/);
  assert.match(page, /編輯「\$\{label\}」/);
  assert.match(page, /檢視「\$\{label\}」/);
  assert.doesNotMatch(page, /site_users:read"\) \? currentSite\?\.id/);
});

test("CMS editors can apply managed bilingual tags and keep custom labels", () => {
  const editor = readCode("app/admin/(dashboard)/cms/PageFormEditor.tsx");
  const pageForm = readCode("app/admin/(dashboard)/cms/PageForm.tsx");

  assert.match(pageForm, /contentTags\?: AdminContentTag\[\]/);
  assert.match(editor, /name="translations"/);
  assert.match(editor, /name="tags"/);
  assert.match(editor, /selectedTagsFor\("zh"\)/);
  assert.match(editor, /selectedTagsFor\("en"\)/);
  assert.match(editor, /contentVocabulary\[editLocale\]\.card/);
  assert.match(editor, /card_tags: cardTagsFor\("zh"\)/);
  assert.match(editor, /card_tags: cardTagsFor\("en"\)/);
  assert.match(editor, /contentTags.*map|\(contentTags \?\? \[\]\)\.map/s);
  assert.match(editor, /新增自訂標籤|Add a custom tag/);
});

test("homepage content collections use the same localized tags as CMS pages", () => {
  const picker = readCode("app/admin/modules/blockForms.tsx");
  const articles = readCode("app/modules/home/blocks/BlockArticles.tsx");
  const stays = readCode("app/modules/home/blocks/BlockStays.tsx");

  assert.match(picker, /內容過濾標籤，可複選|Entry filter tags, multi-select/);
  assert.match(picker, /filter_tags: tags/);
  assert.match(articles, /hasContentFilterTag\(page\.tags, filterTags\).*hasContentFilterTag\(tagsT\(page, locale\), filterTags\)/s);
  assert.match(stays, /hasContentFilterTag\(page\.tags, filterTags\).*hasContentFilterTag\(tagsT\(page, locale\), filterTags\)/s);
});

test("new collections defer card labels to each article", () => {
  const picker = readCode("app/admin/modules/blockForms.tsx");
  const stays = readCode("app/modules/home/blocks/BlockStays.tsx");

  assert.match(
    picker,
    /卡片顯示標籤由每篇文章決定/,
    "the collection should direct the editor to article-owned labels",
  );
  assert.match(
    picker,
    /filter_by: filterBy/,
    "changing sources must preserve the chosen visitor filter mode",
  );
  assert.match(
    stays,
    /if \(c\.filter_by === "category" \|\| c\.filter_by === "tags"\) return cardTagsT\(page, locale\)/,
    "new collections must use article card labels independently of filter mode",
  );
});

test("public cards use article-level card labels and preserve the legacy fallback", () => {
  const helper = readCode("app/modules/tr.ts");
  const articles = readCode("app/modules/home/blocks/BlockArticles.tsx");
  const stays = readCode("app/modules/home/blocks/BlockStays.tsx");

  assert.match(helper, /export function cardTagsT/);
  assert.match(helper, /return tagsT\(item, locale\)/);
  assert.match(articles, /cardTagsT\(article, locale\)/);
  assert.match(stays, /cardTagsT\(page, locale\)/);
});

test("multi-source category selections remain visible after switching locale", () => {
  const stays = readCode("app/modules/home/blocks/BlockStays.tsx");

  assert.match(stays, /otherLocaleCatalogue = contentTypeCatalogue/);
  assert.match(stays, /aliases\.includes\(tagKey\(picked\)\)/);
  assert.match(stays, /const visibleCategoryTags =/);
});

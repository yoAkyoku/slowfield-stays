import assert from "node:assert/strict";
import test from "node:test";
import { blockPurpose, contentVocabulary } from "../app/admin/modules/contentVocabulary.ts";
import { tagUsage } from "../app/admin/modules/tagUsage.ts";
import type { AdminContentTag, AdminPage, AdminSite } from "../app/admin/modules/adminApi.ts";

// Hand-authored fixtures: no production records or database connection.
const tag = {id: 1, slug: "family", name_zh: "親子", name_en: "Family", status: "active", sort_order: 0, usage_count: 1} as AdminContentTag;
const pages = [
  {id: 1, title: "測試文章", slug: "sample", status: "published", content_type: "news", categories: ["news", "experience"], tags: [" FAMILY "], translations: {zh: {card_tags: "親子"}}},
  {id: 2, title: "已刪除", status: "published", tags: ["親子"], deleted_at: "2026-01-01"},
  {id: 3, title: "只有卡片標籤", slug: "card-only", status: "draft", content_type: "story", categories: ["story"], tags: [], translations: {zh: {card_tags: "親子"}}},
] as AdminPage[];
const site = {id: 1, parent_site_id: null, settings: {pages: {news: {page_type: "cms_list", label: {zh: "最新消息", en: "News"}, blocks: [{type: "stays", config: {source: "news", filter_tags: ["family"]}}]}}}} as unknown as AdminSite;
test("block purpose uses authored bilingual title and respects fallback", () => {
  assert.equal(blockPurpose("stays", {headline: {zh: "最新\n消息", en: "News"}}, true, "內容集合"), "最新 消息");
  assert.equal(blockPurpose("stays", {headline: {zh: "", en: "News"}}, false, "Collection"), "News");
  assert.equal(blockPurpose("stays", {source: "stays"}, true, "內容集合"), "慢域旅宿");
});
test("classification and card vocabulary remain distinct", () => {
  assert.equal(new Set(Object.values(contentVocabulary.zh)).size, 6);
});
test("tag usage matches bilingual aliases, excludes deleted records and preserves placements", () => {
  const usage = tagUsage(tag, pages, site);
  assert.deepEqual(usage.topicArticles.map(p => p.id), [1]);
  assert.deepEqual(usage.cardArticles.map(p => p.id), [1, 3]);
  assert.deepEqual(usage.relatedArticles.map(p => p.id), [1, 3]);
  assert.deepEqual(usage.placements, ["news", "experience"]);
  assert.deepEqual(usage.filterBlocks, ["news"]);
});

test("card-only tag use is not treated as a topic or category placement", () => {
  const usage = tagUsage(tag, [pages[2]], site);
  assert.deepEqual(usage.topicArticles, []);
  assert.deepEqual(usage.cardArticles.map((page) => page.id), [3]);
  assert.deepEqual(usage.relatedArticles.map((page) => page.id), [3]);
  assert.deepEqual(usage.placements, []);
});
test("unused vocabulary is never assigned inferred placements", () => {
  const usage = tagUsage({...tag, slug: "unused", name_zh: "未使用", name_en: "Unused"}, pages, site);
  assert.equal(usage.topicArticles.length, 0);
  assert.equal(usage.filterBlocks.length, 0);
});

test("shared vocabulary names are flagged for review", () => {
  const usage = tagUsage(tag,pages,site,true,[tag,{...tag,id:2,slug:"another-family"}]);
  assert.equal(usage.needsReview,true);
});

test("rich text section purpose uses its authored heading", () => { assert.equal(blockPurpose("rich_text",{heading:{zh:"品牌故事"}},true,"圖文段落"),"品牌故事"); });

import { flashMessage } from "../app/admin/modules/flashMessage.ts";
test("action notices use plain language and retain unknown details",()=>{assert.equal(flashMessage("OK",true),"變更已完成。");assert.equal(flashMessage("Tag saved",true),"標籤已儲存，使用位置已同步。");assert.equal(flashMessage("API detail",true),"API detail");});

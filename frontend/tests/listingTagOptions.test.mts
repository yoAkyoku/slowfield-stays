import assert from "node:assert/strict";
import test from "node:test";
import { listingArticles, matchingTagArticles, listingTagOptions } from "../app/admin/modules/listingTagOptions.ts";

const article = (id: number, overrides = {}) => ({ id, title: `Article ${id}`, content_type: "news", status: "published", tags: ["Family"], ...overrides });

test("custom listing URL resolves selected categories including secondary membership", () => {
  const pages = [article(1), article(2, { content_type: "journal", categories: ["news"] }), article(3, { content_type: "dining" })];
  assert.deepEqual(listingArticles(pages, { article_categories: ["news"] }, "updates").map(p => p.id), [1, 2]);
  assert.deepEqual(listingArticles(pages, { article_categories: [] }, "news"), []);
});

test("counts exclude drafts and deleted articles and deduplicate multiple sources", () => {
  const p = article(1, { categories: ["journal"] });
  const result = listingArticles([p, p, article(2, { status: "draft" }), article(3, { deleted_at: "2026-10-17" })], { article_categories: ["news", "journal"] }, "updates");
  assert.deepEqual(result.map(p => p.id), [1]);
});

test("legacy listing sources remain supported", () => {
  assert.equal(listingArticles([article(1)], {}, "news").length, 1);
  assert.equal(listingArticles([article(1)], { content_type: "journal", extra_content_types: ["news"] }, "updates").length, 1);
});

test("matching shares public locale fallback and normalizes case and whitespace", () => {
  const pages = [article(1, { translations: { zh: { tags: "親子" }, en: { tags: " Family " } } }), article(2)];
  assert.deepEqual(matchingTagArticles(pages, "family", "en").map(p => p.id), [1, 2]);
  assert.deepEqual(matchingTagArticles(pages, "親子", "zh").map(p => p.id), [1]);
  assert.deepEqual(matchingTagArticles(pages, "", "en"), []);
  assert.deepEqual(listingTagOptions(pages).sort((a,b) => a.zh.localeCompare(b.zh, "en")), [{ zh: "Family", en: "Family" }, { zh: "親子", en: "Family" }]);
});

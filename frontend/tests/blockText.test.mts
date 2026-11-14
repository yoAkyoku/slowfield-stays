import assert from "node:assert/strict";
import test from "node:test";
import { extractText, resolveText } from "../app/admin/modules/blockText.ts";

/**
 * Run with: npm test  (node --test, no test framework dependency)
 *
 * The plain-text `body` column mirrored from an article's blocks.
 *
 * It is not decoration: the public API, the search index and the SEO
 * description all fall back to it, and it is stored per locale. It was derived
 * with no locale at all, which pinned it to Chinese — so an English page was
 * saved with a Chinese `body`, and because the canonical columns were filed
 * under the *viewer's* admin language rather than the site's, that Chinese
 * landed in `translations.en.body` and went out to English readers. Nothing in
 * the editor looked wrong; the English tab showed the English blocks.
 */

const en = (text: unknown) => ({ id: "1", type: "paragraph" as const, text });

test("a bilingual field is read in the locale asked for", () => {
  assert.equal(resolveText({ zh: "中文", en: "English" }, "en"), "English");
  assert.equal(resolveText({ zh: "中文", en: "English" }, "zh"), "中文");
});

test("a missing locale falls back rather than resolving to nothing", () => {
  assert.equal(resolveText({ zh: "中文" }, "en"), "中文");
  assert.equal(resolveText({}, "en"), "");
});

test("a legacy plain string is the value itself", () => {
  assert.equal(resolveText("plain", "en"), "plain");
  assert.equal(resolveText(undefined, "en"), "");
});

/* ── the mirror ── */

test("the mirror is built in the locale it is asked for, not always Chinese", () => {
  const blocks = [
    { id: "1", type: "heading", text: { zh: "中文標題", en: "English Heading" } },
    { id: "2", type: "paragraph", text: { zh: "中文段落", en: "English paragraph" } },
  ] as never;

  assert.deepEqual(extractText(blocks, "en"), ["English Heading", "English paragraph"]);
  assert.deepEqual(extractText(blocks, "zh"), ["中文標題", "中文段落"]);
});

test("markup is stripped, because this column is plain text", () => {
  assert.deepEqual(extractText([en({ en: "<p>Hello <b>there</b></p>" })] as never, "en"), ["Hello there"]);
});

/**
 * Copy taken off the page must not survive in the mirror: `body` reaches the
 * meta description and the search index, so a hidden block would keep being
 * published by a route nobody is looking at.
 */
test("blocks the editor hid are left out", () => {
  const blocks = [
    { id: "1", type: "paragraph", text: { en: "visible" } },
    { id: "2", type: "paragraph", enabled: false, text: { en: "hidden" } },
  ] as never;
  assert.deepEqual(extractText(blocks, "en"), ["visible"]);
});

test("text nested inside columns is included, in the same locale", () => {
  const blocks = [{
    id: "1",
    type: "columns",
    items: [
      { flex: 5, blocks: [{ id: "a", type: "paragraph", text: { zh: "左", en: "left" } }] },
      { flex: 5, blocks: [{ id: "b", type: "paragraph", text: { zh: "右", en: "right" } }] },
    ],
  }] as never;
  assert.deepEqual(extractText(blocks, "en"), ["left", "right"]);
  assert.deepEqual(extractText(blocks, "zh"), ["左", "右"]);
});

test("blocks that carry no prose contribute nothing", () => {
  const blocks = [
    { id: "1", type: "image", url: "/a.jpg", alt: { en: "a photo" } },
    { id: "2", type: "spacer" },
    { id: "3", type: "paragraph", text: { en: "   " } },
  ] as never;
  assert.deepEqual(extractText(blocks, "en"), []);
});

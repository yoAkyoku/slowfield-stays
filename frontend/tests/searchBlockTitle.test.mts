import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readCode } from "./readCode";
import { clearableT, eyebrowT } from "../app/modules/tr.ts";

/**
 * Emptying a field in the editor has to empty it on the page.
 *
 * cfgT treats "" as missing and returns the built-in default, so a block whose
 * 標題 had been cleared kept showing 依你想要的旅行方式探索 and the field looked
 * broken (客戶: 怎麼清空文本還有這句?). clearableT distinguishes "never set"
 * from "set to empty"; only the first takes the default.
 */

const FALLBACK = "依你想要的旅行方式探索";

test("a key that was never set takes the default", () => {
  assert.equal(clearableT({}, "title", "zh", FALLBACK), FALLBACK);
  assert.equal(clearableT(undefined, "title", "zh", FALLBACK), FALLBACK);
});

test("a key explicitly set to empty stays empty", () => {
  assert.equal(clearableT({ title: "" }, "title", "zh", FALLBACK), "");
  assert.equal(clearableT({ title: { zh: "", en: "" } }, "title", "zh", FALLBACK), "");
});

test("clearing one locale does not borrow the other's text", () => {
  // The bug this rule exists for: emptying Chinese while English still held a
  // value put the English line on the Chinese page.
  assert.equal(clearableT({ title: { zh: "", en: "Find a stay" } }, "title", "zh", FALLBACK), "");
  assert.equal(clearableT({ title: { en: "", zh: "探索" } }, "title", "en", FALLBACK), "");
});

test("a locale absent altogether still borrows the other", () => {
  assert.equal(clearableT({ title: { zh: "探索" } }, "title", "en", FALLBACK), "探索");
});

test("eyebrowT keeps behaving exactly as before", () => {
  assert.equal(eyebrowT({ eyebrow: "" }, "zh", "X"), "");
  assert.equal(eyebrowT({}, "zh", "X"), "X");
  assert.equal(eyebrowT({ eyebrow: { zh: "", en: "E" } }, "zh", "X"), "");
});

test("the search block uses it and renders no empty heading", () => {
  const src = readCode("app/modules/home/blocks/BlockSearchBar.tsx");
  assert.match(src, /clearableT\(c, "title"/, "the block still resolves its title through cfgT");
  // An empty <h2> would still hold its line-height and margin.
  assert.match(src, /\{title && \(/, "an emptied title still renders an empty heading box");
});

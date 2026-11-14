import assert from "node:assert/strict";
import test from "node:test";
import { getVal, legacyValueLocale, setVal } from "../app/admin/modules/localizedValue.ts";

/**
 * Run with: npm test  (node --test, no test framework dependency)
 *
 * These cover the first bilingual edit of a field that still holds a legacy
 * plain string. That migration used to seed BOTH locales with the legacy value,
 * so on a Chinese-authored site the first edit of any field wrote Chinese into
 * the English slot, where nothing afterwards can tell it apart from a real
 * translation.
 */

test("a legacy Chinese string lands in zh, not in both", () => {
  const out = setVal({ title: "慢域之道" }, "title", "zh", "慢域旅遊");
  assert.deepEqual(out.title, { zh: "慢域旅遊" });
  assert.equal((out.title as Record<string, string>).en, undefined);
});

test("editing the English tab of a Chinese-only field keeps the Chinese", () => {
  const out = setVal({ title: "慢域之道" }, "title", "en", "The Select Way");
  assert.deepEqual(out.title, { zh: "慢域之道", en: "The Select Way" });
});

test("a legacy English string lands in en, and editing zh keeps it", () => {
  assert.equal(legacyValueLocale("Book Now"), "en");
  const out = setVal({ label: "Book Now" }, "label", "zh", "立即預約");
  assert.deepEqual(out.label, { en: "Book Now", zh: "立即預約" });
});

test("a mixed string counts as Chinese: CJK decides", () => {
  assert.equal(legacyValueLocale("慢域之道 The Select Way"), "zh");
  assert.equal(legacyValueLocale("14 米中庭泳池"), "zh");
  assert.equal(legacyValueLocale("Wi-Fi 6"), "en");
});

test("a populated English slot is never blanked by editing the Chinese one", () => {
  const out = setVal({ title: { zh: "舊", en: "Old" } }, "title", "zh", "新");
  assert.deepEqual(out.title, { zh: "新", en: "Old" });
});

test("an empty or absent field seeds nothing", () => {
  assert.deepEqual(setVal({}, "title", "en", "Hello").title, { en: "Hello" });
  assert.deepEqual(setVal({ title: "" }, "title", "zh", "你好").title, { zh: "你好" });
});

test("other keys and the original object are left alone", () => {
  const before = { title: "慢域之道", href: "/stays" };
  const after = setVal(before, "title", "en", "The Select Way");
  assert.equal(after.href, "/stays");
  assert.equal(before.title, "慢域之道", "setVal must not mutate its input");
});

test("getVal reads a plain string for either locale", () => {
  assert.equal(getVal({ title: "慢域之道" }, "title", "en"), "慢域之道");
  assert.equal(getVal({ title: { zh: "慢域之道" } }, "title", "en"), "");
});

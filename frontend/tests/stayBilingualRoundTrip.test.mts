import assert from "node:assert/strict";
import test from "node:test";
import { cleanBi, setBi, splitBi } from "../app/admin/modules/stayBilingual.ts";
import { bilingual } from "../app/modules/tr.ts";

test("single-language mixed text survives saving and reloading", () => {
  const text = "CRUD QA 住宿 SEO 1018";
  const saved = cleanBi(setBi("", "zh", text));
  assert.equal(splitBi(saved).zh, text);
  assert.equal(splitBi(saved).en, "");
  assert.equal(bilingual(saved, "zh"), text);
  assert.equal(bilingual(saved, "en"), text);
});

test("empty and two-language values retain their boundaries", () => {
  assert.equal(cleanBi(setBi("", "zh", "")), "");
  const saved = cleanBi(setBi(setBi("", "zh", "宜蘭 Villa QA"), "en", "Yilan Villa"));
  assert.deepEqual(splitBi(saved), { zh: "宜蘭 Villa QA", en: "Yilan Villa" });
  assert.equal(bilingual(saved, "en"), "Yilan Villa");
});

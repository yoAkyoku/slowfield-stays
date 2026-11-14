import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { trs } from "../app/modules/tr.ts";

/**
 * Admin lists show content in the language the admin is set to.
 *
 * The admin has a language toggle that switches the whole chrome, and the
 * public site resolves every translatable field through `trs()`. The admin
 * lists did not: they printed the base column directly. On this data the base
 * column is the English one — `name: "Hejing Villa"` with
 * `translations.zh` holding 禾境 — so with the toggle reading 中文 the
 * labels around the card were Chinese and the villa's own name and summary
 * were English.
 *
 * `trs` already does the right thing, including the fallback order that keeps
 * a record with only one translation readable in both languages. The admin
 * simply was not calling it.
 */

const LISTS = [
  { file: "app/admin/(dashboard)/stays/page.tsx", fields: ["name", "summary"] },
  { file: "app/admin/(dashboard)/cms/CmsPagesTable.tsx", fields: ["title", "summary"] },
  { file: "app/admin/(dashboard)/cms/CmsBannersTable.tsx", fields: ["title"] },
];

for (const { file, fields } of LISTS) {
  const src = readFileSync(file, "utf8");

  test(`${file} resolves its content through trs`, () => {
    for (const field of fields) {
      assert.ok(
        src.includes('"' + field + '", locale)'),
        `${field} is not resolved with trs(..., "${field}", locale)`,
      );
    }
  });

  test(`${file} does not print a raw translatable column`, () => {
    for (const raw of ["{stay.name}", "{stay.summary}", "{page.title}", "{banner.title}"]) {
      assert.ok(!src.includes(raw), `${file} still prints ${raw} without a locale`);
    }
  });
}

/* The resolver's own contract, since the fix leans entirely on it. */

const STAY = {
  name: "Hejing Villa",
  summary: "A quiet-luxury pool villa",
  translations: { zh: { name: "禾境", summary: "宜蘭冬山的泳池包棟" } },
};

test("a Chinese admin sees the Chinese name", () => {
  assert.equal(trs(STAY, "name", "zh"), "禾境");
});

test("an English admin still sees the base column", () => {
  assert.equal(trs(STAY, "name", "en"), "Hejing Villa");
});

test("a record with no translation stays readable, not blank", () => {
  const untranslated = { name: "八代町 YASHIROCHO", translations: {} };
  assert.equal(trs(untranslated, "name", "zh"), "八代町 YASHIROCHO");
  assert.equal(trs(untranslated, "name", "en"), "八代町 YASHIROCHO");
});

test("an empty base column borrows the other locale rather than showing nothing", () => {
  const zhOnly = { name: "", translations: { zh: { name: "禾境" } } };
  assert.equal(trs(zhOnly, "name", "en"), "禾境");
});

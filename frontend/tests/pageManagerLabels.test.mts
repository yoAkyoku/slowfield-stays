import assert from "node:assert/strict";
import test from "node:test";
import { declarationText } from "./sourceEval.mts";
import { readCode } from "./readCode.mts";
import { pageLabel } from "../app/modules/contentTypes.ts";

/**
 * 頁面管理 prints a category's name, and it printed two wrong things.
 *
 * 人才招募 and 民宿加盟 are stored on the live parent site as `label: {}` — the
 * object is there, it is simply empty. The screen printed the raw content-type
 * key for both: the rows read `career` and `franchise` while every other row
 * read a Chinese name. Two separate reasons, and either alone is enough:
 *
 *   1. the call site reaches for a default with `cfg?.label ?? def?.label`, and
 *      `{}` is not nullish, so the default is never consulted;
 *   2. the screen had its OWN resolver — `map[locale] || map.en || key` — with
 *      no bundled default in it at all.
 *
 * The second one also produced the complaint that started this: a category
 * named only in English printed its English name on a Chinese screen, because
 * `map.en` was tried before any Chinese fallback (客戶: 為何有些分類標籤只有英文).
 *
 * `pageLabel` is the resolver the public renderer and the nav already share.
 * Same category, same name, everywhere it is written down.
 */

const EDITOR = "app/admin/(dashboard)/sites/[id]/SitePageEditor.tsx";

test("an empty label object falls back to the bundled name, not to the key", () => {
  // The exact stored shape on the live parent site.
  assert.equal(pageLabel("career", {}, "zh"), "人才招募");
  assert.equal(pageLabel("franchise", {}, "zh"), "民宿加盟");
  assert.equal(pageLabel("career", {}, "en"), "Careers");
});

test("a missing label object behaves the same as an empty one", () => {
  /* pr and media are stored with no `label` key at all, and they rendered
     correctly the whole time. The two shapes have to agree, or which of them a
     site happens to hold decides whether it sees a name or a key. */
  for (const key of ["pr", "media"]) {
    assert.equal(pageLabel(key, undefined, "zh"), pageLabel(key, {}, "zh"));
  }
  assert.equal(pageLabel("media", undefined, "zh"), "媒體報導");
});

test("an English-only name does not print on a Chinese screen", () => {
  // The reported symptom. The bundled Chinese outranks a label in the other
  // language; the English screen still gets the English the client typed.
  assert.equal(pageLabel("career", { en: "Careers" }, "zh"), "人才招募");
  assert.equal(pageLabel("career", { en: "We're hiring" }, "en"), "We're hiring");
});

test("a name the client actually typed always wins", () => {
  /* The fallback must not become an override — this is the half that would
     silently discard a rename, which is worse than the bug it fixes. */
  assert.equal(pageLabel("career", { zh: "加入我們" }, "zh"), "加入我們");
  assert.equal(pageLabel("news", { zh: "最新消息" }, "zh"), "最新消息");
  // One plain string is a name chosen for both languages.
  assert.equal(pageLabel("career", "招募", "zh"), "招募");
  assert.equal(pageLabel("career", "招募", "en"), "招募");
});

test("頁面管理 resolves names through pageLabel and not its own copy", () => {
  const decl = declarationText(EDITOR, ["pageDisplayName"]).get("pageDisplayName");
  assert.ok(decl, `${EDITOR}: pageDisplayName is gone — renamed, or commented out`);
  assert.match(decl!, /pageLabel\(key, labelSource, locale\)/, "the screen still resolves names itself");
  /* The specific expression that caused it, named so a revert is loud: the
     bundled default is missing from it entirely, and `map.en` outranks it. */
  assert.doesNotMatch(
    decl!,
    /map\[locale\]\s*\|\|\s*map\.en\s*\|\|\s*key/,
    "the old resolver is back: no bundled default, and English before Chinese",
  );
  assert.match(readCode(EDITOR), /import \{ pageLabel \}/, "pageLabel is not imported");
});

test("the homepage keeps its own name", () => {
  // It is not a content type and has no bundled entry; pageLabel would hand
  // back the key.
  const decl = declarationText(EDITOR, ["pageDisplayName"]).get("pageDisplayName")!;
  assert.match(decl, /homepage/, "the homepage row would print the key 'homepage'");
});

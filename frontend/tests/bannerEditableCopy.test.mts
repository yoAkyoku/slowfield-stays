import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";

test("banner editor exposes the story button and scroll cue copy", () => {
  const editor = readCode("app/admin/(dashboard)/cms/BannerFormEditor.tsx");
  for (const field of ["story_cta_label", "story_cta_href"]) {
    assert.match(editor, new RegExp(`getField\\("${field}"\\)`), `${field} is not editable`);
  }
  for (const label of [
    "主要按鈕文字",
    "主要按鈕連結",
    "次要按鈕文字",
    "次要按鈕連結",
  ]) {
    assert.match(editor, new RegExp(label), `${label} is not shown`);
  }
  assert.match(editor, /resolveHeroScrollLabel\(i18nFields\[editLocale\]\?\.scroll_label, editLocale\)/);
  assert.match(editor, /setField\("scroll_label", e.target.value\)/);
  assert.doesNotMatch(editor, /品牌故事按鈕文字/);
});

test("homepage hero reads story button text, link, and scroll cue from the active banner", () => {
  const hero = readCode("app/modules/home/HomeHeroCarousel.tsx");
  assert.match(hero, /trs\(active, "story_cta_label", locale\)/);
  assert.match(hero, /trs\(active, "story_cta_href", locale\)/);
  assert.match(hero, /active\?\.translations\?\.\[locale\]\?\.scroll_label \?\? active\?\.scroll_label/);
  assert.doesNotMatch(hero, /href="\/brand"/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { resolveHeroScrollLabel } from "../app/modules/heroScrollLabel.ts";
import { readCode } from "./readCode.mts";

test("unset scroll cues use locale defaults while explicit blank stays blank", () => {
  assert.equal(resolveHeroScrollLabel(undefined, "zh"), "向下探索");
  assert.equal(resolveHeroScrollLabel(undefined, "en"), "Scroll to explore");
  assert.equal(resolveHeroScrollLabel("", "zh"), "");
  assert.equal(resolveHeroScrollLabel("   ", "en", "Custom"), "");
  assert.equal(resolveHeroScrollLabel({zh:"",en:"Discover"}, "zh"), "");
  assert.equal(resolveHeroScrollLabel({zh:"",en:"Discover"}, "en"), "Discover");
});
test("numeric placeholders fall back and custom text is preserved", () => {
  for(const value of [3, "3", " 3 "]) assert.equal(resolveHeroScrollLabel(value, "zh"), "向下探索");
  assert.equal(resolveHeroScrollLabel("往下看", "zh"), "往下看");
  assert.equal(resolveHeroScrollLabel(undefined, "zh", "Block cue"), "Block cue");
});
test("public hero and both editors preserve the difference between blank and missing", () => {
  const hero=readCode("app/modules/home/HomeHeroCarousel.tsx");
  assert.match(hero, /active\?\.translations\?\.\[locale\]\?\.scroll_label \?\? active\?\.scroll_label/);
  assert.doesNotMatch(hero, /\) \|\| blockScrollLabel/);
  assert.match(readCode("app/admin/(dashboard)/cms/BannerFormEditor.tsx"), /resolveHeroScrollLabel\(i18nFields\[editLocale\]\?\.scroll_label, editLocale\)/);
  assert.match(readCode("app/admin/modules/blockForms.tsx"), /resolveHeroScrollLabel\(c.scroll_label, editLocale\)/);
});

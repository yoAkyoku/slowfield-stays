import assert from "node:assert/strict";
import test from "node:test";
import { readCode, readStyles } from "./readCode";

test("banner editor stores shadow and translucent text background controls", () => {
  const editor = readCode("app/admin/(dashboard)/cms/BannerFormEditor.tsx");
  for (const key of ["textShadow", "textBg", "textBgOpacity"]) {
    assert.match(editor, new RegExp(key), `${key} control is missing`);
  }
});

test("homepage hero applies the saved text readability settings", () => {
  const hero = readCode("app/modules/home/HomeHeroCarousel.tsx");
  assert.match(hero, /hero-copy--shadow-/);
  assert.match(hero, /--hero-copy-bg/);
  assert.match(hero, /--hero-copy-bg-opacity/);

  const css = readStyles("app/globals.css");
  assert.match(css, /\.hero-copy--shadow-soft/);
  assert.match(css, /\.hero-copy--shadow-strong/);
  assert.match(css, /color-mix\(/);
});


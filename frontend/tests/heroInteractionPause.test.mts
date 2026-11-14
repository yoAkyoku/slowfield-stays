import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode.mts";

test("a focused or hovered carousel does not change its active link", () => {
  const code = readCode("app/modules/home/HomeHeroCarousel.tsx");
  assert.match(code, /autoplayPaused = focused \|\| hovered \|\| manuallyPaused/);
  assert.match(code, /if \(autoplayPaused\) return/);
  assert.match(code, /onFocusCapture=\{\(\) => setFocused\(true\)/);
  assert.match(code, /currentTarget.contains\(event.relatedTarget/);
});

test("pause controls also pause video and keep focused dot buttons mounted", () => {
  const code = readCode("app/modules/home/HomeHeroCarousel.tsx");
  assert.match(code, /if \(autoplayPaused\) video.pause\(\)/);
  assert.match(code, /aria-pressed=\{manuallyPaused\}/);
  assert.match(code, /key=\{banner.id\}/);
  assert.doesNotMatch(code, /key=\{`\$\{banner.id\}-\$\{slideIndex === index/);
  assert.match(code, /animationDuration: `\$\{slideMs/);
});

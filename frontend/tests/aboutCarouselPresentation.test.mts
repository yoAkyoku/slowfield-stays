import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";

test("About image carousel keeps auto-advance and touch navigation without an overlaid control bar", () => {
  const source = readCode("app/modules/home/blocks/AboutImageCarousel.tsx");

  assert.doesNotMatch(source, /block-about-carousel__controls/);
  assert.match(source, /useAutoAdvance\([\s\S]*?delay: SLIDE_DURATION_MS/);
  assert.match(source, /onTouchStart=/);
  assert.match(source, /onTouchEnd=/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";

test("hero carousel stops retrying after every video has failed", () => {
  const source = readCode("app/modules/home/HomeHeroCarousel.tsx");
  assert.match(source, /failedVideoIndexes/);
  assert.match(source, /skipBrokenVideo\(slideIndex\)/);
  assert.match(source, /for \(let offset = 1; offset < slides\.length/);
  assert.match(source, /VIDEO_FIRST_FRAME_TIMEOUT_MS = 30_000/);
  assert.match(source, /readyVideoUrls\.has\(activeVideo\.image_url\)/);
  assert.match(source, /setTimeout\(\(\) => skipBrokenVideo\(index\), VIDEO_FIRST_FRAME_TIMEOUT_MS\)/);
});

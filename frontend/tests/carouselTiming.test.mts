import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";
import { slideMs } from "../app/modules/slideTiming.ts";

/**
 * One control for how long a slide stays, and nothing draws an empty frame.
 *
 * Four of the client's descriptions turned out to be one defect and one gap:
 *
 *   「八代町沒有跑出照片」「右邊沒有輪播」「跑到沒有圖片那就卡住了」
 *   「它上面有放空白照片」
 *     — a stay with no photos rendered a grey 5:4 panel, and because it had
 *       fewer than two images it got no arrows, no dots and no auto-advance.
 *       Nothing was stuck; it was a card with nothing in it. Every carousel
 *       was measured and all five loop correctly.
 *
 *   「速度好像不太一樣」「那它的速度也可以自己定義嗎」
 *   「我蠻希望這邊是有一個 15 秒一直在循環的」
 *     — three hero carousels ran at 6500/6500/5000ms, none of them settable,
 *       and a .mp4 (already supported, autoPlay muted loop) was cut off at 6.5s.
 */

test("輪播秒數 is read, bounded, and falls back", () => {
  assert.equal(slideMs(undefined), 6500, "the default is gone");
  assert.equal(slideMs(15), 15000, "a 15-second clip cannot be asked for");
  assert.equal(slideMs("8.5"), 8500, "a value typed into a number input is rejected");
  // A zero or a negative would spin the carousel; anything past 30s reads as a
  // typo rather than an intent.
  for (const bad of [0, -3, 1, 31, 999, "", "abc", null, {}, NaN]) {
    assert.equal(slideMs(bad), 6500, `${JSON.stringify(bad)} was accepted`);
  }
});

test("every hero carousel can be given the setting", () => {
  const home = readCode("app/modules/home/HomeHeroCarousel.tsx");
  assert.ok(!home.includes("}, SLIDE_DURATION_MS);"), "the homepage hero ignores the setting again");
  assert.match(home, /slideMs\(/, "the homepage hero no longer resolves the setting");

  const villa = readCode("app/modules/property/blocks/BlockHeroBanner.tsx");
  const passes = villa.split("intervalMs={slideMs(config.slide_seconds)}").length - 1;
  assert.equal(passes, 2, `both villa hero branches must pass it, found ${passes}`);

  const form = readCode("app/admin/modules/blockForms.tsx");
  assert.match(form, /slide_seconds: e\.target\.value \? Number\(e\.target\.value\) : undefined/,
    "the editor has no field to set it");
});

test("a video slide advances on ended instead of the image timer", () => {
  for (const path of [
    "app/modules/home/HomeHeroCarousel.tsx",
    "app/modules/property/blocks/HeroBannerCarousel.tsx",
    "app/modules/stays/StayHeroCarousel.tsx",
  ]) {
    const source = readCode(path);
    assert.match(source, /isVideoUrl\([^)]*\).*return|enabled: !isVideoUrl\(/, `${path} still schedules the image timer for video`);
    assert.match(source, /onEnded=/, `${path} cannot advance when the video finishes`);
    assert.match(source, /loop=\{[^}]*length\s*<=\s*1/, `${path} loops a video forever even when another slide follows`);
  }
  const homepageHero = readCode("app/modules/home/HomeHeroCarousel.tsx");
  assert.match(homepageHero, /onCanPlay=\{\(event\) => \{\s*if \(autoplayPaused\) event\.currentTarget\.pause\(\);\s*else void event\.currentTarget\.play\(\)\.catch\(\(\) => skipBrokenVideo\(slideIndex\)\)/);
});

test("the three hero carousels run at the same speed by default", () => {
  // 客戶: 速度好像不太一樣. The detail-page hero was the odd one at 5000.
  const stay = readCode("app/modules/stays/StayHeroCarousel.tsx");
  assert.ok(!/5000/.test(stay), "the detail-page hero is back to 5000ms");
  assert.match(stay, /delay: SLIDE_DURATION_MS/, "the detail-page hero no longer runs at the shared duration");
  // The default lives in one module both hero carousels import, so it cannot be
  // 6500 in one place and something else in another.
  assert.match(readCode("app/modules/slideTiming.ts"), /SLIDE_DURATION_MS = 6500/);
  assert.match(readCode("app/modules/property/blocks/HeroBannerCarousel.tsx"), /intervalMs = 6500/);
});

test("nothing renders a frame with no picture in it", () => {
  // The showcase card: a stay with no images was drawn as a grey panel.
  const stays = readCode("app/modules/home/blocks/BlockStays.tsx");
  assert.match(
    stays,
    /\.filter\(\(c\) => c\.images\.length > 0\)/,
    "a stay with no photos is back in the showcase row, where it draws an empty grey panel",
  );

  // The room card: the media column carries its own aspect ratio and shadow.
  const rooms = readCode("app/modules/property/blocks/BlockRooms.tsx");
  const at = rooms.indexOf('<div className="property-room-media"');
  assert.ok(at > -1, "the room media column is gone");
  assert.match(
    rooms.slice(Math.max(0, at - 200), at),
    /\{images\.length > 0 && \(/,
    "a room with no photos draws an empty panel again",
  );
});

test("the detail-page hero says how many photos it will use", () => {
  // 客戶: 它有限制說最多幾張，基本上好像可以放到十張左右 — it was five, silently.
  const stay = readCode("app/modules/stays/StayHeroCarousel.tsx");
  const cap = stay.match(/export const HERO_SLIDES = (\d+)/);
  assert.ok(cap, "the cap is a bare number again, so nothing else can agree with it");
  assert.ok(Number(cap![1]) >= 10, `the hero shows ${cap![1]} photos, fewer than the ten expected`);
  assert.match(stay, /result\.length >= HERO_SLIDES/, "the loop no longer uses the shared cap");
});

test("each 通訊處 can carry its own LINE", () => {
  const form = readCode("app/admin/modules/blockForms.tsx");
  assert.match(form, /\{ key: "line", label: "LINE", bilingual: false/, "the office LINE field is gone");
  const offices = readCode("app/modules/content/ContactOffices.tsx");
  assert.match(offices, /const oLine = typeof o\.line === "string"/, "the renderer no longer reads it");
  assert.match(offices, /href=\{lineUrl\(oLine\)\}/, "the LINE value is not turned into a link");
});

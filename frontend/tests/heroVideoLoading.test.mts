import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";

test("homepage video hero keeps a readable loading canvas until its first frame", () => {
  const hero = readCode("app/modules/home/HomeHeroCarousel.tsx");
  assert.match(hero, /readyVideoUrls/);
  assert.match(hero, /onLoadedData/);
  assert.match(hero, /hero-slide--video/);
  assert.match(hero, /is-video-ready/);
  assert.match(hero, /preload="auto"/);

  const css = readCode("app/globals.css");
  assert.match(css, /\.hero-slide--video\s*\{[^}]*background:/s);
  assert.match(css, /\.hero-slide--video video\s*\{[^}]*opacity:\s*0/s);
  assert.match(css, /\.hero-slide--video\.is-video-ready video\s*\{[^}]*opacity:\s*1/s);
});

test("banner editor uses first-frame preview and hero-specific upload guidance", () => {
  const editor = readCode("app/admin/(dashboard)/cms/BannerFormEditor.tsx");
  assert.match(editor, /mediaKind="hero"/);

  const field = readCode("app/admin/(dashboard)/stays/HeroImageField.tsx");
  assert.match(field, /<VideoThumbnail[^>]*poster=\{videoPosterUrl\(url\)\}/s);
  assert.doesNotMatch(field, /<VideoThumbnail[^>]*controls/s);

  const requirements = readCode("app/admin/modules/MediaUploadRequirements.tsx");
  assert.match(requirements, /kind === "hero"/);
  assert.match(requirements, /H\.264 MP4/);
  assert.match(requirements, /20 MB/);
});

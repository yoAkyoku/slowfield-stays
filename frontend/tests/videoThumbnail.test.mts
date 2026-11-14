import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";
import { mediaAssetDisplayName, videoPosterUrl } from "../app/modules/media.ts";

test("uploaded videos paint a first-frame thumbnail", () => {
  const thumbnail = readCode("app/admin/modules/VideoThumbnail.tsx");
  assert.match(thumbnail, /poster\?: string/);
  assert.match(thumbnail, /poster=\{poster && !posterFailed \? poster : capturedPoster \|\| undefined\}/);
  assert.match(thumbnail, /if \(poster && !posterFailed\) return/);
  assert.match(thumbnail, /preload="metadata"/);
  assert.match(thumbnail, /onLoadedMetadata/);
  assert.match(thumbnail, /video\.currentTime\s*=\s*Math\.min\(0\.1/);
  assert.match(thumbnail, /onSeeked=/);
  assert.match(thumbnail, /posterFailed/);
  assert.match(thumbnail, /drawImage\(video/);
});

test("stored video posters reach every banner and library surface", () => {
  const media = readCode("app/modules/media.ts");
  assert.match(media, /\.poster-v2\.jpg/);
  for (const path of [
    "app/modules/home/HomeHeroCarousel.tsx",
    "app/admin/(dashboard)/cms/CmsBannersTable.tsx",
    "app/admin/(dashboard)/media/MediaLibraryView.tsx",
    "app/admin/(dashboard)/stays/HeroImageField.tsx",
    "app/admin/(dashboard)/homepage/ImageUploadInput.tsx",
  ]) {
    const source = readCode(path);
    assert.match(source, /poster|videoPosterUrl/, `${path} does not use the stored poster`);
  }
  const library = readCode("app/admin/(dashboard)/media/MediaLibraryView.tsx");
  assert.match(library, /asset\.poster_url \|\| videoPosterUrl\(asset\.url \|\| asset\.file\)/);
  const bannerTable = readCode("app/admin/(dashboard)/cms/CmsBannersTable.tsx");
  assert.match(bannerTable, /<VideoThumbnail[\s\S]*?poster=\{poster \|\| undefined\}/);
  assert.match(bannerTable, /<Image[\s\S]*?unoptimized/);
});

test("inline picker uses the saved file name and a static poster image for videos", () => {
  assert.equal(
    mediaAssetDisplayName({ display_name: "Original villa video.mp4", file: "hash.mp4" }),
    "Original villa video.mp4",
  );
  assert.equal(
    mediaAssetDisplayName({ alt_text: "Legacy upload.mp4", file: "hash.mp4" }),
    "Legacy upload.mp4",
  );
  assert.equal(
    videoPosterUrl("/storage/media/hash.mp4"),
    "/storage/media/hash.poster-v2.jpg",
  );

  const tile = readCode("app/admin/modules/MediaPickerThumbnail.tsx");
  assert.match(tile, /isVideoAsset\(asset\)/);
  assert.match(tile, /mediaAssetDisplayName\(asset/);
  assert.match(tile, /<img[\s\S]*?src=\{posterUrl\}/);
  assert.match(tile, /<span[^>]*>\{name\}<\/span>/);
  assert.doesNotMatch(tile, /使用 Use/);
  assert.match(tile, /<VideoThumbnail src=\{assetUrl\}/);
});

test("media library and both inline pickers consume video posters", () => {
  const library = readCode("app/admin/(dashboard)/media/MediaLibraryView.tsx");
  assert.match(library, /VideoThumbnail/);
  assert.match(library, /poster=\{asset\.poster_url \|\| videoPosterUrl/);
  for (const path of [
    "app/admin/(dashboard)/stays/HeroImageField.tsx",
    "app/admin/(dashboard)/homepage/ImageUploadInput.tsx",
  ]) {
    const source = readCode(path);
    assert.match(source, /MediaPickerThumbnail/, `${path} does not use the filename/poster tile`);
    assert.doesNotMatch(source, /使用 Use/);
  }

  const bannerField = readCode("app/admin/(dashboard)/stays/HeroImageField.tsx");
  assert.match(bannerField, /<VideoThumbnail[^>]*poster=\{videoPosterUrl\(url\)\}/s);
  assert.doesNotMatch(bannerField, /<VideoThumbnail[^>]*controls/s);

  const css = readCode("app/globals.css");
  assert.match(css, /\.media-inline-thumb img,\s*\.media-inline-thumb video/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { readCode, readStyles } from "./readCode";

test("homepage gallery changes one image at a time and keeps admin-uploaded images", () => {
  const component = readCode("app/modules/home/HomePhotoGallery.tsx");
  assert.match(component, /home-gallery-carousel/);
  assert.match(component, /setIndex/);
  // The arrow labels come from the shared, bilingual galleryLabels.
  assert.match(component, /galleryLabels\(zh\)/);
  const labels = readCode("app/modules/galleryLabels.ts");
  assert.match(labels, /Previous image/);
  assert.match(labels, /Next image/);
  assert.match(component, /images\.slice\(0, 8\)/);

  const css = readStyles("app/globals.css");
  assert.match(css, /\.home-gallery-carousel \.home-gallery-item\.is-active/);
});

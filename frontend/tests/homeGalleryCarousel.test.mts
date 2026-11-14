import assert from "node:assert/strict";
import test from "node:test";
import { readCode, readStyles } from "./readCode";

test("homepage gallery changes one image at a time and keeps admin-uploaded images", () => {
  const component = readCode("app/modules/home/HomePhotoGallery.tsx");
  assert.match(component, /home-gallery-carousel/);
  assert.match(component, /setIndex/);
  assert.match(component, /Previous image/);
  assert.match(component, /Next image/);
  assert.match(component, /images\.slice\(0, 8\)/);

  const css = readStyles("app/globals.css");
  assert.match(css, /\.home-gallery-carousel \.home-gallery-item\.is-active/);
});

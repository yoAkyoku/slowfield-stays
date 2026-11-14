import assert from "node:assert/strict";
import test from "node:test";
import { normaliseAboutImages } from "../app/modules/home/blocks/aboutImages.ts";

test("About carousel accepts current string and object image records in order", () => {
  const images = normaliseAboutImages({
    images: [
      "/one.jpg",
      { url: " /two.jpg ", alt: { zh: "第二張", en: "Second" }, caption: "retained" },
      { url: "   " },
      null,
    ],
  });

  assert.deepEqual(images, [
    { url: "/one.jpg" },
    { url: "/two.jpg", alt: { zh: "第二張", en: "Second" }, caption: "retained" },
  ]);
});

test("legacy About image fields migrate to the carousel in their original order", () => {
  assert.deepEqual(
    normaliseAboutImages({ image: " /old-main.jpg ", image2: "/old-second.jpg" }),
    [{ url: "/old-main.jpg" }, { url: "/old-second.jpg" }],
  );
});

test("an explicitly emptied carousel does not resurrect removed legacy images", () => {
  assert.deepEqual(
    normaliseAboutImages({ images: [], image: "/old-main.jpg", image2: "/old-second.jpg" }),
    [],
  );
});

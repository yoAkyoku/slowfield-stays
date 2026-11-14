import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";
import { loadHeroImageUrl } from "../app/modules/media.ts";

class DeferredImage {
  static instances: DeferredImage[] = [];
  complete = false;
  naturalWidth = 0;
  decoding = "";
  src = "";
  priority = "";
  onload: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  private resolveDecode: (() => void) | null = null;

  constructor() { DeferredImage.instances.push(this); }
  setAttribute(name: string, value: string) { if (name === "fetchpriority") this.priority = value; }
  decode() { return new Promise<void>((resolve) => { this.resolveDecode = resolve; }); }
  finishLoad() {
    this.complete = true;
    this.naturalWidth = 1600;
    this.onload?.(new Event("load"));
  }
  finishDecode() { this.resolveDecode?.(); }
  fail() { this.onerror?.(new Event("error")); }
}

function installImageWindow() {
  const root = globalThis as unknown as Record<string, unknown>;
  const previousWindow = root.window;
  root.window = { Image: DeferredImage };
  return () => {
    if (previousWindow === undefined) delete root.window;
    else root.window = previousWindow;
  };
}

test("hero image readiness stays pending until the image is decoded", async () => {
  const restoreWindow = installImageWindow();
  DeferredImage.instances = [];
  try {
    const pending = loadHeroImageUrl(`/qa-slow-${Date.now()}.jpg`, "high");
    const image = DeferredImage.instances[0];
    assert.ok(image);
    assert.equal(image.priority, "high");

    let settled = false;
    void pending.then(() => { settled = true; });
    await Promise.resolve();
    assert.equal(settled, false, "starting the request must not count as a loaded image");

    image.finishLoad();
    await Promise.resolve();
    assert.equal(settled, false, "loaded bytes must still wait for image decoding");

    image.finishDecode();
    assert.equal(await pending, true);
  } finally {
    restoreWindow();
  }
});

test("home hero waits for current and next images before autoplay transitions", () => {
  const source = readCode("app/modules/home/HomeHeroCarousel.tsx");
  assert.match(source, /slideIndex === index \|\| slideIndex === previousIndexRef\.current[\s\S]*backgroundImage/);
  const activeLoad = source.indexOf('loadHeroImageUrl(active.image_url, "high").then');
  const dwellTimer = source.indexOf("timer = window.setTimeout", activeLoad);
  assert.ok(activeLoad >= 0 && dwellTimer > activeLoad, "dwell timer must start after the current image load settles");
  assert.match(source, /loadHeroImageUrl\(next\.image_url, "high"\)\.then\(showNext\)/);
  assert.match(source, /loadHeroImageUrl\(target\.image_url, "high"\)\.then\(showTarget\)/);
  assert.match(source, /preloadImageUrl/);
  assert.match(source, /setTimeout\(\(\) => preloadImageUrl\(nextUrl\), 800\)/);
  assert.match(source, /isVideoUrl\(next\.image_url\) \? videoPosterUrl\(next\.image_url\)/);
});

test("property hero does not attach hidden background URLs", () => {
  const source = readCode("app/modules/property/blocks/HeroBannerCarousel.tsx");
  assert.match(source, /\(i === active \|\| i === previousActiveRef\.current\) && !isVideoUrl\(b\.image_url\)[\s\S]*backgroundImage/);
  assert.match(source, /preloadImageUrl/);
});

test("hero preloading respects reduced-data connections", () => {
  const source = readCode("app/modules/media.ts");
  assert.match(source, /connection\?\.saveData/);
  assert.match(source, /new window\.Image\(\)/);
  assert.match(source, /fetchpriority/, "the next-image warmup must stay below the active hero request");
});

import assert from "node:assert/strict";
import test from "node:test";

import { readStyles } from "./readCode.mts";

const CSS = readStyles("app/globals.css");

test("the About image block stacks before a tablet can squeeze its copy column", () => {
  const tablet = [...CSS.matchAll(/@media\s*\(max-width:\s*1024px\)[\s\S]*?(?=\n@media|$)/g)]
    .map((match) => match[0])
    .find((block) => block.includes(".block-about--has-image"));
  assert.ok(tablet, "the About block has no tablet breakpoint");
  assert.match(
    tablet!,
    /\.block-about--has-image\s*\{[\s\S]*?grid-template-columns:\s*1fr\s*;/,
    "the tablet breakpoint leaves the image and copy side by side",
  );
  assert.match(
    tablet!,
    /\.block-about-media\s*\{[\s\S]*?order:\s*-1\s*;/,
    "the tablet breakpoint does not put the visual before its copy",
  );
});

test("the desktop About photo uses equal tracks and a bounded 4:3 frame", () => {
  const desktop = CSS.match(/@media\s*\(min-width:\s*1200px\)[\s\S]*?(?=\n@media|$)/)?.[0];
  assert.ok(desktop, "the About block has no desktop composition rules");
  assert.match(desktop!, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/);
  assert.match(desktop!, /\.block-about--has-image \.block-about-media\s*\{[\s\S]*?justify-content:\s*center/);
  assert.match(desktop!, /aspect-ratio:\s*4\s*\/\s*3/);
  assert.match(CSS, /\.block-about--has-image \.block-about-carousel\s*\{[\s\S]*?width:\s*min\(100%,\s*900px\)/);
});
test("901-1199px tablets keep the About image above readable full-width copy", () => {
  const tablet = CSS.match(/@media\s*\(min-width:\s*901px\) and \(max-width:\s*1199px\)[\s\S]*?(?=\n@media|$)/)?.[0];
  assert.ok(tablet);
  assert.match(tablet!, /grid-template-columns:\s*1fr/);
  assert.match(tablet!, /order:\s*-1/);
  assert.match(tablet!, /aspect-ratio:\s*4\s*\/\s*3/);
});

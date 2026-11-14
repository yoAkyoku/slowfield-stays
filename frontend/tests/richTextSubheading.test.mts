import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readStyles, readCode } from "./readCode";

/**
 * A sub-heading inside a rich-text body must look like a heading.
 *
 * The safe-HTML allow-list has always passed h3–h5 through, and nothing styled
 * them — so an article listing six brands rendered as one undifferentiated
 * column of paragraphs.
 *
 * The second trap: a fixed clamp does not work here. The site's 字級 settings
 * drive the body through --type-body-size, and clamp(17px, 1.5vw, 20px) landed
 * on 17.436px — exactly the paragraph's own computed size. Sizing must be
 * relative to the body so it stays larger whatever the admin picks.
 */

const CSS = readStyles("app/globals.css");

const rule = CSS.match(/\.property-rich-text-body h3,[\s\S]*?\{([^}]*)\}/);

test("sub-headings inside rich text are styled at all", () => {
  assert.ok(rule, "no rule styles h3 inside a rich-text body");
});

test("the size is relative to the body, not a fixed clamp", () => {
  assert.match(rule![1], /font-size:\s*[\d.]+em/, "a fixed size can equal the body's own computed size");
  assert.doesNotMatch(rule![1], /font-size:\s*clamp\(/, "a clamp collided with --type-body-size once already");
});

test("it differs from body text by more than size alone", () => {
  assert.match(rule![1], /font-family:\s*var\(--font-title\)/);
  assert.match(rule![1], /font-weight:\s*[5-7]00/);
});

test("the allow-list still passes the tags the style targets", () => {
  const safe = readCode("app/modules/safeHtml.ts");
  assert.match(safe, /h3\|h4\|h5/, "h3–h5 are no longer allowed through, so the style is dead");
});

test("a non-landscape image can keep its own proportions", () => {
  /* .content-image-block img forces aspect-ratio 16/10 with object-fit: cover.
     That is right for scenery and wrong for a product shot — a 720x720 bottle
     rendered at 680x425 loses about a third, top and bottom. Every size variant
     only changed the width, so there was no way to opt out of the crop. */
  const rule = CSS.match(/\.content-image-block\.is-natural img \{([^}]*)\}/);
  assert.ok(rule, "there is no way to render an image without the 16/10 crop");
  assert.match(rule![1], /aspect-ratio:\s*auto/);
  assert.match(rule![1], /object-fit:\s*contain/);
});

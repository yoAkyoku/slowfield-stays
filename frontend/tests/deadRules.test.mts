import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { readCode, readStyles } from "./readCode";

/**
 * A rule in the stylesheet targets a class something actually renders.
 *
 * 38 rules — around 200 lines — pointed at classes no component had emitted for
 * a long time. Dead CSS is not merely waste here: two separate audits of this
 * file reported `.page-block-hero`'s unthreaded h1/p as a serious gap in the
 * type-scale wiring, because there is nothing in a stylesheet to say a selector
 * is unreachable. Every hour spent on those rules was spent on nothing.
 *
 * The check runs the other way round from the usual one — not "is this class
 * styled" but "is this styled class rendered".
 */

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const f = join(dir, n);
    return statSync(f).isDirectory() ? walk(f) : [f];
  });
}

/* Comments stripped. Read raw, a class named only in a COMMENT counts as
   rendered — `.page-block-gallery-grid` is mentioned once, in a note inside
   HomePhotoGallery, and nothing renders it. The first version of this sweep
   made exactly that mistake and reported the rule as live. */
const SOURCES = walk("app")
  .filter((f) => /\.tsx?$/.test(f))
  .map((f) => readCode(f))
  .join("\n");

/** Prefixes a template hole could complete: `page-block-${type}` renders
 *  page-block-hero without the word "hero" appearing anywhere near it. */
const HOLES = [...SOURCES.matchAll(/([a-z][\w-]*-)\$\{/g)].map((m) => m[1]);

function rendered(cls: string): boolean {
  /* The backslashes are doubled so the RegExp receives them.
     Written singly inside a template literal they are consumed by the literal:
     `(?<![\w-])` arrived as `(?<![w-])`, which matches any character that is not
     "w" or "-" — so `className="xpage-block-badge"` counted as rendering
     `page-block-badge`, and a class that really had gone was reported as live.
     That is a false GREEN: the caller below then skips its own check. */
  if (new RegExp(`["'\`][^"'\`]*(?<![\\w-])${cls}(?![\\w-])`).test(SOURCES)) return true;
  return HOLES.some((p) => cls.startsWith(p));
}

test("the classes this pass removed stay removed", () => {
  /* Named individually rather than swept for: a general "no dead class" rule
     over 35,000 lines would flag the admin-only and state classes this project
     legitimately keeps, and a test that has to be argued with every time it runs
     gets switched off. */
  const css = readStyles("app/globals.css");
  const gone = [
    "page-block-hero", "page-block-hero-inner", "page-block-richtext",
    "page-block-image-gallery", "page-block-gallery-grid",
    "page-block-badges", "page-block-badge",
    "property-rich-text--bleed",
    "journal-grid-cards", "journal-grid-card",
    /* These two arrived the same way the rest of this list did: PageBlocks kept
       private copies of the FAQ and table blocks, and the copies had their own
       markup and so their own rules. The copies are gone — content pages hand
       both block types to the villa components — so .property-faq and
       .property-pricing are the only rules left that anything renders. */
    "page-block-faq", "page-block-faq-item",
    "page-block-table", "page-block-table-scroll",
  ];
  // Same doubling: `\.` arrived as a bare `.` (any character), so a rule for
  // `.my-page-block-badge` counted as `.page-block-badge` coming back.
  const back = gone.filter((cls) => new RegExp(`\\.${cls}(?![\\w-])`).test(css));
  assert.deepEqual(
    back,
    [],
    `these rules target classes nothing renders: ${back.join(", ")}`,
  );
  // …and they are still unrendered, so this test is guarding the right thing.
  const nowLive = gone.filter(rendered);
  assert.deepEqual(
    nowLive,
    [],
    `${nowLive.join(", ")} is rendered again — the rules for it should come back rather than this list shrinking`,
  );
});

test("the classes it kept are the ones something renders", () => {
  // The other half: proof the sweep distinguished them, not that it deleted
  // whatever it did not recognise.
  for (const cls of [
    "property-pricing-table", "property-faq", "page-block-contact",
    "home-gallery-grid", "property-image-gallery-grid", "property-block-pair",
  ]) {
    assert.ok(rendered(cls), `${cls} is styled but nothing renders it any more`);
  }
});

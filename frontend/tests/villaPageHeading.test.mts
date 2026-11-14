import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readStyles, readCode } from "./readCode";

/**
 * Every villa page needs exactly one document heading.
 *
 * The `<h1>` on a villa page came from whatever the editor happened to arrange:
 * the sub-page rendered one only when a hero *title* had been filled in, and the
 * homepage only when the blocks included a hero banner. Both are optional. So a
 * villa sub-page with content had no heading at all while the same page with
 * nothing on it had one — inverted — and a homepage built without a hero block
 * shipped with zero.
 *
 * Both now fall back to a visually hidden heading, the pattern the contact page
 * already uses. The risk on the way in was the opposite fault: the empty states
 * render their own visible h1, so the fallbacks have to exclude exactly those
 * cases or the page ends up with two.
 */

const SUBPAGE = readCode("app/property/[slug]/[...pageSlug]/page.tsx");
const HOMEPAGE = readCode("app/property/[slug]/page.tsx");

test("a villa sub-page with blocks gets a heading", () => {
  assert.match(SUBPAGE, /!hasHero && blocks\.length > 0 && <h1 className="sr-only">/);
});

test("the sub-page fallback cannot collide with the empty state's own h1", () => {
  // The empty state renders when there are no blocks; the fallback must not.
  assert.match(
    SUBPAGE,
    /blocks\.length > 0 && <h1 className="sr-only">/,
    "without the blocks check, a villa page with no content would render two h1s",
  );
});

test("a villa homepage without a hero block still gets a heading", () => {
  assert.match(HOMEPAGE, /<h1 className="sr-only">\{siteName\}<\/h1>/);
  assert.match(
    HOMEPAGE,
    /!blocks\.some\(\(b\) => b\.type === "hero_banner"/,
    "the hero banner block renders its own h1 — doubling up would be the new bug",
  );
});

test("sr-only is a real utility, not an invented class name", () => {
  const css = readStyles("app/globals.css");
  assert.match(css, /^\.sr-only \{/m, "the hidden headings rely on this class existing");
});

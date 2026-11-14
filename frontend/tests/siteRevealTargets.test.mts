import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { readCode } from "./readCode";

/**
 * Every selector SiteReveal watches is one that something renders.
 *
 * The list had grown to fifteen entries of which ten — .activity-seasonal-strip,
 * .journal-grid, .dining-highlights, .dining-stories, .dining-grid-section,
 * .brand-stories, .experience-opening, .experience-philosophy,
 * .contact-form-shell, .page-cta — named classes no component emits any more.
 * They were the per-category page components that ContentFacets/CategoryPage
 * replaced. `querySelectorAll` on a selector that matches nothing throws no
 * error and logs nothing, so the file went on looking like it covered the site:
 * measured on the running app, /brand /curation /dining /journal /news hit one
 * target each and /contact hit zero — a whole page with the scroll reveal
 * silently switched off.
 *
 * This runs the same way round as tests/deadRules.test.mts: not "is this class
 * styled" but "is this class rendered". A selector nothing renders is a promise
 * this component cannot keep, and it cannot be spotted by reading the file.
 */

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const f = join(dir, n);
    return statSync(f).isDirectory() ? walk(f) : [f];
  });
}

const REVEAL = "app/(site)/SiteReveal.tsx";

/* Comments stripped, and SiteReveal itself excluded: the file names all fifteen
   classes, so reading it as evidence would make every selector look alive —
   including the ten this test exists to keep out. */
const SOURCES = walk("app")
  .filter((f) => /\.tsx?$/.test(f))
  .filter((f) => !f.replace(/\\/g, "/").endsWith("SiteReveal.tsx"))
  .map((f) => readCode(f))
  .join("\n");

/** Prefixes a template hole could complete: `page-block-${type}` renders
 *  page-block-hero without the word "hero" appearing near it. */
const HOLES = [...SOURCES.matchAll(/([a-z][\w-]*-)\$\{/g)].map((m) => m[1]);

/** Does some component put this class on an element? */
function rendered(cls: string): boolean {
  const quoted = new RegExp(
    "[\"'`][^\"'`]*(?<![\\w-])" + cls + "(?![\\w-])",
  );
  if (quoted.test(SOURCES)) return true;
  return HOLES.some((p) => cls.startsWith(p));
}

/** The selector strings in SiteReveal's SELECTORS array. */
function selectors(): string[] {
  const src = readCode(REVEAL);
  const open = src.indexOf("const SELECTORS = [");
  assert.ok(open !== -1, "SELECTORS is gone or was renamed");
  const close = src.indexOf("]", open);
  assert.ok(close !== -1, "SELECTORS is not terminated");
  return [...src.slice(open, close).matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/** The class names a selector depends on. All of them have to exist for the
 *  selector to match anything, so all of them are checked. */
function classesIn(selector: string): string[] {
  return [...selector.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
}

test("SiteReveal watches nothing that no component renders", () => {
  const all = selectors();
  assert.ok(all.length > 0, "SELECTORS parsed as empty — the shape of the file changed");

  const dead = all.filter((sel) => classesIn(sel).some((cls) => !rendered(cls)));
  assert.deepEqual(
    dead,
    [],
    "these selectors name classes nothing in app/ renders, so they hide and reveal nothing: " +
      dead.join(", "),
  );
});

test("/contact is covered, and by the classes its blocks are actually given", () => {
  /* The page that measured zero. It is built from admin blocks rather than a
     hand-written layout, so it carries none of the section classes the content
     indexes do — its reveal targets can only be BlockWrapper's own wrappers. */
  const forContact = selectors().filter((s) => s.includes("contact-page"));
  assert.ok(
    forContact.length > 0,
    "no selector reaches /contact — main.contact-page's children would go unrevealed again",
  );

  // The wrapper class every block gets is decided in blockStyle, not here; if
  // that name changes these selectors go quiet the same way the old ten did.
  const wrapperSource = readCode("app/modules/blockStyle.ts") + readCode("app/modules/blockPairs.tsx");
  const named = forContact.flatMap(classesIn).filter((c) => c !== "contact-page");
  assert.ok(named.length > 0, "the contact selectors name no block wrapper class at all");

  const missing = named.filter(
    (cls) => !new RegExp("[\"'`][^\"'`]*(?<![\\w-])" + cls + "(?![\\w-])").test(wrapperSource),
  );
  assert.deepEqual(
    missing,
    [],
    "these classes are not the ones blockStyle/blockPairs put on a block: " + missing.join(", "),
  );

  // And the page really is the root those selectors are scoped to.
  assert.match(
    readCode("app/(site)/contact/page.tsx"),
    /className="contact-page"/,
    "the contact page's root class changed, so the > selectors above match nothing",
  );
});

test("the homepage is still left to HomeReveal", () => {
  // Both observers on one page would double-hide the same elements.
  assert.match(
    readCode(REVEAL),
    /querySelector\("main\.site-home"\)\)\s*return/,
    "SiteReveal no longer bails on the homepage",
  );
});

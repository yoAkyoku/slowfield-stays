import assert from "node:assert/strict";
import test from "node:test";
import { compileDeclarations } from "./sourceEval.mts";
import { readCode } from "./readCode.mts";

/**
 * One entry per URL in the sitemap.
 *
 * A villa is two things at once: a row in the stay catalogue and a child site.
 * Both produce `/stays/{slug}`, so the live sitemap carried
 * https://www.slowfield.example/stays/hejing twice out of 57 entries.
 *
 * 八代町 escaped it only because its stay slug (`yashirocho`) and its site slug
 * (`yilan`) differ — the same mismatch that sends its card to the detail page
 * instead of its villa site. So the duplicate is not cosmetic: it is the shape
 * of a villa whose two identities agree, and its absence is the shape of one
 * whose identities do not.
 */

const SITEMAP = "app/sitemap.ts";

/** The dedupe, lifted out and run over real-looking entries. */
const dedupe = (entries: Array<{ url: string; priority?: number }>) =>
  Array.from(new Map(entries.map((e) => [e.url, e])).values());

test("the route deduplicates before returning", () => {
  const src = readCode(SITEMAP);
  assert.match(src, /new Map\(all\.map\(\(entry\) => \[entry\.url, entry\]\)\)/,
    `${SITEMAP}: the sitemap no longer deduplicates — a villa will be listed twice`);
});

test("a URL produced twice appears once", () => {
  const out = dedupe([
    { url: "https://x/stays", priority: 0.9 },
    { url: "https://x/stays/hejing", priority: 0.85 },   // from the catalogue
    { url: "https://x/stays/hejing", priority: 0.8 },    // from the child site
    { url: "https://x/stays/hejing/news", priority: 0.7 },
  ]);
  assert.equal(out.length, 3);
  assert.equal(out.filter((e) => e.url === "https://x/stays/hejing").length, 1);
});

test("the villa's own entry is the one kept", () => {
  /* Last wins, and propertyRoutes comes last. The catalogue's copy is the
     generic 0.85 for any stay; the child-site copy is that villa's real home
     page. Keeping the first would have silently changed which one survives. */
  const out = dedupe([
    { url: "https://x/stays/hejing", priority: 0.85 },
    { url: "https://x/stays/hejing", priority: 0.8 },
  ]);
  assert.equal(out[0].priority, 0.8, "the catalogue's generic entry won instead of the villa's own");
});

test("everything else keeps its order", () => {
  // Dedupe must not reshuffle: the list is ordered by SEO importance.
  const out = dedupe([
    { url: "https://x/" },
    { url: "https://x/stays" },
    { url: "https://x/contact" },
  ]);
  assert.deepEqual(out.map((e) => e.url), ["https://x/", "https://x/stays", "https://x/contact"]);
});

test("an empty sitemap stays empty", () => {
  // The draft-site branch returns [] before any of this runs; it must survive
  // the dedupe unchanged rather than throwing.
  assert.deepEqual(dedupe([]), []);
});

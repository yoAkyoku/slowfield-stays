import assert from "node:assert/strict";
import test from "node:test";

/**
 * Run with: npm test  (node --test, no test framework dependency)
 *
 * Where a villa card or map pin points.
 *
 * `/stays/{slug}` is the villa's own site. Middleware rewrites it to the
 * property route whenever the slug resolves to a child site — including one
 * that is still a draft — and the property route refuses drafts, so the URL
 * 404s. `/stays/detail/{slug}` is the parent's own page for that villa and
 * answers either way.
 *
 * Three places chose this destination and they did not agree: one routed live
 * villas to their own site, one routed them to the detail page and sent
 * everything else to the URL that might not exist, and the map hardcoded the
 * villa site for all of them. A villa added to the catalogue before its site
 * went live therefore had a 404 behind its card on the homepage, on the
 * catalogue, and on the map at the same time.
 */

/** The single rule all three now follow. */
function villaHref(slug: string, liveVillaSites: string[]): string {
  return liveVillaSites.includes(slug) ? `/stays/${slug}` : `/stays/detail/${slug}`;
}

test("a villa with a published site of its own links to that site", () => {
  assert.equal(villaHref("hejing", ["hejing", "test"]), "/stays/hejing");
});

/** The case that was broken: the site exists but is still a draft, so it is
 *  absent from the live list and `/stays/{slug}` would 404. */
test("a villa whose site is not published links to the parent's detail page", () => {
  assert.equal(villaHref("yashirocho", ["hejing", "test"]), "/stays/detail/yashirocho");
});

test("a plain stay with no villa site of its own does the same", () => {
  assert.equal(villaHref("cloud-villa", []), "/stays/detail/cloud-villa");
});

test("no live villa sites at all still yields a working link for every card", () => {
  for (const slug of ["a", "b-c", "yashirocho"]) {
    assert.equal(villaHref(slug, []), `/stays/detail/${slug}`);
    assert.ok(!villaHref(slug, []).match(/^\/stays\/[^d]/), "must not fall back to the villa site");
  }
});

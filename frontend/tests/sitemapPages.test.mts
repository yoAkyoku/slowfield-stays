import assert from "node:assert/strict";
import test from "node:test";
import { sitemapPageKeys, type PropertyPageConfig } from "../app/modules/property/types.ts";

/**
 * Run with: npm test
 *
 * sitemap.ts used to carry a hardcoded copy of the eight default villa page
 * keys while villa pages come entirely from settings.pages. That is wrong in
 * both directions: a page the client added was never submitted to search
 * engines, and a default page they deleted was submitted as a URL that 404s.
 */

const pages: Record<string, PropertyPageConfig> = {
  faq:        { sort_order: 6 },
  about:      { sort_order: 1 },
  cellar:     { sort_order: 2 },              // a page this villa added
  pricing:    { sort_order: 4, deleted: true },
  experience: { sort_order: 3, visible: false },
  contact:    { sort_order: 5, nav_hidden: true },
  homepage:   { sort_order: 0 },              // the site root, not a sub-page
};

test("custom pages are listed and default pages are not assumed", () => {
  const keys = sitemapPageKeys(pages);
  assert.ok(keys.includes("cellar"), "a page the client added must be listed");
  assert.ok(!keys.includes("space"), "a default key nobody saved must not be listed");
});

test("deleted, hidden and nav-hidden pages are dropped", () => {
  const keys = sitemapPageKeys(pages);
  for (const key of ["pricing", "experience", "contact"]) {
    assert.ok(!keys.includes(key), `${key} should not be in the sitemap`);
  }
});

test("the homepage key never becomes a sub-page URL", () => {
  assert.ok(!sitemapPageKeys(pages).includes("homepage"));
});

test("pages come out in nav order", () => {
  assert.deepEqual(sitemapPageKeys(pages), ["about", "cellar", "faq"]);
});

test("a villa with no pages configured contributes no sub-page URLs", () => {
  assert.deepEqual(sitemapPageKeys({}), []);
});

import assert from "node:assert/strict";
import test from "node:test";
import { isPubliclyVisibleVilla, isServableThroughSiteOverride } from "../app/modules/siteVisibility.ts";

/**
 * Run with: npm test  (node --test, no test framework dependency)
 *
 * Who may see a villa that is not published yet.
 *
 * Refusing drafts on the public routes is correct — that is what the status is
 * for — but it removed the last way of looking at one. The villa route 404s a
 * draft and the `?site=` override refuses one too, so a site could be created,
 * filled in, and never seen until the moment it went live to the world. Making
 * publishing the only way to preview is how a half-finished villa ends up
 * briefly public.
 *
 * The admin path is deliberately NOT part of these predicates: they answer
 * "is this public?", which has one answer regardless of who is asking. The
 * caller pairs a `false` here with an admin check (modules/adminPreview, which
 * verifies the token against the backend rather than trusting a cookie name).
 * Keeping the two separate is what stops "signed in" from quietly becoming part
 * of the definition of "published".
 */

const villa = (status?: string) => ({ parent_site_id: 1, status });

test("a draft villa is not public, whoever is asking", () => {
  assert.equal(isPubliclyVisibleVilla(villa("draft")), false);
  assert.equal(isServableThroughSiteOverride(villa("draft")), false);
});

test("an active villa is public through both doors", () => {
  assert.equal(isPubliclyVisibleVilla(villa("active")), true);
  assert.equal(isServableThroughSiteOverride(villa("active")), true);
});

test("a row with no status at all is treated as live, not hidden", () => {
  // Older rows carry none; refusing those would take a working site down,
  // which is the worse way to be wrong.
  assert.equal(isPubliclyVisibleVilla(villa(undefined)), true);
});

test("an archived villa is not public either", () => {
  assert.equal(isPubliclyVisibleVilla(villa("archived")), false);
  assert.equal(isServableThroughSiteOverride(villa("archived")), false);
});

/**
 * The parent site is never gated by the override check: its own status is a
 * different question, and refusing it would let one wrong click in the admin
 * take the whole public site down.
 */
test("the group site is served through the override whatever its status says", () => {
  assert.equal(isServableThroughSiteOverride({ parent_site_id: null, status: "draft" }), true);
  assert.equal(isServableThroughSiteOverride({ status: "archived" }), true);
});

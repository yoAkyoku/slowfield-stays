import assert from "node:assert/strict";
import test from "node:test";
import { isPubliclyVisibleVilla } from "../app/modules/siteVisibility.ts";

/**
 * A villa site is public only while it is active.
 *
 * `status` rode along in the resolve payload and nothing read it, so a site
 * created from a template was live the instant it existed: the template villa's
 * words and photos, under the new villa's name, at a URL anyone could reach.
 * Draft is the state a site is built in, and it has to mean that on the public
 * side too.
 */

const villa = { id: 10, slug: "yashirocho", parent_site_id: 1 };

test("an active villa site is served", () => {
  assert.equal(isPubliclyVisibleVilla({ ...villa, status: "active" }), true);
});

test("a draft or archived villa site is not", () => {
  for (const status of ["draft", "archived"]) {
    assert.equal(isPubliclyVisibleVilla({ ...villa, status }), false, status);
  }
});

test("a payload with no status is served", () => {
  // Older rows and the dev mock carry none. Refusing those would take a live
  // site down, which is a worse failure than showing a draft.
  assert.equal(isPubliclyVisibleVilla(villa), true);
  assert.equal(isPubliclyVisibleVilla({ ...villa, status: "" }), true);
});

test("the group site is never served as a villa", () => {
  assert.equal(isPubliclyVisibleVilla({ ...villa, parent_site_id: null, status: "active" }), false);
  assert.equal(isPubliclyVisibleVilla({ ...villa, parent_site_id: undefined }), false);
});

test("nothing at all is not a site", () => {
  assert.equal(isPubliclyVisibleVilla(null), false);
  assert.equal(isPubliclyVisibleVilla(undefined), false);
});

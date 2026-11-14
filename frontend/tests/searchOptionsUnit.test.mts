import assert from "node:assert/strict";
import test from "node:test";
import { guestOptions } from "../app/modules/searchOptions.ts";
import { isPubliclyVisibleVilla, isServableThroughSiteOverride } from "../app/modules/siteVisibility.ts";

/**
 * Run with: npm test  (node --test, no test framework dependency)
 *
 * Two settings that saved and then did nothing.
 */

/* ── the word a site counts people in ── */

test("with no unit configured the bundled labels are used unchanged", () => {
  assert.deepEqual(
    guestOptions("zh", {}).map((o) => o.label),
    ["3–5 人", "6–8 人", "9–12 人", "13 人以上"],
  );
  assert.equal(guestOptions("en", null)[0].label, "3–5 guests");
});

/**
 * The gap: the range editor bakes the unit into each label it saves, so a site
 * that edited its ranges was fine. A site that only changed the word and left
 * the rows alone saved the setting and saw nothing change on the page.
 */
test("a configured unit reaches the bundled labels", () => {
  const settings = { search_guest_ranges_unit: { zh: "位", en: "pax" } };
  assert.deepEqual(
    guestOptions("zh", settings).map((o) => o.label),
    ["3–5 位", "6–8 位", "9–12 位", "13 位以上"],
    "zh writes the unit mid-string, including in the open-ended row",
  );
  assert.deepEqual(
    guestOptions("en", settings).map((o) => o.label),
    ["3–5 pax", "6–8 pax", "9–12 pax", "13+ pax"],
  );
});

test("the submitted value is never touched by the unit", () => {
  const values = guestOptions("zh", { search_guest_ranges_unit: { zh: "位", en: "pax" } }).map((o) => o.value);
  assert.deepEqual(values, ["3", "6", "9", "13"], "the API matches on these, not on the label");
});

test("an explicitly configured range list wins over both", () => {
  const settings = {
    search_guest_ranges: [{ value: "2", label: { zh: "兩人", en: "Two" } }],
    search_guest_ranges_unit: { zh: "位", en: "pax" },
  };
  // Those labels already carry whatever unit the editor baked in; re-applying
  // one here would rewrite text the admin typed.
  assert.deepEqual(guestOptions("zh", settings), [{ value: "2", label: "兩人" }]);
});

test("a malformed unit is ignored rather than printed", () => {
  for (const bad of [{ search_guest_ranges_unit: "位" }, { search_guest_ranges_unit: ["位"] }, { search_guest_ranges_unit: { zh: "  " } }]) {
    assert.equal(guestOptions("zh", bad)[0].label, "3–5 人", JSON.stringify(bad));
  }
});

/* ── draft sites reached through ?site= ── */

const villa = (status?: string) => ({ parent_site_id: 1, status });

test("a draft villa is refused on the parent routes, as it already is on its own", () => {
  assert.equal(isServableThroughSiteOverride(villa("draft")), false);
  assert.equal(isPubliclyVisibleVilla(villa("draft")), false, "the two doors must agree");
});

test("an active villa is still previewable through the override", () => {
  assert.equal(isServableThroughSiteOverride(villa("active")), true);
  assert.equal(isServableThroughSiteOverride(villa(undefined)), true, "older rows carry no status");
});

/**
 * The parent's own status is deliberately not consulted: the override is what
 * is being gated, and refusing the parent would let one wrong click in the
 * admin take the entire public site down.
 */
test("the group site is served whatever its status says", () => {
  assert.equal(isServableThroughSiteOverride({ parent_site_id: null, status: "draft" }), true);
  assert.equal(isServableThroughSiteOverride({ status: "archived" }), true);
});

test("no site at all is not servable", () => {
  assert.equal(isServableThroughSiteOverride(null), false);
  assert.equal(isServableThroughSiteOverride(undefined), false);
});

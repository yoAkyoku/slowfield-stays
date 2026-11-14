import assert from "node:assert/strict";
import test from "node:test";
import { shortAmenity } from "../app/modules/tr.ts";

/* The chip labels are keyword matches, and the pet rule used to match a bare
   友善 — so 親子友善 and 長者友善 both came out as 寵物友善, and a stay tagged
   family- and pet-friendly showed the same chip twice. */
test("each friendly-to tag keeps its own audience", () => {
  const tags = ["包棟", "泳池", "親子友善", "寵物友善", "長者友善"];
  assert.deepEqual(tags.map((t) => shortAmenity(t, "zh")), ["包棟", "泳池", "親子友善", "寵物友善", "長者友善"]);
  assert.equal(shortAmenity("親子友善", "en"), "Family Friendly");
  assert.equal(shortAmenity("毛孩同行", "zh"), "寵物友善");
});

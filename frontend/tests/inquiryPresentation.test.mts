import test from "node:test";
import assert from "node:assert/strict";
import { inquirySourceLabel, hasStayRequest } from "../app/admin/modules/inquiryPresentation.ts";
test("known inquiry sources use the selected language without changing stored codes", () => {
  assert.equal(inquirySourceLabel("partnership", "zh", "Unknown"), "企劃合作");
  assert.equal(inquirySourceLabel("partnership", "en", "Unknown"), "Partnership");
  assert.equal(inquirySourceLabel("custom", "zh", "Unknown"), "custom");
  assert.equal(inquirySourceLabel(undefined, "zh", "未知"), "未知");
});
test("default guest count does not describe a general contact as a stay request", () => {
  assert.equal(hasStayRequest({ kind: "inquiry", source: "partnership" }), false);
  assert.equal(hasStayRequest({ kind: "booking", source: "website" }), true);
  assert.equal(hasStayRequest({ kind: "inquiry", source: "booking" }), true);
  assert.equal(hasStayRequest({ kind: "inquiry", stay_id: 1 }), true);
  assert.equal(hasStayRequest({ kind: "inquiry", check_in: "2026-10-13" }), true);
});

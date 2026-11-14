import assert from "node:assert/strict";
import test from "node:test";
import { pageLabel } from "../app/modules/property/types.ts";

test("an empty system-page label keeps its readable built-in name", () => {
  const pages = {contact:{label:{zh:"",en:""}}};
  assert.equal(pageLabel("contact", pages, "zh"), "交通聯繫");
  assert.equal(pageLabel("custom-qa", {"custom-qa":{label:{zh:"",en:""}}}, "zh"), "custom-qa");
});

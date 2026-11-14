import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";

test("the search block loads a location projection instead of the full stay catalogue", () => {
  const block = readCode("app/modules/home/blocks/BlockSearchBar.tsx");
  const api = readCode("app/modules/api.ts");
  assert.match(block, /getStaySearchOptions\(\)/);
  assert.doesNotMatch(block, /getStays\(\)/);
  assert.match(api, /"\/stays\/search-options"/);
});

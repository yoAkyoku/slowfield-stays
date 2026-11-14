import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";

const SOURCE = readCode("app/admin/modules/AdminTopbarLabel.tsx");

test("nested admin routes resolve the most specific topbar group", () => {
  assert.match(SOURCE, /\.filter\(\(group\).*hrefs\.some/);
  assert.match(SOURCE, /\.sort\(\(a, b\).*longestHref\(b\) - longestHref\(a\)/s);
  assert.match(SOURCE, /pathname\.startsWith\(href \+/);
});

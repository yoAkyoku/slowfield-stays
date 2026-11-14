import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";
test("expanding one partner does not stretch neighboring name-only cards", () => {
  const css = readCode("app/globals.css");
  const rule = css.match(/\.property-partners--cards \.property-partners-grid \{([^}]+)\}/)?.[1] ?? "";
  assert.match(rule, /align-items: start/);
});

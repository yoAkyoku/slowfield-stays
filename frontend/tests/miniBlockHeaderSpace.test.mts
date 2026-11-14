import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";
test("mini block previews get their own row above editing actions", () => {
  const css = readCode("app/globals.css");
  assert.match(css, /\.pbe-block--mini \.pbe-block-top \{[^}]*flex-wrap: wrap/s);
  assert.match(css, /\.pbe-block--mini \.pbe-block-open \{[^}]*flex: 1 0 100%/s);
});
test("mini actions can wrap without exceeding narrow columns", () => {
  const css = readCode("app/globals.css");
  assert.match(css, /\.pbe-block--mini \.pbe-block-actions \{[^}]*max-width: 100%;[^}]*flex-wrap: wrap/s);
});

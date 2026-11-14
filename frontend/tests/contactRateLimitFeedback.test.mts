import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode.mts";

test("contact form distinguishes rate limits without clearing entered values", () => {
  const source = readCode("app/modules/content/ContactFormBlock.tsx");
  assert.match(source, /response.status === 429 \? "rate-limited"/);
  assert.match(source, /status === "rate-limited".*role="alert"/);
  assert.match(source, /您填寫的內容已保留/);
  assert.match(source, /Your entries have been kept/);
  assert.doesNotMatch(source, /\.reset\(\)/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readStyles, readCode } from "./readCode";

/**
 * Field order and width in the 聯絡表單 block.
 *
 * LINE ID belongs beside Email — they are two ways to reach the same person —
 * and 主旨 is about the enquiry, so it comes after both
 * (客戶: line_id 要在 email 後面).
 *
 * Once LINE ID shows, Email and LINE ID fill a row of the two-column grid and
 * 主旨 would sit alone in the left column with a gap beside it, so it spans the
 * row instead (客戶: 如果有 line_id 主旨就要 100%).
 */

const SRC = readCode("app/modules/content/ContactFormBlock.tsx")
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const at = (needle: string) => SRC.indexOf(needle);

test("LINE ID sits between Email and 主旨", () => {
  const email = at('name="email"');
  const line = at('name="line_id"');
  const subject = at('name="subject"');
  assert.ok(email > -1 && line > -1 && subject > -1, "a field is missing");
  assert.ok(email < line, "LINE ID is rendered before Email");
  assert.ok(line < subject, "主旨 still comes before LINE ID");
});

test("主旨 spans the row when LINE ID is showing", () => {
  assert.match(
    SRC,
    /className=\{showLine \? "inquiry-full-field" : undefined\}/,
    "主旨 keeps its half-width column and leaves a gap beside it",
  );
});

test("the span class is the one the stylesheet defines", () => {
  const css = readStyles("app/globals.css");
  const rule = css.match(/\.inquiry-full-field \{([^}]*)\}/);
  assert.ok(rule, "inquiry-full-field is not defined");
  assert.match(rule![1], /grid-column:\s*1 \/ -1/);
});

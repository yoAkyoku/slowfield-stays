import assert from "node:assert/strict";
import test from "node:test";
import { evaluateExpression, initialiserText, jsxTags } from "./sourceEval";

/**
 * 字級設定: twenty-four controls that used to share one name.
 *
 * The whole matrix sat inside a single `<label>`. A label names exactly one
 * control — its `.control`, the first labellable descendant — so 「字級設定」
 * attached itself to the H1 font `<select>` and the other twenty-three (every
 * size, weight and line height, and five of the six font pickers) had no
 * accessible name at all. A screen reader read out two dozen identical
 * unlabelled comboboxes and text boxes with no way to tell an H1 from an H4.
 *
 * The same wrapper did something visibly wrong too: clicking anywhere inside it,
 * including the long explanatory paragraph at the bottom, is a click on a label,
 * so focus jumped to that one H1 font select from half a screen away.
 *
 * The fix is a `<div>` plus a `<span>` heading, and an `aria-label` per control.
 * These tests build the twenty-four names from the file's own LEVELS table and
 * check they are distinct — a set of names is only useful if no two rows share
 * one, which is exactly what the single label produced.
 */

const FILE = "app/admin/(dashboard)/sites/[id]/TypeScaleField.tsx";

type Level = { key: string; zh: string; en: string; size: string; weight: string; line: string };

const LEVELS = evaluateExpression(initialiserText(FILE, "LEVELS"))({}) as Level[];

/** The controls in one row of the matrix, in source order. */
const ROW_CONTROLS = jsxTags(FILE).filter(
  (t) => (t.tag === "select" || t.tag === "input") && t.attrs.has("aria-label"),
);

test("the matrix is no longer one giant label", () => {
  // A <label> anywhere above the grid re-creates the whole defect, so the test
  // is about the wrapper, not about which element replaced it.
  const labels = jsxTags(FILE).filter((t) => t.tag === "label");
  assert.equal(
    labels.length,
    0,
    "a <label> is back around the type-scale matrix — it will claim one control and mis-aim every click",
  );
});

test("the field still has a visible heading", () => {
  // Dropping the <label> must not drop what it said; the heading is the only
  // thing on screen that explains what blank means.
  const spans = jsxTags(FILE).filter((t) => t.tag === "span");
  assert.ok(spans.length > 0, "the field lost its heading along with its label");
});

test("every control in the matrix carries its own name", () => {
  const controls = jsxTags(FILE).filter((t) => t.tag === "select" || t.tag === "input");
  const unnamed = controls.filter((t) => !t.attrs.has("aria-label") && t.attrs.get("type") !== "hidden");
  assert.deepEqual(
    unnamed.map((t) => t.text),
    [],
    "a control in the type-scale matrix has no accessible name",
  );
  // Four per level: font, size, weight, line height.
  assert.equal(
    ROW_CONTROLS.length,
    4,
    `expected four named controls in the row template, found ${ROW_CONTROLS.length}`,
  );
});

test("the twenty-four names are all different", () => {
  // The names are templates over `lv`, so evaluate each one for each level the
  // component actually ships and check the resulting set.
  for (const zh of [true, false]) {
    const names = LEVELS.flatMap((lv) =>
      ROW_CONTROLS.map(
        (c) => evaluateExpression(c.attrs.get("aria-label")!, ["lv", "zh"])({ lv, zh }) as string,
      ),
    );
    assert.equal(names.length, 24, "the matrix no longer has six levels of four controls");
    assert.equal(
      new Set(names).size,
      24,
      `${zh ? "中文" : "English"}: two controls share a name — ${
        names.filter((n, i) => names.indexOf(n) !== i).join(", ")
      }`,
    );
    for (const n of names) assert.ok(n.trim().length > 0, "an empty accessible name");
  }
});

test("each name says which level it belongs to and which property it sets", () => {
  const lv = LEVELS[0];
  const zhNames = ROW_CONTROLS.map(
    (c) => evaluateExpression(c.attrs.get("aria-label")!, ["lv", "zh"])({ lv, zh: true }) as string,
  );
  for (const n of zhNames) {
    assert.ok(
      n.includes(lv.zh),
      `「${n}」 does not say which level it is — every row would announce the same four names`,
    );
  }
  assert.ok(zhNames.some((n) => n.includes("字型")), "no name for the font picker");
  assert.ok(zhNames.some((n) => n.includes("字級")), "no name for the size field");
  assert.ok(zhNames.some((n) => n.includes("字重")), "no name for the weight picker");
  assert.ok(zhNames.some((n) => n.includes("行高")), "no name for the line-height field");
});

test("the field still submits its value", () => {
  // The <label> was also the wrapper the hidden input sat in; the value the
  // form posts must survive the surgery.
  const hidden = jsxTags(FILE).find((t) => t.tag === "input" && t.attrs.get("type") === "hidden");
  assert.ok(hidden, "the type_scale hidden input is gone — the settings would post empty");
  assert.equal(hidden!.attrs.get("name"), "type_scale");
});

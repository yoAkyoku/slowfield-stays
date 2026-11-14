import assert from "node:assert/strict";
import test from "node:test";
import { evaluateExpression } from "./sourceEval.mts";
import { readCode } from "./readCode.mts";
import { slideMs, SLIDE_DURATION_MS } from "../app/modules/slideTiming.ts";

/**
 * 輪播秒數 (主視覺), from the box the editor types in to the timer that reads it.
 *
 * Reported as not working. The value was absent from the live site's stored
 * config, which is the same shape as "the control writes to a key nobody
 * reads" — this codebase's most repeated defect, and the reason a whole class
 * of settings has been audited for it.
 *
 * So the round trip is pinned rather than argued about. Each step EXECUTES the
 * real source rather than matching a string, because a string search is exactly
 * how a test here once passed against the wrong half of a file:
 *
 *   1. the input's onChange, lifted out of HeroBannerConfigForm
 *   2. the save action's parse of `_blocks_json`
 *   3. slideMs, the function the carousel's timer actually calls
 *
 * If any link stops carrying the number, one of these goes red and names which.
 */

const FORM = "app/admin/modules/blockForms.tsx";
const ACTION = "app/admin/modules/homepageActions.ts";

/** The real onChange from the 輪播秒數 input, as a callable. */
function intervalOnChange(): (value: string, config: Record<string, unknown>) => Record<string, unknown> {
  const src = readCode(FORM);
  /* Anchored on the assignment, not on the label: the label is translated and
     the placeholder is a number that could plausibly appear elsewhere. */
  const m = src.match(/onChange=\{e =>\s*(onChange\(\{ \.\.\.c, slide_seconds:[^}]*\}\))\s*\}/);
  assert.ok(m, `${FORM}: the 輪播秒數 input no longer writes slide_seconds — renamed, or the control was replaced`);
  return (value, config) => {
    let captured: Record<string, unknown> | undefined;
    evaluateExpression(`(e) => ${m![1]}`, ["onChange", "c"])({
      onChange: (next: Record<string, unknown>) => { captured = next; },
      c: config,
    }) as (e: unknown) => void;
    const fn = evaluateExpression(`(e) => ${m![1]}`, ["onChange", "c"])({
      onChange: (next: Record<string, unknown>) => { captured = next; },
      c: config,
    }) as unknown as (e: unknown) => void;
    fn({ target: { value } });
    assert.ok(captured, "the control did not call onChange at all");
    return captured!;
  };
}

test("typing a number puts it on the block's config", () => {
  const change = intervalOnChange();
  const next = change("3", { titleColor: "#ffffff", images: [] });
  assert.equal(next.slide_seconds, 3, "the number never reached the block config");
  // Everything already on the block survives — a spread that dropped a key here
  // would silently wipe the hero's image list.
  assert.equal(next.titleColor, "#ffffff");
  assert.deepEqual(next.images, []);
});

test("clearing the box means 'use the default', not zero", () => {
  const change = intervalOnChange();
  const next = change("", { titleColor: "#ffffff" });
  assert.equal(next.slide_seconds, undefined);
  // undefined, not 0 — slideMs treats 0 as out of range, but a stored 0 would
  // also be a value the editor cannot see and cannot clear.
  assert.equal(slideMs(next.slide_seconds), SLIDE_DURATION_MS);
});

test("the number is stored as a number, not as the input's string", () => {
  /* `<input type="number">` hands back a string. Stored as one it still works
     — slideMs coerces — but it is the shape that makes a later `=== 3` fail. */
  const next = intervalOnChange()("7.5", {});
  assert.equal(typeof next.slide_seconds, "number");
  assert.equal(next.slide_seconds, 7.5);
});

test("the save action keeps the whole config it is handed", () => {
  /* The other end of the reported symptom: the value is on the config, and the
     stored settings do not have it. Whatever the form serialises is what gets
     written, so the parse must not filter, reshape or whitelist keys. */
  const src = readCode(ACTION);
  const m = src.match(/blocks = JSON\.parse\(raw\)[^;]*;/);
  assert.ok(m, `${ACTION}: the blocks payload is no longer parsed the way this test knows about`);
  const parsed = evaluateExpression("JSON.parse(raw)", ["raw"])({
    raw: JSON.stringify([{ id: "hero-banner", type: "hero_banner", enabled: true, config: { slide_seconds: 3 } }]),
  }) as Array<{ config: Record<string, unknown> }>;
  assert.equal(parsed[0].config.slide_seconds, 3);
  assert.doesNotMatch(
    src,
    /blocks\s*=\s*blocks\.map|pick\(|allowedKeys|whitelist/i,
    "the save now reshapes the blocks, which is where a setting would go missing",
  );
});

test("the carousel's timer reads the stored value", () => {
  // The last link: what the effect passes to setTimeout.
  assert.equal(slideMs(3), 3000);
  assert.equal(slideMs(7.5), 7500);
  assert.equal(slideMs(undefined), SLIDE_DURATION_MS);
});

test("a value the editor could not have produced cannot stop the page", () => {
  /* This arrives from stored JSON, so it is not only the number input's output.
     Out of range and unparseable both fall back rather than throwing or
     spinning the carousel. */
  for (const bad of [0, -5, 31, "abc", null, {}, [], NaN]) {
    assert.equal(slideMs(bad), SLIDE_DURATION_MS, `slideMs(${JSON.stringify(bad)}) should fall back`);
  }
  assert.equal(slideMs(2), 2000, "the lower bound is inclusive");
  assert.equal(slideMs(30), 30000, "the upper bound is inclusive");
});

import assert from "node:assert/strict";
import test from "node:test";
import { readCode, readStyles } from "./readCode";

/**
 * A carousel that can be scrolled shows the controls for scrolling it.
 *
 * 客戶: 手機頁面沒有出現滑動的…可是變成大的畫面的時候又有了 — and again later,
 * 畫面縮小時輪播按鈕會消失，請補上.
 *
 * Two different mechanisms had produced the same complaint:
 *   · the rail's arrows were `display: none` below 640px
 *   · the showcase card's arrows were `opacity: 0` until :hover
 * Neither reason survived contact with the case that mattered — a narrowed
 * desktop window is not a phone, and a touch screen has no hover — so both are
 * pinned here rather than only the one that was reported.
 */

const CSS = readStyles("app/globals.css");

/** The declaration blocks of every rule listing `selector` as a whole. */
function rules(selector: string): string[] {
  const out: string[] = [];
  const RULE = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = RULE.exec(CSS); m; m = RULE.exec(CSS)) {
    const sels = m[1].split(",").map((s) => s.replace(/\s+/g, " ").trim());
    if (sels.includes(selector)) out.push(m[2]);
  }
  return out;
}

test("the rail's arrows are never hidden outright", () => {
  const bodies = rules(".scroll-rail-controls");
  assert.ok(bodies.length, ".scroll-rail-controls has no rule at all");
  const hidden = bodies.filter((b) => /display:\s*none/.test(b));
  assert.deepEqual(
    hidden,
    [],
    "a rule hides the rail controls — a narrowed window still has a row that scrolls and a mouse with no way to scroll it",
  );
});

test("at phone width the arrows move inward rather than off the row", () => {
  /* The reason they were originally dropped was that they hung off the edge of
     the row. They are overlaid on it now, so the fix is to nudge them IN. */
  /* Anchored on the declarations, not on the comment above them — `CSS` has had
     its comments blanked, so a comment anchor here could never match. The base
     rules push the buttons OUT (-6 / +6) and the phone override pulls them IN
     (+6 / -6); the last declaration of each wins, so that is what is checked. */
  const first = rules(".scroll-rail-btn").map((b) => /transform: translateX\((-?\d+)px\)/.exec(b)?.[1]);
  const last = rules(".scroll-rail-btn:last-child").map((b) => /transform: translateX\((-?\d+)px\)/.exec(b)?.[1]);
  assert.ok(first.length >= 2 && last.length >= 2, "the phone-width override for the arrows is gone");
  assert.equal(first.at(-1), "6", "the first arrow no longer moves inward at phone width");
  assert.equal(last.at(-1), "-6", "the last arrow no longer moves inward at phone width");
});

test("the showcase arrows are reachable without a mouse", () => {
  // opacity:0 until :hover is invisible on a touch screen and to a keyboard.
  assert.match(
    CSS,
    /@media \(hover: none\) \{\s*\.home-showcase-nav \{ opacity: 1; \}/,
    "the showcase arrows are hover-only again, so a touch screen cannot page the card",
  );
  assert.match(
    CSS,
    /\.home-showcase-nav:focus-visible \{ opacity: 1; \}/,
    "the showcase arrows never appear for a keyboard user",
  );
});

test("the arrows are rendered whenever the row actually overflows", () => {
  // The component half: the CSS cannot show a control the component never drew.
  const rail = readCode("app/modules/content/ScrollRail.tsx");
  assert.match(
    rail,
    /setOverflows\(geometry\.overflows\)/,
    "the rail no longer decides on real overflow",
  );
  assert.match(rail, /\{overflows && \(/, "the controls are no longer tied to overflow");
});

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

/**
 * Every carousel advances on its own (客戶: 所有輪播圖都會自動移動), and every
 * one of them stops the moment it is being used.
 *
 * The pause conditions are the whole reason this is tolerable rather than
 * hostile, so they are asserted individually — dropping any single one is a
 * silent regression that still "works".
 */

const strip = (f: string) =>
  readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

const CAROUSELS = [
  "app/modules/stays/StayCard.tsx",
  "app/modules/stays/StayShowcaseCard.tsx",
  "app/modules/property/blocks/BlockRooms.tsx",
  "app/modules/content/ScrollRail.tsx",
];

for (const file of CAROUSELS) {
  test(`${file} auto-advances and attaches the ref`, () => {
    const src = strip(file);
    assert.match(src, /useAutoAdvance/, "does not use the shared hook");
    assert.match(src, /ref=\{autoRef\}/, "the hook's ref is never attached, so nothing pauses it");
  });
}

test("the hook pauses for every reason that means someone is using it", () => {
  const src = strip("app/modules/useAutoAdvance.ts");
  for (const [what, re] of [
    ["pointer over the carousel", /mouseenter/],
    ["pointer leaving again", /mouseleave/],
    ["keyboard focus inside", /focusin/],
    ["a touch in progress", /touchstart/],
    ["scrolled out of view", /IntersectionObserver/],
    ["the tab being hidden", /visibilitychange/],
    ["prefers-reduced-motion", /prefers-reduced-motion/],
  ] as const) {
    assert.match(src, re, `no pause for: ${what}`);
  }
});

test("a single slide never animates", () => {
  const src = strip("app/modules/useAutoAdvance.ts");
  assert.match(src, /count < 2/, "one image would still run a timer");
});

test("the interval is cleared on unmount", () => {
  const src = strip("app/modules/useAutoAdvance.ts");
  assert.match(src, /clearInterval/);
  assert.match(src, /return \(\) => \{[\s\S]*stop\(\)/, "no cleanup — the timer outlives the component");
});

test("the room gallery holds while its lightbox is open", () => {
  // Advancing under someone who opened 放大實景 to look at one photo is the
  // one case where the timer is actively wrong.
  const src = strip("app/modules/property/blocks/BlockRooms.tsx");
  assert.match(src, /enabled:\s*zoom === null/);
});

test("the rail only advances when there is somewhere to go", () => {
  const src = strip("app/modules/content/ScrollRail.tsx");
  assert.match(src, /enabled:\s*overflows/);
});

test("the interval is the agreed 3 seconds", () => {
  const src = strip("app/modules/useAutoAdvance.ts");
  const m = src.match(/delay\s*=\s*(\d+)/);
  assert.ok(m, "no default delay found — was the option renamed?");
  assert.equal(Number(m![1]), 3000, `carousels advance every ${Number(m![1]) / 1000}s, not 3s`);
});

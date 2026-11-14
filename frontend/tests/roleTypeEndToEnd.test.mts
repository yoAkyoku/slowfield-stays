import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readStyles } from "./readCode";
import { blockStyle } from "../app/modules/blockStyle.ts";

/**
 * The chain, checked end to end: what the admin stores → what the style layer
 * emits → what the stylesheet actually reads.
 *
 * Each half of this was built and tested on its own, and both halves passed
 * while the join had a hole: `--r-cta-align` was emitted by the style layer and
 * read by no rule in the stylesheet, so a CTA alignment chosen in the admin did
 * nothing at all. Neither side's tests could see it — the emitter was correct,
 * the CSS was correct, and the pair was not.
 *
 * So this file asserts the join and nothing else: every variable the emitter
 * can produce must appear as `var(--name,` somewhere in globals.css. It fails
 * the moment a new role property is added on one side only.
 */

const CSS = readStyles("app/globals.css");

/** A config that turns on every property of every role. */
const FULL = {
  _type: {
    eyebrow: { align: "left", font: "ui", size: "12px", weight: 600, color: "#c81400" },
    title: { align: "center", font: "title", size: "clamp(28px,5vw,64px)", weight: 700, color: "#101010" },
    body: { align: "right", font: "body", size: "22px", weight: 400, color: "#333333" },
    cta: { align: "center", font: "ui", size: "18px", weight: 700, color: "#8b6a43" },
  },
};

function emittedVariables(): string[] {
  const style = blockStyle(FULL) ?? {};
  return Object.keys(style).filter((k) => k.startsWith("--r-"));
}

test("the emitter produces a variable for every role property", () => {
  const vars = emittedVariables();
  // 4 roles × 5 properties, plus the CTA's flex-mapped alignment.
  assert.equal(vars.length, 21, `expected 21 variables, got ${vars.length}: ${vars.join(", ")}`);
});

test("every emitted variable is read by the stylesheet", () => {
  const unread = emittedVariables().filter((name) => !CSS.includes(`var(${name},`));
  assert.deepEqual(
    unread,
    [],
    `these variables are written to the page and never read, so the setting behind them does nothing: ${unread.join(", ")}`,
  );
});

test("no role variable is read by a :hover rule", () => {
  // Threading a role colour through a hover state means setting the colour
  // silently disables the hover change — the control would turn off an
  // interaction as a side effect. Caught on .content-detail-cta:hover and
  // .home-news-card:hover .home-news-more when the CTA rules were wired.
  const offenders: string[] = [];
  const re = /([^{}]*:hover[^{}]*)\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(CSS))) {
    if (/var\(--r-[a-z-]+,/.test(m[2])) offenders.push(m[1].trim().replace(/\s+/g, " ").slice(0, 80));
  }
  assert.deepEqual(offenders, [], `hover rules reading a role variable: ${offenders.join(" | ")}`);
});

test("a block with no type settings emits no role variables at all", () => {
  // The whole no-op guarantee rests on this: nothing emitted means every
  // fallback in the stylesheet applies, and the page is byte-identical.
  for (const config of [{}, { _type: {} }, { _type: { title: {} } }, { _bgColor: "#ffffff" }]) {
    const style = blockStyle(config) ?? {};
    const roleVars = Object.keys(style).filter((k) => k.startsWith("--r-"));
    assert.deepEqual(roleVars, [], `${JSON.stringify(config)} emitted ${roleVars.join(", ")}`);
  }
});

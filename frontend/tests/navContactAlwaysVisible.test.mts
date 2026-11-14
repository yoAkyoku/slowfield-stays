import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readStyles, readCode } from "./readCode";

/**
 * 聯絡我們 never drops out of the main nav.
 *
 * The header thins its inline links from the right as it narrows. 聯絡我們 is
 * pinned last, so it was always the first casualty: `display: none` on every
 * screen under 1200px — most laptops. The client asked for it in the nav twice,
 * the link was added, and it was invisible both times.
 *
 * It is now marked `data-nav-keep` in SiteHeaderClient and every rung of the
 * ladder skips it, so the link that gives way is the one to its left instead.
 */

const CSS = readStyles("app/globals.css");
const HEADER = readCode("app/(site)/SiteHeaderClient.tsx");

/** Every rung of the progressive-hide ladder. */
const RUNGS = CSS.split("\n").filter(
  (l) => l.includes(".header-nav a:nth-child") && l.includes("display: none"),
);

test("the contact link is marked so the ladder can skip it", () => {
  assert.match(HEADER, /data-nav-keep=\{n\.key === "contact" \? "" : undefined\}/);
});

test("every rung of the ladder exempts it", () => {
  assert.ok(RUNGS.length >= 6, `expected the full ladder, found ${RUNGS.length} rungs`);
  for (const rung of RUNGS) {
    assert.match(
      rung,
      /:not\(\[data-nav-keep\]\)/,
      `a rung hides links without exempting the kept one:\n  ${rung.trim()}`,
    );
  }
});

test("the ladder still thins the nav — the exemption is not a blanket disable", () => {
  // If someone "fixed" this by deleting the rules, the header would overflow
  // on a narrow laptop, which is the bug the ladder exists to prevent.
  assert.ok(RUNGS.length >= 6, "the progressive-hide ladder has gone missing");
});

test("the first rung is not tighter than the nav actually needs", () => {
  // Measured on the live 7-link parent nav: all seven fit at 1210px with 97px
  // of slack. A rung at 1200 dropped a link ~85px before anything was tight.
  const first = RUNGS.find((l) => l.includes("nth-child(n+6)"));
  assert.ok(first, "no n+6 rung found");
  const width = Number(first!.match(/max-width:\s*(\d+)px/)?.[1]);
  assert.ok(width <= 1160, `first rung at ${width}px drops a link too early`);
});

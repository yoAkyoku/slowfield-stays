import assert from "node:assert/strict";
import test from "node:test";
import { overlapsInteractiveTarget } from "../app/modules/interactiveTargetGeometry.ts";
import { readCode, readStyles } from "./readCode.mts";

test("the back-to-top control yields when it covers an interactive target", () => {
  const fab = { left: 560, right: 604, top: 560, bottom: 604 };
  assert.equal(overlapsInteractiveTarget(fab, { left: 570, right: 630, top: 580, bottom: 620 }), true);
  assert.equal(overlapsInteractiveTarget(fab, { left: 610, right: 650, top: 580, bottom: 620 }), false);
  assert.equal(overlapsInteractiveTarget(fab, { left: 600, right: 630, top: 600, bottom: 630 }), false);
});

test("the back-to-top control checks page controls and modal actions", () => {
  const component = readCode("app/modules/ScrollToTopFab.tsx");
  assert.match(component, /\[aria-modal="true"\], dialog\[open\]/);
  assert.match(component, /overlapsInteractiveTarget\(controlRect, rect\)/);
  assert.match(component, /visibility: "hidden"/);
});

test("rail card borders are included in the full-column width", () => {
  const styles = readStyles("app/globals.css");
  assert.match(styles, /\.is-rail > \* \{[^}]*box-sizing:\s*border-box;[^}]*min-width:\s*0;/s);
});

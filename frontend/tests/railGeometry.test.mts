import assert from "node:assert/strict";
import test from "node:test";
import { railGeometry } from "../app/modules/content/railGeometry.ts";

const cards = (count: number, width: number, gap: number, origin = 0) => Array.from({ length: count }, (_, i) => ({ left: origin + i * (width + gap), width }));

test("responsive rail arrows use the actual gap at each viewport", () => {
  for (const gap of [14, 17.28, 22]) {
    const metrics = railGeometry(cards(9, 320, gap), 3, 900, gap);
    assert.ok(Math.abs(metrics.step - (320 + gap)) < 0.001);
    assert.ok(Math.abs(metrics.period - 3 * (320 + gap)) < 0.001);
  }
});

test("loop copies do not keep looping enabled when the original set fits", () => {
  const metrics = railGeometry(cards(6, 240, 14), 2, 900, 14);
  assert.equal(metrics.overflows, false);
  assert.equal(railGeometry(cards(6, 240, 14), 2, 450, 14).overflows, true);
});

test("loop period is invariant to scrolling and lands on the repeated first card", () => {
  const before = railGeometry(cards(12, 267.5, 18.5), 4, 900, 18.5);
  const scrolled = railGeometry(cards(12, 267.5, 18.5, -1377.25), 4, 900, 18.5);
  assert.deepEqual(scrolled, before);
  assert.equal(before.period, 1144);
});

test("empty and single-card rails do not report artificial overflow", () => {
  assert.deepEqual(railGeometry([], 0, 390, 14), { overflows: false, step: 0, period: 0 });
  assert.equal(railGeometry(cards(1, 358, 14), 1, 358, 14).overflows, false);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  SLIDE_DURATION_MS, SLIDE_MAX_SECONDS, SLIDE_MIN_SECONDS,
  isHonouredSlideSeconds, slideMs,
} from "../app/modules/slideTiming.ts";

/**
 * 輪播秒數 must not be discarded in silence.
 *
 * A client set it to 1. It saved — production held
 * `{"titleColor":"#ffffff","images":[],"slide_seconds":1}` — and the carousel
 * went on running at 6.5s, because slideMs accepts 2–30 and returns the default
 * for anything else. The editor's box carries `min={2}`, but an HTML `min`
 * drives validation UI and does not stop a value being stored. So the setting
 * was reported as broken when it had in fact been thrown away on arrival.
 *
 * The bounds now have one definition that both sides import, and
 * `isHonouredSlideSeconds` is what the editor asks before telling the client
 * their number will be ignored.
 */

test("the bounds are the ones the renderer enforces", () => {
  assert.equal(SLIDE_MIN_SECONDS, 2);
  assert.equal(SLIDE_MAX_SECONDS, 30);
});

test("the value that was reported as broken is reported as ignored", () => {
  // The exact number from the live site.
  assert.equal(isHonouredSlideSeconds(1), false);
  assert.equal(slideMs(1), SLIDE_DURATION_MS, "1 second would spin the carousel; the default is correct");
});

test("blank means 'use the default', not an error", () => {
  /* Clearing the box is how a client goes back to 6.5s. Flagging it would put a
     warning under an empty field. */
  for (const blank of ["", "   ", null, undefined, []]) {
    assert.equal(isHonouredSlideSeconds(blank), true, `${JSON.stringify(blank)} should not be flagged`);
  }
  assert.equal(slideMs(""), SLIDE_DURATION_MS);
});

test("the two functions agree on every boundary", () => {
  /* The point of exporting the bounds: a value the box accepts must be a value
     the carousel honours. Asserted as a pair so they cannot drift apart. */
  for (const v of [2, 2.5, 6.5, 15, 29.5, 30]) {
    assert.equal(isHonouredSlideSeconds(v), true, `${v} should be accepted`);
    assert.notEqual(slideMs(v), SLIDE_DURATION_MS === Math.round(v * 1000) ? -1 : SLIDE_DURATION_MS,
      `${v} was accepted by the box and then discarded`);
    assert.equal(slideMs(v), Math.round(v * 1000));
  }
  for (const v of [0, 1, 1.9, 30.1, 31, 100, -5]) {
    assert.equal(isHonouredSlideSeconds(v), false, `${v} should be flagged`);
    assert.equal(slideMs(v), SLIDE_DURATION_MS, `${v} was flagged but then honoured anyway`);
  }
});

test("something that is not a number at all is flagged, not thrown", () => {
  // This arrives from stored JSON as well as from the box.
  /* `[]` is deliberately NOT in this list: String([]) is "", so it reads as
     blank — unset — and both functions agree it means "use the default". That
     is the right answer for a value arriving from stored JSON, and flagging it
     would put a warning under a field the client sees as empty. */
  for (const junk of ["abc", "1e9999", {}, NaN]) {
    assert.equal(isHonouredSlideSeconds(junk), false, `${JSON.stringify(junk)} should be flagged`);
    assert.equal(slideMs(junk), SLIDE_DURATION_MS);
  }
});

test("a string from the number input behaves like the number", () => {
  // <input type="number"> hands back a string.
  assert.equal(isHonouredSlideSeconds("3"), true);
  assert.equal(slideMs("3"), 3000);
  assert.equal(isHonouredSlideSeconds("1"), false);
});

import assert from "node:assert/strict";
import test from "node:test";

/**
 * Run with: npm test  (node --test, no test framework dependency)
 *
 * The reference-counted scroll lock, exercised through a minimal `document`
 * stand-in — the hook itself needs React, but the counting is where the bug was
 * and it is plain logic.
 *
 * Ten of the eleven scroll locks in this app reset `body.style.overflow` to `""`
 * on close instead of to whatever it was before. Open a lightbox from a page
 * whose mobile menu already locked the body, close the lightbox, and the page
 * scrolls behind the menu that is still open. Only the lightbox saved the
 * previous value, which is exactly why nobody noticed.
 */

type Body = { style: { overflow: string } };

/** The same algorithm as useOverlay's module-level lock, in isolation. */
function makeLock(body: Body) {
  let count = 0;
  let saved: string | null = null;
  return function acquire() {
    if (count === 0) {
      saved = body.style.overflow;
      body.style.overflow = "hidden";
    }
    count += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      count = Math.max(0, count - 1);
      if (count === 0) {
        body.style.overflow = saved ?? "";
        saved = null;
      }
    };
  };
}

test("one overlay locks and restores what was there before", () => {
  const body: Body = { style: { overflow: "" } };
  const acquire = makeLock(body);
  const release = acquire();
  assert.equal(body.style.overflow, "hidden");
  release();
  assert.equal(body.style.overflow, "");
});

test("a pre-existing overflow value is restored, not blanked", () => {
  // A page that had deliberately set its own value — the old code returned ""
  // and silently discarded it.
  const body: Body = { style: { overflow: "clip" } };
  const acquire = makeLock(body);
  const release = acquire();
  release();
  assert.equal(body.style.overflow, "clip");
});

/** The case that actually broke: a lightbox opened from behind a mobile menu. */
test("closing the inner overlay does not unlock while the outer one is open", () => {
  const body: Body = { style: { overflow: "" } };
  const acquire = makeLock(body);

  const releaseMenu = acquire();
  const releaseLightbox = acquire();
  assert.equal(body.style.overflow, "hidden");

  releaseLightbox();
  assert.equal(body.style.overflow, "hidden", "the menu is still open — the page must stay still");

  releaseMenu();
  assert.equal(body.style.overflow, "", "the last one out restores it");
});

/**
 * React runs effect cleanups twice under StrictMode. Releasing twice would take
 * the count below zero and unlock the page with an overlay still on screen.
 */
test("releasing the same lock twice is not counted twice", () => {
  const body: Body = { style: { overflow: "" } };
  const acquire = makeLock(body);

  const releaseA = acquire();
  const releaseB = acquire();
  releaseA();
  releaseA();
  assert.equal(body.style.overflow, "hidden", "B still holds it");

  releaseB();
  assert.equal(body.style.overflow, "");
});

test("overlays opened and closed in any order still balance", () => {
  const body: Body = { style: { overflow: "auto" } };
  const acquire = makeLock(body);
  const a = acquire();
  const b = acquire();
  const c = acquire();
  a();
  c();
  assert.equal(body.style.overflow, "hidden");
  b();
  assert.equal(body.style.overflow, "auto");
});

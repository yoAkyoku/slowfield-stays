import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";

/**
 * The stay card only speaks when it is spoken to.
 *
 * The card's `aria-live="polite"` region held "Image n of m" and was rewritten
 * on every index change — including the autoplay tick, which fires every 3000ms
 * (useAutoAdvance's default delay). Measured on /stays with the timer running
 * and nobody touching anything, each of the two cards rewrote its region four
 * times in ten seconds; the homepage carries three cards. A screen-reader user
 * was interrupted every second or so to be told about photos changing on their
 * own, which is exactly the announcement a live region is not for: it reports
 * the result of an action, and there was no action.
 *
 * The rule this file pins is about which code path may write it, not about the
 * wording: the reader's own moves arm the announcement, the timer callback
 * disarms it, and the region renders nothing while disarmed.
 */

/* The card renders the region; the flag lives in the shared photo-strip hook
   (useCardGallery), which both stay cards use. */
const SRC = readCode("app/modules/stays/StayCard.tsx");
const HOOK = readCode("app/modules/useCardGallery.ts");

/** The source between `from` and its matching close, brackets balanced. */
function balanced(src: string, from: number, open: string, close: string): string {
  const start = src.indexOf(open, from);
  assert.ok(start !== -1, "no " + open + " after offset " + from);
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === open) depth++;
    else if (src[i] === close) {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  assert.fail("unbalanced " + open + " from offset " + start);
}

/** What the card's live region renders: between its opening tag and </div>. */
function liveChildren(): string {
  const at = SRC.indexOf('aria-live="polite"');
  assert.ok(at !== -1, "the card no longer has a polite live region");
  const end = SRC.indexOf("</div>", at);
  assert.ok(end !== -1, "the live region is not a div any more");
  const region = SRC.slice(SRC.lastIndexOf("<", at), end);
  return region.slice(region.indexOf(">") + 1).trim();
}

test("the live region says nothing unless a reader asked for it", () => {
  const children = liveChildren();
  /* One expression and nothing else. A guard with any text beside it announces
     on every render regardless — the guard would be decoration. */
  assert.ok(
    children.startsWith("{") && children.endsWith("}"),
    "the live region renders something outside its guard:\n" + children,
  );
  const split = /^userDriven\s*\?([\s\S]*?):([\s\S]*)$/.exec(children.slice(1, -1).trim());
  assert.ok(split, "the live region's only child is not a `userDriven ? … : …` choice:\n" + children);
  const [, announced, silent] = split;
  assert.match(announced, /activeIndex/, "the branch taken after a click does not name the image being shown");
  // The silent branch is what lets the region fall quiet once the timer takes over.
  assert.match(silent.trim(), /^("" *|'' *|`` *)$/, "the branch taken while autoplay runs is not empty, so the last announcement stays behind");
  assert.match(HOOK, /userDriven:\s*userDrivenRef\.current/, "the hook no longer reports whether the reader drove the change");
});

test("the autoplay tick disarms it and the reader's moves arm it", () => {
  const autoplay = balanced(HOOK, HOOK.indexOf("useAutoAdvance("), "(", ")");
  assert.ok(autoplay.includes("setSelectedIndex"), "useAutoAdvance no longer advances the index — check this test");
  assert.match(autoplay, /userDrivenRef\.current\s*=\s*false/, "the autoplay callback does not disarm the announcement, so every tick is spoken again");
  assert.doesNotMatch(autoplay, /userDrivenRef\.current\s*=\s*true/, "the autoplay callback arms the announcement");
  /* step() is what the arrows and the swipe call; select() is what the dots call. */
  for (const name of ["step", "select"]) {
    const at = HOOK.indexOf("const " + name + " = ");
    assert.ok(at !== -1, name + "() is gone — the arrows/dots/swipe changed shape");
    assert.match(balanced(HOOK, at, "{", "}"), /userDrivenRef\.current\s*=\s*true/, name + "() does not arm the announcement, so using the control says nothing");
  }
});

test("nothing else writes the flag", () => {
  /* A third writer would put the flag out of step with the index it describes. */
  const writes = [...HOOK.matchAll(/userDrivenRef\.current\s*=/g)].length;
  assert.equal(writes, 3, "expected exactly 3 writes (step, select, the timer) but found " + writes);
  assert.doesNotMatch(SRC, /userDrivenRef/, "the card writes the flag itself again");
});

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
 * wording: the two click handlers arm the announcement, the timer callback
 * disarms it, and the region renders nothing while disarmed.
 */

const SRC = readCode("app/modules/stays/StayCard.tsx");

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

/** The JSX element carrying aria-live, from its opening `<` to its close. */
function liveRegion(): string {
  const at = SRC.indexOf('aria-live="polite"');
  assert.ok(at !== -1, "the card no longer has a polite live region");
  const open = SRC.lastIndexOf("<", at);
  const end = SRC.indexOf("</div>", at);
  assert.ok(end !== -1, "the live region is not a div any more");
  return SRC.slice(open, end);
}

/** What the live region actually renders: everything between the end of its
 *  opening tag and its closing tag. */
function liveChildren(): string {
  const region = liveRegion();
  const gt = region.indexOf(">");
  assert.ok(gt !== -1, "the live region's opening tag is unterminated");
  return region.slice(gt + 1).trim();
}

/** The name of the flag the live region's content is conditional on. */
function gate(): string {
  const region = liveRegion();
  const match = /\{\s*([A-Za-z_$][\w$]*)\.current\s*\?/.exec(region);
  assert.ok(
    match,
    "the live region's content is not conditional on anything — it writes on every render, autoplay included:\n" + region,
  );
  return match[1];
}

test("the live region says nothing unless a reader asked for it", () => {
  const flag = gate();
  const children = liveChildren();

  /* One expression and nothing else. A guard with any text beside it announces
     on every render regardless — the guard would be decoration. */
  assert.ok(
    children.startsWith("{") && children.endsWith("}"),
    "the live region renders something outside its guard, which is announced whatever the guard says:\n" + children,
  );
  const inner = children.slice(1, -1).trim();
  const split = new RegExp("^" + flag + "\\.current\\s*\\?([\\s\\S]*?):([\\s\\S]*)$").exec(inner);
  assert.ok(split, "the live region's only child is not a `" + flag + ".current ? … : …` choice:\n" + inner);

  const [, announced, silent] = split;
  assert.match(
    announced,
    /activeIndex/,
    "the branch taken after a click does not name the image being shown",
  );
  // The silent branch matters as much as the guard: it is what lets the region
  // fall quiet again once the timer takes over.
  assert.match(
    silent.trim(),
    /^("" *|'' *|`` *)$/,
    "the branch taken while autoplay is running is not empty, so the last announcement stays behind and can be re-read",
  );
});

test("the autoplay tick disarms it and the click handlers arm it", () => {
  const flag = gate();

  const autoplay = balanced(SRC, SRC.indexOf("useAutoAdvance("), "(", ")");
  assert.ok(autoplay.includes("setActiveIndex"), "useAutoAdvance no longer advances the index — check this test");
  assert.match(
    autoplay,
    new RegExp(flag + "\\.current\\s*=\\s*false"),
    "the autoplay callback does not disarm the announcement, so every 3s tick is spoken again",
  );
  assert.doesNotMatch(
    autoplay,
    new RegExp(flag + "\\.current\\s*=\\s*true"),
    "the autoplay callback arms the announcement",
  );

  const arms = (text: string) => new RegExp(flag + "\\.current\\s*=\\s*true").test(text);

  for (const handler of ["move", "selectImage"]) {
    const at = SRC.indexOf("function " + handler + "(");
    assert.ok(at !== -1, handler + "() is gone — the dots/arrows changed shape");
    const body = balanced(SRC, at, "{", "}");
    /* One hop through a local function, because `move` now delegates to the
       shared `step` that the swipe also goes through — the arming moved there
       with it. Reading only the handler's own body would report that as a
       regression when the announcement is armed exactly as before; what the
       invariant is about is the control arming it, not which line does. */
    const delegates = [...body.matchAll(/\b([a-z][\w$]*)\s*\(/g)]
      .map((m) => m[1])
      .filter((name) => SRC.includes("function " + name + "("))
      .map((name) => balanced(SRC, SRC.indexOf("function " + name + "("), "{", "}"));
    assert.ok(
      arms(body) || delegates.some(arms),
      handler + "() does not arm the announcement, so using the control says nothing",
    );
  }
});

test("nothing else writes the flag", () => {
  /* A third writer would put the two states out of step with the index they
     describe. Only the three call sites above may set it. */
  const flag = gate();
  const writes = [...SRC.matchAll(new RegExp(flag + "\\.current\\s*=", "g"))].length;
  assert.equal(writes, 3, "expected exactly 3 writes (move, selectImage, the timer) but found " + writes);
});

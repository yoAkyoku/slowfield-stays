import assert from "node:assert/strict";
import test from "node:test";
import { safeCssColor, safeLength } from "../app/modules/fontPresets.ts";
import { safeAnchor } from "../app/modules/blockStyle.ts";

/**
 * A stored value must not be able to break out of its own declaration.
 *
 * Not into script — React escapes the attribute, and none of these sanitisers
 * has ever admitted a quote or a semicolon. The reachable damage is quieter and
 * was live: **an unterminated token swallows every declaration after it.**
 *
 * `roleTypeVars` writes twenty custom properties into one style attribute in a
 * fixed order — eyebrow, then title, then body, then cta. Measured in a browser:
 *
 *   style="--r-eyebrow-color:rgb(0,0,0;--r-title-color:blue;--r-body-size:12px"
 *   → --r-title-color and --r-body-size both compute to nothing
 *
 * The CSS tokenizer consumes an unclosed function to end-of-input, and an
 * unterminated `/*` comment does the same. So one mistyped colour in the FIRST
 * role silently voided the other three panels — indistinguishable, from the
 * editor, from the controls simply not working. That is the exact complaint this
 * whole change set exists to answer, arriving through the back door.
 *
 * `safeCssColor` allowed both: `rgb` is an allow-listed function name and
 * nothing counted parens, and `/` and `*` are in the character class because
 * calc() needs them.
 */

test("an unclosed function never reaches a declaration", () => {
  for (const v of ["rgb(0,0,0", "color-mix(in srgb, red", "calc(("]) {
    assert.equal(safeCssColor(v), "", `safeCssColor accepted ${v}`);
  }
  for (const v of ["calc(()", "clamp(1px, calc(2px", "clamp(16px, 2vw, 24px"]) {
    assert.equal(safeLength(v), "", `safeLength accepted ${v}`);
  }
  // …and a stray closer is not "balanced" either.
  assert.equal(safeCssColor("rgb(0,0,0))"), "");
});

test("a CSS comment never reaches a declaration", () => {
  for (const v of ["red/*", "red/*x", "rgb(0,0,0)/* ", "*/red"]) {
    assert.equal(safeCssColor(v), "", `safeCssColor accepted ${v}`);
  }
  /* BOTH sanitisers. The first version of this test asked only safeCssColor,
     and safeLength had no comment guard at all — `calc(1px/*)` round-tripped
     and voided every declaration after it in the attribute, which is the exact
     failure this file's preamble describes. A test that covers one of two
     doors is how the second one stays open. */
  for (const v of ["calc(1px/*)", "calc(/*)", "clamp(1px,2px/*,3px)", "calc(1px*/)"]) {
    assert.equal(safeLength(v), "", `safeLength accepted ${v}`);
  }
  /* A comment between a function's name and its paren splits the token, so
     neither the blocklist nor the allow-list sees a call — the comment guard is
     the only thing that stops it. */
  assert.equal(safeLength("calc(url" + "/*" + "*/" + "(x))"), "");
});

test("safeLength names the functions it allows rather than listing ones it does not", () => {
  /* The guard was `if (/(url|image|element|expression|attr|var)\s*\(/)` — a
     blocklist, and one that had already been walked around: `image\s*\(` does
     not match `image-set(`, because the hyphen intervenes. None of these could
     fetch anything today (no `:` and no quotes, so no URL can be spelled), but a
     blocklist in front of an allow-list that admits arbitrary `a-z` is one new
     CSS function away from mattering. */
  for (const v of [
    "clamp(1px,image-set(a.png),2px)",
    "clamp(1px,src(a),2px)",
    "clamp(1px,paint(a),2px)",
    "clamp(1px,url(x),2px)",
    "calc(1px + attr(x))",
  ]) {
    assert.equal(safeLength(v), "", `safeLength accepted ${v}`);
  }
});

test("the values an editor actually types still survive", () => {
  // A sanitiser that rejects everything is not a fix.
  for (const v of ["#8b6a43", "rgb(139, 106, 67)", "red", "transparent", "color-mix(in srgb, red 50%, blue)"]) {
    assert.equal(safeCssColor(v), v, `safeCssColor rejected the legitimate ${v}`);
  }
  /* The units are wider than px/rem/em now: `%` because safeTypeLength behind
     基準字級 has always taken it and one panel rejecting what the other accepts
     is its own bug, `vw`/`vh` because the file's own clamps are written in them,
     and four digits so 1000px is a size rather than an error. */
  for (const v of ["18px", "1.4rem", "2.5vw", "50%", "1000px", "clamp(16px, 2vw, 24px)", "calc(100% - 20px)", "min(24px, 5vw)"]) {
    assert.equal(safeLength(v), v, `safeLength rejected the legitimate ${v}`);
  }
});

test("a 區塊標記 is fit to be an element id", () => {
  /* It lands in `id=` and is also the fragment a menu link jumps to. It was
     passed through on a `typeof === "string"` check alone — the only completely
     unguarded config→DOM path in blockStyle. */
  /* 關於 and 1f-lobby are the point. An earlier version required
     `[A-Za-z][-\w:.]*`, and `\w` is ASCII-only — so a Traditional-Chinese 區塊標記,
     the obvious thing to type in a zh-Hant CMS, was dropped, along with anything
     starting with a digit. Both are valid HTML5 ids, both were accepted by the
     check this replaced, and both therefore already exist in stored configs with
     menu links pointing at them. */
  for (const v of ["about", "our-story", "sec_1", "A.b:c", "關於", "1f-lobby", "區塊-1"]) {
    assert.equal(safeAnchor(v), v, `rejected the legitimate ${v}`);
  }
  /* Only what actually breaks: whitespace (an id cannot hold it), the fragment
     and markup characters, and a backslash. */
  for (const v of ["", "  ", "has space", "quote\"", "<script>", "#hash", "a/b", "x&y", "a".repeat(65), 42, null, undefined, {}]) {
    assert.equal(safeAnchor(v as unknown), undefined, `accepted ${String(v)}`);
  }
  // Trimmed, not rejected, so a stray space either side is forgiving.
  assert.equal(safeAnchor("  about  "), "about");
  /* Counted in CHARACTERS, matching the editor's own
     `Array.from(v).slice(0, 64)` — which truncates that way so it never leaves
     half an astral character behind, and 64 of those is 128 code units.
     Counting units here would reject exactly what the editor had just
     produced. */
  const astral = "\u{20BB7}";
  assert.equal(safeAnchor(astral.repeat(64)), astral.repeat(64), "64 astral characters were rejected as 128 units");
  assert.equal(safeAnchor(astral.repeat(65)), undefined, "the character cap is not enforced");
  /* And the half-character the old truncation produced must still be refused if
     it ever reaches here from stored config. */
  assert.equal(safeAnchor(`${"a".repeat(63)}\uD842`), undefined, "a lone surrogate reaches the id attribute");
});

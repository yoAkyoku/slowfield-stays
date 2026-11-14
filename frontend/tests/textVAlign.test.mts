import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readStyles } from "./readCode";
import { blockStyle } from "../app/modules/blockStyle.ts";

/**
 * Where the copy sits against the picture in a side-by-side block.
 *
 * Three layouts had grown three different answers — 關於 centred its column,
 * the villa split centred its grid items, a paired block stretched them — so
 * the same intent produced a different result depending on which layout the
 * author reached for (客戶: 所有 block 的文字需要與圖片高度對齊，無論哪種版面).
 *
 * Two things have to hold for the control to mean anything:
 *   - the value that reaches the page is one of ours, never the stored string;
 *   - every layout reads the same variable, with the same default.
 *
 * A note for whoever measures this next: the alignment must be checked against
 * the `img`, not against `.block-about-media`. The container is full-bleed and
 * the picture is inset ~64px inside it, so measuring the container reports an
 * 89px misalignment that is not on the screen. That mistake was made here once
 * and "fixed" a block that was already aligned to within 4px.
 */

const CSS = readStyles("app/globals.css");
const VAR = "--block-text-valign";

test("only the three known positions reach the page", () => {
  assert.equal(blockStyle({ _textVAlign: "top" })?.[VAR as never], "flex-start");
  assert.equal(blockStyle({ _textVAlign: "center" })?.[VAR as never], "center");
  assert.equal(blockStyle({ _textVAlign: "bottom" })?.[VAR as never], "flex-end");
});

test("anything else is dropped rather than written into the style attribute", () => {
  for (const bad of [
    "flex-start",           // a raw CSS value is not a key we issued
    "center;color:red",
    "url(x)",
    "expression(1)",
    "",
    " top",
    "TOP",
    null,
    undefined,
    42,
    {},
    /* The four that actually got through. The map is a plain object literal, so
       a bare lookup resolved these on Object.prototype and `??` does not catch a
       function — `--block-text-valign: function Object() { [native code] }` was
       written into the style attribute. `{}` was in this list all along and does
       not exercise it: String({}) is "[object Object]", which is not a key. */
    "constructor",
    "toString",
    "valueOf",
    "hasOwnProperty",
    "__proto__",
  ]) {
    const style = blockStyle({ _textVAlign: bad as unknown });
    // With nothing else set, an unrecognised value must not even create a style
    // object — that is what keeps it out of the attribute entirely.
    assert.equal(style, undefined, `accepted: ${String(bad)}`);
  }
});

test("an unknown position does not suppress the other settings", () => {
  // The guard is on the one value, not on the whole block: a bad valign must
  // not take a legitimate background colour down with it.
  const style = blockStyle({ _textVAlign: "sideways", _bgColor: "#ffffff" });
  assert.ok(style, "the rest of the style was dropped along with the bad value");
  assert.equal(style?.[VAR as never], undefined);
  assert.match(String(style?.backgroundColor), /^rgba\(255, 255, 255/);
});

test("all three side-by-side layouts read the same variable", () => {
  // .block-about-copy drives a flex column, the villa split drives a grid, and
  // both must spend the same variable or the control means something different
  // depending on which layout is on screen.
  const about = /\.block-about-copy \{[\s\S]*?\}/.exec(CSS)?.[0] ?? "";
  assert.match(about, new RegExp(`justify-content:\\s*var\\(${VAR}`), "關於 layout does not read the variable");

  const split = /\.property-rich-split \{[\s\S]*?\}/.exec(CSS)?.[0] ?? "";
  assert.match(split, new RegExp(`align-items:\\s*var\\(${VAR}`), "villa split layout does not read the variable");
});

test("the default in every layout is the top edge, not centred", () => {
  // 客戶: 文字從圖頂開始往下排. A fallback of `center` in one rule and
  // `flex-start` in another is the inconsistency this replaced.
  const fallbacks = [...CSS.matchAll(new RegExp(`var\\(${VAR},\\s*([a-z-]+)\\)`, "g"))].map((m) => m[1]);
  assert.ok(fallbacks.length >= 3, `expected the variable in at least three rules, found ${fallbacks.length}`);
  for (const fallback of fallbacks) {
    /* `stretch` is allowed beside the top edge, and only because it renders AS
       the top edge. It is the two-block pair, whose columns are whole blocks
       rather than a text column beside a photo: stretched, both columns share
       the row's height and each block's copy still begins at its own top, which
       is what the hint promises. Left at flex-start they would shrink to their
       content instead and a coloured column would go ragged — `stretch` there
       is a deliberate earlier fix for 「從上方小標到最後的文字，要跟旁邊照片的上
       下範圍齊平」. What stays banned is a default that floats the copy off the
       top: `center` and `flex-end`. */
    assert.ok(
      fallback === "flex-start" || fallback === "start" || fallback === "stretch",
      `a layout defaults to "${fallback}" instead of the top edge`,
    );
  }
  assert.ok(
    fallbacks.filter((f) => f === "stretch").length <= 1,
    "more than one layout defaults to stretch — only the two-block pair may",
  );
});

test("the copy and the picture share one vertical padding figure", () => {
  // They were two hand-kept clamps with a comment promising they matched; the
  // promise broke the moment one of them was retuned, and the text stopped
  // sitting on the picture's line.
  const about = /\.block-about \{[\s\S]*?\}/.exec(CSS)?.[0] ?? "";
  assert.match(about, /--about-pad-y:/, "no shared vertical padding variable");
  for (const rule of [".block-about-copy", ".block-about-media"]) {
    const body = new RegExp(`\\${rule} \\{[\\s\\S]*?\\}`).exec(CSS)?.[0] ?? "";
    assert.match(body, /padding:[^;]*var\(--about-pad-y\)/, `${rule} keeps its own copy of the figure`);
  }
});

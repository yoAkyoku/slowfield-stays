import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";
import { callArguments, evaluateExpression, jsxTags } from "./sourceEval";
import { blockStyle, isBlockBgColor, paintsOwnBackground } from "../app/modules/blockStyle.ts";

/**
 * One block, one background, one control that sets it.
 *
 * NewsletterConfigForm offers its own 背景顏色, writes it to `bg_color`, and
 * deliberately DELETES `_bgColor` on the way past — the band paints itself and
 * chooses its own width (滿版 / 留白置中), so routing its colour through the
 * generic key would hand the wrapper a 100vw strip instead. The generic block
 * inspector offered `_bgColor` anyway, for every block type, and the two UIs
 * disagreed about the same decision.
 *
 * Measured on /admin/preview/block?renderer=home&type=newsletter with
 * `_bgColor: "#ff0000"`, at a 1158px window, before the fix:
 *
 *     .home-block        rgb(255, 0, 0)  1157.6px  width:100vw; margin-left:…
 *     .block-newsletter  rgb(255, 0, 0)  1157.6px  background:#ff0000
 *
 * — painted twice, and the 100vw wrapper is also why the block's own 留白置中
 * could never be seen. After: the wrapper carries no inline style at all and
 * only the band paints, in both the home and the property renderer.
 *
 * The block's own form is the one that knows, so the type is named once, in
 * blockStyle, and the renderer and both inspectors read it from there.
 */

const HOME_EDITOR = "app/admin/(dashboard)/homepage/HomepageBlockEditor.tsx";
const PAGE_EDITOR = "app/admin/(dashboard)/sites/[id]/pages/[pageKey]/PropertyBlockEditor.tsx";
const EDITORS: Array<[string, string]> = [
  ["homepage", HOME_EDITOR],
  ["site page", PAGE_EDITOR],
];

/* ── 1. The renderer ──────────────────────────────────────────────────────── */

test("the wrapper paints no background for a block that paints its own", () => {
  // Run, not read. This is the declaration that produced the doubled band.
  const newsletter = blockStyle({ _bgColor: "#ff0000" }, "newsletter");
  assert.equal(newsletter, undefined, "a newsletter whose only setting is 背景顏色 still gets an inline style");

  // …including a stale key an earlier save left behind, which no form offers to
  // clear any more.
  const withPad = blockStyle({ _bgColor: "#ff0000", _bgOpacity: 40, _padY: 40 }, "newsletter") ?? {};
  assert.equal(withPad.backgroundColor, undefined, "the wrapper still paints a legacy _bgColor on a newsletter");
  assert.equal(withPad.width, undefined, "the 100vw strip is back, so 留白置中 still cannot be seen");
  /* The PROPERTY, not the spelling. 上下留白 now REPLACES the block's own
     vertical space instead of stacking on it (客戶: 改取代), so it is emitted as
     the variables the section padding already reads rather than as an inline
     paddingTop — 「無 (0)」 had been a guaranteed no-op and every other value was
     the editor's number plus the site's. What this test guards is unchanged:
     dropping a self-painting block's background must not drop the rest of its
     styling with it. */
  const padded = withPad as Record<string, unknown>;
  assert.equal(
    padded.paddingTop ?? padded["--block-y"],
    "40px",
    "the rest of the block's styling was thrown out with the background",
  );
});

test("every other block type is untouched", () => {
  /* The half that would make this a regression rather than a fix: the generic
     background is how a rich_text or gallery block gets its colour band. */
  for (const type of ["rich_text", "gallery", "stays", "contact_info", undefined]) {
    const style = blockStyle({ _bgColor: "#ff0000", _bgOpacity: 40 }, type) ?? {};
    assert.equal(style.backgroundColor, "rgba(255, 0, 0, 0.4)", `${type ?? "an untyped block"} lost its background`);
    assert.equal(style.width, "100vw", `${type ?? "an untyped block"} lost its full-bleed colour band`);
  }
});

test("the predicate names the newsletter and nothing else by accident", () => {
  assert.equal(paintsOwnBackground("newsletter"), true, "the newsletter is no longer the block that paints itself");
  for (const type of ["rich_text", "news", "letter", "newsletter_signup", "", "NEWSLETTER"]) {
    assert.equal(paintsOwnBackground(type), false, `「${type}」 is being treated as self-painting`);
  }
  // A hand-edited config reaches here as anything at all; neither side may throw.
  for (const junk of [undefined, null, 42, {}, ["newsletter"]]) {
    assert.equal(paintsOwnBackground(junk), false, `${JSON.stringify(junk)} is accepted as a block type`);
  }
});

/* ── 2. The type has to actually arrive ───────────────────────────────────── */

test("every wrapper hands blockStyle the block's type", () => {
  /* blockStyle cannot ask what type it is looking at, so a wrapper that calls it
     with one argument reinstates the double paint in full while every assertion
     above stays green. The argument list is read from the parsed call, not
     grepped, so a wrapped line or a renamed local is still counted. */
  const wrappers: Array<[string, string]> = [
    ["app/modules/BlockWrapper.tsx", "type"],
    ["app/modules/home/HomepageBlocks.tsx", "type"],
  ];
  for (const [file, expected] of wrappers) {
    const calls = callArguments(file, "blockStyle");
    assert.equal(calls.length, 1, `${file}: expected one blockStyle call, found ${calls.length}`);
    assert.equal(
      calls[0].length,
      2,
      `${file} calls blockStyle(${calls[0].join(", ")}) — with no type it paints a newsletter's background again`,
    );
    assert.equal(calls[0][1], expected, `${file} passes \`${calls[0][1]}\` as the type`);
  }
});

test("and every renderer hands the wrapper the type it has", () => {
  /* The other end of the same wire. Both wrappers take `type` as an optional
     prop, so a caller that forgets it type-checks clean and silently opts the
     whole renderer back into the bug. */
  const callers: Array<[string, string]> = [
    // The shared wrapper's default, used by the villa renderer and PageBlocks.
    ["app/modules/blockPairs.tsx", "BlockWrapper"],
    ["app/modules/home/HomepageBlocks.tsx", "BlockWrapper"],
  ];
  for (const [file, tag] of callers) {
    const uses = jsxTags(file).filter((t) => t.tag === tag);
    assert.ok(uses.length, `${file} no longer renders <${tag}>`);
    for (const use of uses) {
      assert.equal(
        use.attrs.get("type"),
        "block.type",
        `${file}: <${tag}> is rendered without type={block.type} — ${use.text.slice(0, 90)}`,
      );
    }
  }
});

/* ── 3. The inspectors ────────────────────────────────────────────────────── */

/** The guard a Field is offered under, lifted from the editor source. Anchored
 *  on the field's own label so it cannot pick up an unrelated guard, and it
 *  asserts it found one — a renamed label fails here rather than leaving a test
 *  that quietly checks nothing. */
function guardBefore(src: string, pattern: RegExp, what: string): string {
  const m = src.match(pattern);
  assert.ok(m, `${what}: the guard is gone, or the field it guards was renamed`);
  return m![1].replace(/\s+/g, " ").trim();
}

for (const [where, file] of EDITORS) {
  test(`the ${where} inspector withholds 背景顏色 from a self-painting block`, () => {
    const src = readCode(file);
    const expression = guardBefore(
      src,
      /\{([^\n]+?) && \(\n\s*<Field label=\{zh \? "背景顏色"/,
      `${file} 背景顏色`,
    );
    /* Compiled and called. A guard reading the wrong key — `selected.config.type`
       rather than `selected.type` — is the same shape as the right one and a
       regex cannot tell them apart. */
    const gate = evaluateExpression(expression, ["selected", "paintsOwnBackground"]) as (
      ctx: Record<string, unknown>,
    ) => unknown;
    const shown = (type: string) =>
      Boolean(gate({ selected: { type, config: {} }, paintsOwnBackground }));

    assert.equal(shown("newsletter"), false, "the generic 背景顏色 is still offered on the block that paints its own");
    for (const type of ["rich_text", "gallery", "stays", "contact_info"]) {
      assert.equal(shown(type), true, `${type} lost its 背景顏色 control`);
    }
  });

  test(`the ${where} inspector withholds 透明度 from it too`, () => {
    /* A legacy `_bgColor` still sits in some saved newsletter configs, and the
       slider's own guard only asks whether that value is a paintable hex — so
       without this the colour control disappears and the slider that fades it
       stays, fading nothing. */
    const src = readCode(file);
    const expression = guardBefore(
      src,
      /\{([^\n]+?) && \(\n\s*<Field label=\{zh \? "透明度"/,
      `${file} 透明度`,
    );
    const gate = evaluateExpression(expression, ["selected", "isBlockBgColor", "paintsOwnBackground"]) as (
      ctx: Record<string, unknown>,
    ) => unknown;
    const shown = (type: string, config: Record<string, unknown>) =>
      Boolean(gate({ selected: { type, config }, isBlockBgColor, paintsOwnBackground }));

    assert.equal(shown("newsletter", { _bgColor: "#ff0000" }), false, "透明度 survives on a self-painting block");
    assert.equal(shown("rich_text", { _bgColor: "#ff0000" }), true, "透明度 is gone from a block that can use it");
    // The rule it already had stays intact.
    assert.equal(shown("rich_text", {}), false, "透明度 is offered with no colour to fade");
    assert.equal(shown("rich_text", { _bgColor: "red" }), false, "透明度 is offered beside a colour the page drops");
  });

  test(`the ${where} inspector withholds nothing else from a self-painting block`, () => {
    /* 滿版 / 留白置中 IS this panel's to set — it is the setting the double
       paint was defeating — and so are 上下留白, 字體大小 and the rest. Fixing
       the symptom by hiding the whole 版面 group would take away the control the
       client actually uses. The guard belongs on the controls that PAINT the
       surface and on nothing else.

       This was a bare count of 2, which is a proxy for the real rule and went
       red the moment 背景圖片 — a third painter, correctly guarded — was added.
       So each guard is now identified by the control it wraps: an unrelated
       control acquiring the guard still fails, which is what the count was for,
       and a new background control does not.

       Located by looking FORWARD from the guard rather than searching for a
       label. The first draft of this test looked for the string 版面寬度 and
       found it in the fix's own JSX comment 200 characters EARLIER than the
       control — readCode blanks block comments but not JSX comment expressions —
       so it read the guard as wrapping a label it does not wrap, and failed
       against correct source. */
    const src = readCode(file);
    const PAINTERS: Array<[string, RegExp]> = [
      ["背景顏色", /^\s*\(?\s*<Field label=\{zh \? "背景顏色"/],
      ["透明度", /^\s*\(?\s*<Field label=\{zh \? "透明度"/],
      ["背景圖片", /^\s*\(?\s*<BlockBackgroundImage/],
    ];
    const guards = [...src.matchAll(/!paintsOwnBackground\([^)]*\)[^\n]*\n/g)];
    const wrapped = guards.map((m) => {
      const after = src.slice(m.index! + m[0].length);
      const hit = PAINTERS.find(([, re]) => re.test(after));
      return hit ? hit[0] : `something else: ${after.trim().slice(0, 60)}`;
    });
    assert.deepEqual(
      wrapped.sort(),
      PAINTERS.map(([name]) => name).sort(),
      `${file} guards ${guards.length} controls on the block type; each one must be a control that paints the block's surface`,
    );
    // …and the width control it must NOT be one of is still rendered.
    assert.ok(
      src.includes('{zh ? "版面寬度" : "Width"}'),
      `${file}: the 版面寬度 control is gone — the setting the double paint was defeating`,
    );
  });
}

/* ── 4. The block's own form is unchanged ─────────────────────────────────── */

test("the newsletter's own form still owns the colour, and still clears the generic key", () => {
  /* The premise of the whole fix. If NewsletterConfigForm ever started writing
     `_bgColor`, hiding the generic control would take the block's background
     away entirely rather than de-duplicating it. */
  const src = readCode("app/admin/modules/blockForms.tsx");
  const form = src.slice(
    src.indexOf("export function NewsletterConfigForm("),
    src.indexOf("export function", src.indexOf("export function NewsletterConfigForm(") + 40),
  );
  assert.ok(form.length > 500, "NewsletterConfigForm moved — re-anchor this slice");
  assert.ok(form.includes("const { _bgColor, ...rest } = c"), "the form no longer strips the generic background key");
  assert.ok(form.includes("bg_color: v"), "the form no longer writes its colour to bg_color");
  assert.ok(!/_bgColor:\s/.test(form), "the form has started writing _bgColor itself");
});

test("the band still reads the legacy key, so an existing colour is not lost", () => {
  /* Hiding the control does not migrate the data. A newsletter block saved with
     `_bgColor` before this fix keeps its colour because the band reads that key
     too — it is only the WRAPPER that has stopped. Drop this and those blocks
     turn white the day the fix ships. */
  const src = readCode("app/modules/home/blocks/BlockNewsletter.tsx");
  assert.match(
    src,
    /const bgColor =\s*\(typeof c\._bgColor === "string" && c\._bgColor \? c\._bgColor : ""\)/,
    "BlockNewsletter no longer falls back to _bgColor — every block saved with the generic control loses its background",
  );
  assert.ok(src.includes('c.bg_color === "string"'), "BlockNewsletter no longer reads its own bg_color");
});

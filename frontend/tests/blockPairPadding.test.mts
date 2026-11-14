import assert from "node:assert/strict";
import test from "node:test";
import { blockPairStyle } from "../app/modules/blockStyle.ts";
import { readCode } from "./readCode.mts";
import { readFileSync } from "node:fs";
import ts from "typescript";

/** blockPairs.tsx compiled without React, so its pure helpers can be EXECUTED.
 *  Pattern borrowed from composableLayouts.test.mts, which compiles the block
 *  components the same way. */
const PAIRS = (() => {
  const file = "app/modules/blockPairs.tsx";
  const js = ts.transpileModule(readFileSync(file, "utf8"), {
    fileName: file,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
      jsxFactory: "__h",
      jsxFragmentFactory: "__FRAGMENT",
    },
  }).outputText;
  const mod = { exports: {} as Record<string, unknown> };
  const req = (id: string) => {
    if (id === "./blockStyle") return { blockPairStyle: () => undefined, withoutPad: (c: unknown) => c };
    return {};
  };
  new Function("exports", "require", "module", "__h", "__FRAGMENT", js)(
    mod.exports, req, mod, () => null, Symbol("f"),
  );
  return mod.exports as { pairSecondIds: (b: unknown[]) => Set<string> };
})();

test("the editor's idea of a pair's second column matches the renderer's", () => {
  /* The editor withholds 上下留白 there, and it has to withhold it from the
     right block. A hand-rolled "does the previous block set _pairNext" check —
     which is what this replaced — disagrees with renderWithPairs in two ways an
     author can produce from the panel. */
  const B = (id: string, config: Record<string, unknown>, enabled?: boolean) =>
    ({ id, type: "x", enabled, config });
  const ids = (blocks: unknown[]) => [...PAIRS.pairSecondIds(blocks)];

  assert.deepEqual(ids([B("A", { _pairNext: true }), B("B", {})]), ["B"]);
  /* The loop pairs over ENABLED blocks, so a disabled block between them is not
     the second column — the one after it is. */
  assert.deepEqual(
    ids([B("A", { _pairNext: true }), B("B", {}, false), B("C", {})]),
    ["C"],
    "a disabled block was treated as the pair's second column",
  );
  /* Two in a row: A+B are consumed and C renders standalone, so C's padding IS
     read and its control must stay. */
  assert.deepEqual(
    ids([B("A", { _pairNext: true }), B("B", { _pairNext: true }), B("C", {})]),
    ["B"],
    "the block after a consumed pair was treated as a second column",
  );
  // A joined block stacks into the second column; it is not itself one.
  assert.deepEqual(
    ids([B("A", { _pairNext: true }), B("B", {}), B("J", { _pairJoin: true }), B("D", {})]),
    ["B"],
  );
  assert.deepEqual(ids([B("A", {}), B("B", {})]), []);
  // A trailing _pairNext has nothing to pair with.
  assert.deepEqual(ids([B("A", {}), B("B", { _pairNext: true })]), []);
});

/**
 * 上下留白 / 左右留白 reach the box the client is looking at.
 *
 * `.property-block-pair` carried `padding: clamp(48px, 6vw, 80px) clamp(16px,
 * 4vw, 48px)` in the stylesheet and nothing in the admin reached it. Setting
 * both halves of a pair to 0 changed the blocks INSIDE it and left the wrapper
 * at 65.07 / 43.38px on a 1199px screen — measured, and matching those clamps
 * exactly. The setting worked; it worked on something else
 * (客戶: 為何上下和左右留白設定為0 還有那麼多留白?).
 *
 * The values come from the FIRST block's config because that is already the
 * pair's control surface: `_pairNext` forms the pair, and `_pairReverse` and
 * `_pairDirection` are read from the same object.
 */

test("zero means zero", () => {
  // The reported case. `0` is falsy, so a truthiness check here would drop it
  // and leave the stylesheet's clamp in place — the bug, exactly.
  const style = blockPairStyle({ _padY: 0, _padX: 0 });
  assert.deepEqual(style, { paddingTop: "0px", paddingBottom: "0px", paddingLeft: "0px", paddingRight: "0px" });
});

test("a pair nobody has touched keeps the stylesheet's spacing", () => {
  /* undefined, not a zeroed object: the clamp is deliberately matched to a
     standalone block's so that "one block built from two" is spaced like its
     neighbours. Returning a style here would flatten every existing pair. */
  assert.equal(blockPairStyle({}), undefined);
  assert.equal(blockPairStyle({ _pairNext: true, _pairReverse: true }), undefined);
});

test("one axis set leaves the other on the stylesheet", () => {
  assert.deepEqual(blockPairStyle({ _padY: 24 }), { paddingTop: "24px", paddingBottom: "24px" });
  assert.deepEqual(blockPairStyle({ _padX: 12 }), { paddingLeft: "12px", paddingRight: "12px" });
});

test("one value goes to both edges of its axis", () => {
  // A pair can never end up with more space above than below.
  const style = blockPairStyle({ _padY: 40, _padX: 16 })!;
  assert.equal(style.paddingTop, style.paddingBottom);
  assert.equal(style.paddingLeft, style.paddingRight);
});

test("a value the editor could not have produced is refused", () => {
  /* This arrives from stored JSON as well as from the panel, and a rejected
     value must leave the stylesheet's default rather than emit nonsense. */
  for (const bad of [-1, 401, "abc", null, {}, [], NaN, Infinity]) {
    assert.equal(blockPairStyle({ _padY: bad }), undefined, `_padY ${JSON.stringify(bad)} was accepted`);
  }
  // The bounds themselves are inclusive.
  assert.ok(blockPairStyle({ _padY: 400 }));
  assert.ok(blockPairStyle({ _padX: 0 }));
});

test("a numeric string from the panel behaves like the number", () => {
  assert.deepEqual(blockPairStyle({ _padY: "0" }), { paddingTop: "0px", paddingBottom: "0px" });
  assert.deepEqual(blockPairStyle({ _padY: "32" }), { paddingTop: "32px", paddingBottom: "32px" });
});

test("the wrapper actually receives it", () => {
  /* The helper is only half the fix: it has to reach the element. Pinned by
     shape so removing the style prop fails here rather than silently on the
     page. */
  const src = readCode("app/modules/blockPairs.tsx");
  /* Same JSX tag: from the className through to the style prop, without
     crossing a `>` that would end the element. Comments between the two
     attributes are blanked by readCode but still occupy the span. */
  /* Matched on the CALL, not its exact argument list: the helper now also takes
     the second column's config, because the pair's left inset comes from the
     first block and its right from the second (客戶: 只採取第一欄位的左留白與
     第二欄位的右留白). Pinning `blockPairStyle(cfg)` verbatim failed for that
     change while the property it guards — the wrapper receives the style — was
     never in question. */
  assert.match(src, /className=\{`property-block-pair\$\{[^>]{0,400}?style=\{blockPairStyle\(/,
    "the pair wrapper no longer takes its padding from blockPairStyle");
  assert.match(src, /import \{[^}]*blockPairStyle/, "blockPairStyle is not imported");
});

test("it reads the block that declares the pair, not the other one", () => {
  /* `cfg` is the first block's config — the same object `_pairNext`,
     `_pairReverse` and `_pairDirection` come from. Reading the second block's
     would put the pair's spacing on a control the editor associates with the
     right-hand column. */
  const src = readCode("app/modules/blockPairs.tsx");
  /* Superseded, deliberately. The rule is now one edge from each column
     (客戶: 並排版型留白只採取第一欄位的左留白與第二欄位的右留白，避免並排內容
     之間距離太寬) — so the first block is still the one that decides the pair's
     vertical spacing and its LEFT inset, and the second decides only the right.
     What must not come back is the second block's config standing in for the
     whole pair. */
  assert.match(src, /blockPairStyle\(cfg, nextCfg\)/,
    "the pair no longer takes an edge from each column");
  assert.doesNotMatch(src, /blockPairStyle\(nextCfg[,)]/, "the pair's spacing moved to the second block");
  /* And the columns must not re-apply it: the same config reaching each
     column's own wrapper inset the first one twice and the second once. */
  assert.match(src, /wrapIf\(block, withoutPad\(cfg\)/, "the first column re-applies the pair's padding");
  assert.match(src, /wrapIf\(nextBlock, withoutPad\(nextCfg\)/, "the second column re-applies the pair's padding");
});

import assert from "node:assert/strict";
import * as blockStyle from "../app/modules/blockStyle.ts";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { readStyles } from "./readCode.mts";

/**
 * A 並排 whose other half renders nothing gives its width back.
 *
 * Every block renderer on the site returns null for a block with no content —
 * an 入住須知 with no rules, a gallery with no photos, a table with no rows —
 * and the pairing pass wrapped that null anyway. The wrapper is a real <div>
 * with a real class, so it occupied one of the pair's two grid tracks and held
 * it open. Measured on /contact at 1440px: the surviving block came out 459px
 * wide inside a 1040px pair — 44% — with dead space beside it, and it does that
 * whichever half is empty.
 *
 * What made it expensive is that the page gives no clue: the block that shrank
 * is the one that is *fine*, and the empty block that caused it is invisible.
 * The obvious first move is to delete the empty block, which fixes it, so the
 * whole thing reads as self-inflicted.
 *
 * Two halves to the fix and both are asserted here: the pass stops wrapping a
 * null, and the stylesheet spans a lone child across both tracks (measured
 * afterwards: 1040px, the full content width).
 *
 * The loop is executed, not read: the difference between wrapping a null and
 * not wrapping it is invisible to a substring assertion.
 */

type El = { type: unknown; props: Record<string, unknown> };
const isEl = (v: unknown): v is El =>
  typeof v === "object" && v !== null && "type" in v && "props" in v;

function h(type: unknown, props: Record<string, unknown> | null, ...children: unknown[]): El {
  return { type, props: { ...(props ?? {}), children: children.length === 1 ? children[0] : children } };
}
const FRAGMENT = Symbol("fragment");

function compile(file: string, imports: Record<string, unknown>): Record<string, unknown> {
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
    if (!(id in imports)) throw new Error(`${file}: no stub for import "${id}"`);
    return imports[id];
  };
  new Function("exports", "require", "module", "__h", "__FRAGMENT", js)(
    mod.exports, req, mod, h, FRAGMENT,
  );
  return mod.exports;
}

/* The wrapper is the element that used to hold the empty track open, so it has
   to be a real element here — a pass-through would hide the defect. */
const WRAPPER = "block-wrapper";
const { renderWithPairs } = compile("app/modules/blockPairs.tsx", {
  "./BlockWrapper": { default: WRAPPER },
  /* The real module, not a stand-in: blockPairs asks it for the pair
     wrapper's padding, and a stub would make every assertion here a
     statement about the stub. Same reason ../tr is registered real
     elsewhere in this suite. */
  "./blockStyle": blockStyle,
}) as {
  renderWithPairs: (o: {
    blocks: Array<{ id: string; type: string; enabled?: boolean; config?: Record<string, unknown> }>;
    render: (b: { id: string }, cfg: Record<string, unknown>) => unknown;
  }) => unknown[];
};

/** Blocks whose id begins with "empty" render nothing, like a block with no content. */
const run = (blocks: Array<{ id: string; config?: Record<string, unknown> }>) =>
  renderWithPairs({
    blocks: blocks.map((b) => ({ type: "rich_text", ...b })),
    render: (b) => (b.id.startsWith("empty") ? null : `<${b.id}>`),
  });

/** The direct children of one pair — i.e. its grid tracks. */
const trackCount = (node: unknown): number => {
  if (!isEl(node)) return 0;
  const kids = node.props.children;
  const list = Array.isArray(kids) ? kids.flat(Infinity) : [kids];
  return list.filter((k) => k !== null && k !== undefined && k !== false).length;
};

function idsIn(node: unknown): string[] {
  const out: string[] = [];
  const visit = (n: unknown): void => {
    if (Array.isArray(n)) return void n.forEach(visit);
    if (typeof n === "string") { if (n.startsWith("<")) out.push(n.slice(1, -1)); return; }
    if (isEl(n)) visit(n.props.children);
  };
  visit(node);
  return out;
}

/** Every wrapper element anywhere in the output. */
function wrappers(node: unknown): El[] {
  const out: El[] = [];
  const visit = (n: unknown): void => {
    if (Array.isArray(n)) return void n.forEach(visit);
    if (!isEl(n)) return;
    if (n.type === WRAPPER) out.push(n);
    visit(n.props.children);
  };
  visit(node);
  return out;
}

test("an empty first half leaves one track, not an empty one beside it", () => {
  const out = run([{ id: "empty", config: { _pairNext: true } }, { id: "b" }]);
  assert.equal(out.length, 1, "the pair disappeared entirely, taking the block that had content");
  assert.deepEqual(idsIn(out[0]), ["b"], "the surviving block is not in the pair");
  assert.equal(
    trackCount(out[0]),
    1,
    "the empty half is still wrapped, so it holds a grid track open and halves the other block",
  );
});

test("an empty second half does the same", () => {
  // Symmetrical: the reported case was the first half, but 併入上一組 and a
  // plain pair can both leave the second one empty.
  const out = run([{ id: "a", config: { _pairNext: true } }, { id: "empty" }]);
  assert.equal(out.length, 1);
  assert.deepEqual(idsIn(out[0]), ["a"]);
  assert.equal(trackCount(out[0]), 1, "the empty second half still occupies a track");
});

test("no wrapper is emitted for a block that rendered nothing", () => {
  // The wrapper carries the block's background, padding and 區塊標記 anchor, so
  // an empty one is not invisible even when the grid does not stretch it.
  const out = run([{ id: "empty", config: { _pairNext: true } }, { id: "b" }]);
  assert.equal(wrappers(out).length, 1, "a wrapper was drawn around nothing");
});

test("a pair with content on both sides still has two tracks", () => {
  // The regression this fix could cause. /contact and /stays/hejing each
  // carry one of these; both measured unchanged after the change.
  const out = run([{ id: "a", config: { _pairNext: true } }, { id: "b" }]);
  assert.equal(out.length, 1);
  assert.equal(trackCount(out[0]), 2, "a full pair lost a column");
  assert.deepEqual(idsIn(out[0]), ["a", "b"]);
});

test("both halves empty produces nothing at all", () => {
  const out = run([{ id: "empty1", config: { _pairNext: true } }, { id: "empty2" }, { id: "c" }]);
  assert.equal(out.length, 1, "an entirely empty pair is still pushed");
  assert.deepEqual(idsIn(out[0]), ["c"]);
});

test("併入上一組 keeps the blocks that do render and drops the ones that do not", () => {
  const out = run([
    { id: "a", config: { _pairNext: true } },
    { id: "b" },
    { id: "empty", config: { _pairJoin: true } },
    { id: "c", config: { _pairJoin: true } },
  ]);
  assert.equal(out.length, 1);
  assert.deepEqual(idsIn(out[0]), ["a", "b", "c"], "a joined block that renders nothing is still in the stack");
  assert.equal(wrappers(out).length, 3, "the empty joined block was wrapped anyway");
});

test("an empty second half with joined blocks still stacks the joined ones", () => {
  const out = run([
    { id: "a", config: { _pairNext: true } },
    { id: "empty" },
    { id: "c", config: { _pairJoin: true } },
  ]);
  assert.equal(out.length, 1);
  assert.deepEqual(idsIn(out[0]), ["a", "c"], "the joined block was lost with the empty one it followed");
  assert.equal(trackCount(out[0]), 2, "the stack column vanished along with its empty first entry");
});

test("a joined column whose every block is empty leaves one track", () => {
  const out = run([
    { id: "a", config: { _pairNext: true } },
    { id: "empty1" },
    { id: "empty2", config: { _pairJoin: true } },
  ]);
  assert.equal(out.length, 1);
  assert.deepEqual(idsIn(out[0]), ["a"]);
  assert.equal(trackCount(out[0]), 1, "an all-empty stack column is still drawn");
});

test("a lone block that is not paired at all is unaffected", () => {
  // The non-pair path already dropped nulls; this guards that it still does.
  const out = run([{ id: "a" }, { id: "empty" }, { id: "c" }]);
  assert.deepEqual(out.flatMap(idsIn), ["a", "c"]);
  assert.equal(out.length, 2);
});

test("the stylesheet gives a lone track the whole pair", () => {
  /* Without this the fix is only half done: dropping the wrapper leaves one
     child sitting in the first `0.92fr` track — the same 44% width, just
     without the stray <div>. Measured on /contact at 1440px: 459px with the
     rule suppressed, 1040px with it. */
  const css = readStyles("app/globals.css");
  const rule = css.match(/\.property-block-pair\s*>\s*:only-child\s*\{[^}]*\}/);
  assert.ok(rule, ".property-block-pair > :only-child has no rule — a lone block keeps half the width");
  assert.match(
    rule![0],
    /grid-column:\s*1\s*\/\s*-1/,
    `the lone child is not spanned across both tracks: ${rule![0]}`,
  );
});

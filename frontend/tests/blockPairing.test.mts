import assert from "node:assert/strict";
import * as blockStyle from "../app/modules/blockStyle.ts";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readCode } from "./readCode";
import ts from "typescript";
import { sharedModule } from "./sharedModules.mts";

/**
 * 與下一個區塊並排 works on both kinds of page.
 *
 * The four pairing keys were read only by PropertyPageRenderer. Group content
 * pages (/brand, /journal, /contact) go through PageBlocks, which mapped one
 * wrapper per block and never looked at them — so an editor ticked 並排, saved
 * without error, saw the admin preview (drawn with the property renderer) show
 * the pair correctly, and got a stacked page in public.
 *
 * Two copies of one loop is what allowed that, so the loop moved to
 * modules/blockPairs and both renderers call it. This file checks the behaviour
 * of that loop and that neither renderer has grown a private copy again.
 *
 * The loop is executed, not grepped: it is compiled with the repo's own
 * TypeScript against a five-line element factory, the same way
 * tests/galleryConfig.test.mts drives real components.
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
    if (!(id in imports)) {
      const shared = sharedModule(file, id);
      if (shared) return shared;
      throw new Error(`${file}: no stub for import "${id}"`);
    }
    return imports[id];
  };
  new Function("exports", "require", "module", "__h", "__FRAGMENT", js)(
    mod.exports, req, mod, h, FRAGMENT,
  );
  return mod.exports;
}

/** A wrapper that keeps the config it was handed, so the assertions can see it. */
const WRAPPER = Symbol("BlockWrapper");
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
    adaptPaired?: (b: { type: string }, cfg: Record<string, unknown>) => Record<string, unknown>;
  }) => unknown[];
};

/** Blocks named by id, rendered as their own id so the order is readable. */
const run = (blocks: Array<{ id: string; type?: string; enabled?: boolean; config?: Record<string, unknown> }>) =>
  renderWithPairs({
    blocks: blocks.map((b) => ({ type: "rich_text", ...b })),
    render: (b) => `<${b.id}>`,
  });

/** The class list of one top-level output node. */
const classOf = (node: unknown): string =>
  isEl(node) ? String(node.props.className ?? "") : "";

/** Ids rendered inside one top-level output node, in order. */
function idsIn(node: unknown): string[] {
  const out: string[] = [];
  const visit = (n: unknown): void => {
    if (Array.isArray(n)) return n.forEach(visit);
    if (typeof n === "string") { if (n.startsWith("<")) out.push(n.slice(1, -1)); return; }
    if (isEl(n)) visit(n.props.children);
  };
  visit(node);
  return out;
}

test("without 並排 every block is its own row", () => {
  const out = run([{ id: "a" }, { id: "b" }, { id: "c" }]);
  assert.equal(out.length, 3);
  assert.deepEqual(out.map(classOf), ["", "", ""]);
});

test("與下一個區塊並排 puts two blocks in one pair", () => {
  const out = run([{ id: "a", config: { _pairNext: true } }, { id: "b" }, { id: "c" }]);
  assert.equal(out.length, 2, "the pair did not absorb the block after it");
  assert.equal(classOf(out[0]), "property-block-pair");
  assert.deepEqual(idsIn(out[0]), ["a", "b"]);
  assert.deepEqual(idsIn(out[1]), ["c"]);
});

test("交換左右 and 上下並排 each add their own class", () => {
  const reversed = run([{ id: "a", config: { _pairNext: true, _pairReverse: true } }, { id: "b" }]);
  assert.equal(classOf(reversed[0]), "property-block-pair is-reversed");

  const column = run([{ id: "a", config: { _pairNext: true, _pairDirection: "column" } }, { id: "b" }]);
  assert.equal(classOf(column[0]), "property-block-pair is-column");

  const both = run([
    { id: "a", config: { _pairNext: true, _pairReverse: true, _pairDirection: "column" } },
    { id: "b" },
  ]);
  assert.equal(classOf(both[0]), "property-block-pair is-reversed is-column");
});

test("併入上一組 stacks further blocks into the second column", () => {
  const out = run([
    { id: "a", config: { _pairNext: true } },
    { id: "b" },
    { id: "c", config: { _pairJoin: true } },
    { id: "d", config: { _pairJoin: true } },
    { id: "e" },
  ]);
  assert.equal(out.length, 2, "the joined blocks fell out of the pair");
  assert.deepEqual(idsIn(out[0]), ["a", "b", "c", "d"]);
  assert.deepEqual(idsIn(out[1]), ["e"]);
});

test("並排 on the last block is ignored rather than dropping it", () => {
  const out = run([{ id: "a" }, { id: "b", config: { _pairNext: true } }]);
  assert.equal(out.length, 2);
  assert.deepEqual(out.flatMap(idsIn), ["a", "b"]);
});

test("a disabled block is not paired with, and does not consume its partner", () => {
  // The filter runs before the loop, so the pair reaches past a hidden block.
  const out = run([
    { id: "a", config: { _pairNext: true } },
    { id: "hidden", enabled: false },
    { id: "b" },
  ]);
  assert.equal(out.length, 1);
  assert.deepEqual(idsIn(out[0]), ["a", "b"]);
});

test("adaptPaired reaches only the second block of a pair", () => {
  // The villa renderer folds the SPACE section's steps into the paired block;
  // nothing else must be rewritten by it.
  const seen: string[] = [];
  renderWithPairs({
    blocks: [
      { id: "a", type: "rich_text", config: { _pairNext: true } },
      { id: "b", type: "rich_text" },
      { id: "c", type: "rich_text" },
    ],
    render: (b) => `<${b.id}>`,
    adaptPaired: (b, cfg) => { seen.push((b as unknown as { id: string }).id); return cfg; },
  });
  assert.deepEqual(seen, ["b"]);
});

test("neither renderer keeps a private copy of the pairing rules", () => {
  /* The defect this file exists for was two implementations, one of which had
     no pairing at all. A renderer that reads _pairNext directly has started a
     third. */
  for (const file of [
    "app/modules/property/PropertyPageRenderer.tsx",
    "app/modules/content/PageBlocks.tsx",
  ]) {
    const src = readCode(file);
    assert.match(
      src,
      /import \{ renderWithPairs \} from "\.\.?\/(?:\.\.\/)?blockPairs"/,
      `${file} no longer goes through the shared pairing pass`,
    );
    assert.ok(
      !src.includes("_pairNext"),
      `${file} reads _pairNext itself again — the two renderers can drift apart once more`,
    );
  }
});

test("all three renderers go through the shared pass, not two of them", () => {
  /* The homepage kept a third copy of the loop after the first extraction —
     it wraps blocks differently on purpose (full-bleed without
     .property-block-contained, which would restyle the whole front page), and a
     shared pass that hardcoded the wrapper could not serve it. The wrapper is a
     parameter now, so no renderer needs its own copy. */
  for (const file of [
    "app/modules/property/PropertyPageRenderer.tsx",
    "app/modules/content/PageBlocks.tsx",
    "app/modules/home/HomepageBlocks.tsx",
  ]) {
    const src = readCode(file);
    assert.match(src, /renderWithPairs</, `${file} does not use the shared pairing pass`);
    assert.ok(
      !src.includes("_pairNext"),
      `${file} reads _pairNext itself again — that is how the homepage kept a third copy`,
    );
  }
});

test("a renderer can bring its own wrapper without forking the loop", () => {
  // The reason the homepage could not share it before.
  const out = renderWithPairs({
    blocks: [{ id: "a", type: "t", config: { _pairNext: true } }, { id: "b", type: "t" }],
    render: (b) => `<${b.id}>`,
    wrap: (b, _cfg, el) => h("section", { key: b.id, className: `mine-${b.id}` }, el),
  });
  const seen: string[] = [];
  const visit = (n: unknown): void => {
    if (Array.isArray(n)) return n.forEach(visit);
    if (!isEl(n)) return;
    if (typeof n.props.className === "string") seen.push(n.props.className);
    visit(n.props.children);
  };
  visit(out);
  assert.ok(seen.includes("mine-a") && seen.includes("mine-b"), "the custom wrapper was ignored");
  assert.ok(!seen.includes("wrap"), "the default wrapper was used despite one being supplied");
});

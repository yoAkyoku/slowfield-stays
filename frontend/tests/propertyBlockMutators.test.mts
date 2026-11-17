import assert from "node:assert/strict";
import test from "node:test";
import { compileDeclarations } from "./sourceEval";
import { blockHasContent, makeBlockId } from "../app/admin/modules/blockEditorUtils.ts";

/**
 * The villa page editor's block list, driven the way React drives it.
 *
 * Every one of its six mutators used to close over `blocks` and hand `setBlocks`
 * a finished array. Two of them running before the next render therefore both
 * computed from the same stale snapshot, and the second overwrote the first: the
 * hide came back, the config edit was lost, the second of two added blocks was
 * the only one that stuck. The homepage editor carries a comment about the same
 * bug in its own `add`, which is how this one was found.
 *
 * These tests run the real declarations against a stand-in for React's update
 * queue, so they distinguish `setBlocks(next)` from `setBlocks(prev => next)` —
 * which no assertion over the source text can do, because both spellings contain
 * every substring the other does.
 */

const FILE = "app/admin/(dashboard)/sites/[id]/pages/[pageKey]/PropertyBlockEditor.tsx";

type Blk = { id: string; type: string; enabled: boolean; config: Record<string, unknown> };

/* makeBlockId and blockHasContent are imported by the editor now; hand the
   compiled declarations the real ones. */
const compiled = compileDeclarations(
  FILE,
  ["confirmRemove", "toggle", "remove", "add", "updateConfig", "move", "onDrop"],
  ["makeBlockId", "blockHasContent", "blocks", "setBlocks", "selectedId", "setSelectedId", "dragIndex", "dropIndex", "setDragIndex", "setDropIndex", "blockLabel", "confirm"],
);
const build = (ctx: Record<string, unknown>) => compiled({ makeBlockId, blockHasContent, ...ctx });

function seed(): Blk[] {
  return [
    { id: "a", type: "hero_banner", enabled: true, config: { title: "A" } },
    { id: "b", type: "gallery", enabled: true, config: { images: ["x.jpg"] } },
    { id: "c", type: "faq", enabled: true, config: {} },
    { id: "d", type: "map", enabled: true, config: { lat: 24 } },
  ];
}

/**
 * One React tick.
 *
 * The mutators are built against the value the last render committed — that is
 * the snapshot a component's closures see — and every `setBlocks` goes on a
 * queue that is only drained at the end. Updater functions are applied against
 * the running value, plain values replace it, exactly as React does. So a
 * closure-based mutator loses whatever ran before it in the same tick, and a
 * functional one does not.
 */
function tick(
  start: Blk[],
  run: (m: Record<string, (...args: never[]) => unknown>) => void,
  extra: Record<string, unknown> = {},
): { blocks: Blk[]; selected: string | null; drag: number | null; drop: number | null } {
  let committed = start;
  const queue: unknown[] = [];
  let selected: string | null = (extra.selectedId as string | null) ?? null;
  let drag: number | null = (extra.dragIndex as number | null) ?? null;
  let drop: number | null = (extra.dropIndex as number | null) ?? null;
  const m = build({
    blocks: committed,
    setBlocks: (u: unknown) => queue.push(u),
    selectedId: selected,
    setSelectedId: (v: string | null) => { selected = v; },
    dragIndex: drag,
    dropIndex: drop,
    setDragIndex: (v: number | null) => { drag = v; },
    setDropIndex: (v: number | null) => { drop = v; },
    blockLabel: (type: string, zh: boolean) => (zh ? `[${type}]` : type),
    confirm: () => true,
    makeBlockId,
    blockHasContent,
    ...extra,
  });
  run(m);
  for (const u of queue) committed = typeof u === "function" ? (u as (p: Blk[]) => Blk[])(committed) : (u as Blk[]);
  return { blocks: committed, selected, drag, drop };
}

const ids = (bs: Blk[]) => bs.map((b) => b.id).join(",");

test("two blocks hidden in one tick: both stay hidden", () => {
  const { blocks } = tick(seed(), (m) => {
    (m.toggle as (id: string) => void)("a");
    (m.toggle as (id: string) => void)("c");
  });
  assert.equal(blocks.find((b) => b.id === "a")!.enabled, false, "the first hide was overwritten by the second");
  assert.equal(blocks.find((b) => b.id === "c")!.enabled, false);
  // …and nothing else moved.
  assert.equal(ids(blocks), "a,b,c,d");
  assert.equal(blocks.find((b) => b.id === "b")!.enabled, true);
});

test("hiding one block and deleting another in one tick keeps both", () => {
  const { blocks } = tick(seed(), (m) => {
    (m.toggle as (id: string) => void)("b");
    (m.remove as (id: string) => void)("d");
  });
  assert.equal(ids(blocks), "a,b,c", "the delete was computed from a list that still had the un-hidden block");
  assert.equal(blocks.find((b) => b.id === "b")!.enabled, false, "the hide came back when the delete landed");
});

test("two blocks added in one tick both survive", () => {
  const { blocks, selected } = tick(seed(), (m) => {
    (m.add as (t: string) => void)("faq");
    (m.add as (t: string) => void)("map");
  });
  assert.equal(blocks.length, 6, "one of the two added blocks was dropped");
  assert.deepEqual(blocks.slice(4).map((b) => b.type), ["faq", "map"], "added out of the order they were picked");
  assert.equal(selected, blocks[5].id, "the editor did not open the block just added");
});

test("two config edits in one tick both land", () => {
  const { blocks } = tick(seed(), (m) => {
    const update = m.updateConfig as (id: string, c: Record<string, unknown>) => void;
    update("a", { title: "changed" });
    update("d", { lat: 25 });
  });
  assert.deepEqual(blocks.find((b) => b.id === "a")!.config, { title: "changed" });
  assert.deepEqual(blocks.find((b) => b.id === "d")!.config, { lat: 25 }, "the second edit reverted the first");
});

test("上移 pressed twice in one tick moves two places, not one", () => {
  const { blocks } = tick(seed(), (m) => {
    const move = m.move as (id: string, d: number) => void;
    move("d", -1);
    move("d", -1);
  });
  assert.equal(ids(blocks), "a,d,b,c", "the second press was judged against the position before the first");
});

test("the move bounds are read from the in-flight list, not the render snapshot", () => {
  // Two presses of 上移 on the second block: the first takes it to the top, the
  // second must be refused. Judged against the stale snapshot it is still at
  // index 1 and the move is allowed, which drops it back down a row.
  const { blocks } = tick(seed(), (m) => {
    const move = m.move as (id: string, d: number) => void;
    move("b", -1);
    move("b", -1);
  });
  assert.equal(ids(blocks), "b,a,c,d");
});

test("a drop and a hide in the same tick compose", () => {
  const { blocks } = tick(
    seed(),
    (m) => {
      (m.toggle as (id: string) => void)("a");
      (m.onDrop as () => void)();
    },
    { dragIndex: 3, dropIndex: 1 },
  );
  assert.equal(ids(blocks), "a,d,b,c", "the drop did not use the list the hide produced");
  assert.equal(blocks.find((b) => b.id === "a")!.enabled, false, "the drop threw away the hide");
});

test("a drop with nothing being dragged leaves the list alone", () => {
  const { blocks } = tick(seed(), (m) => (m.onDrop as () => void)(), { dragIndex: null, dropIndex: 2 });
  assert.equal(ids(blocks), "a,b,c,d");
});

/* ── Block ids ─────────────────────────────────────────────────────────────
   The id is the React list key AND the handle `selectedId` holds, so two equal
   ids means one row's DOM is reused for the other, the inspector opens the same
   block from either row, and `remove` deletes whichever `filter` reaches first.
   Six base-36 characters is a coin-flip collision inside a few thousand draws. */

test("ids minted in bulk do not collide", () => {
  const makeId = makeBlockId;
  const seen = new Set<string>();
  for (let i = 0; i < 20000; i += 1) seen.add(makeId());
  assert.equal(seen.size, 20000, "makeId produced a duplicate — a duplicate is a lost block");
});

test("an id carries the time it was minted, so two mints in different ms differ whatever the random half does", () => {
  const makeId = makeBlockId;
  const id = makeId();
  const stamp = Number(id.split("-")[1]);
  assert.ok(Number.isFinite(stamp), `no timestamp in ${id}`);
  assert.ok(Math.abs(Date.now() - stamp) < 60_000, `${stamp} is not a current timestamp`);
});

/* ── Delete confirmation ───────────────────────────────────────────────────
   「刪除此版塊？」named nothing and fired on every press, including on a block
   that had just been added and held nothing. A prompt that always fires is a
   prompt that gets dismissed, which is how the configured one goes too. */

test("deleting a block with content names the block", () => {
  const asked: string[] = [];
  const { confirmRemove } = build({
    blockLabel: (type: string, zh: boolean) => (zh ? "相片拼貼牆" : "Photo collage"),
    confirm: (msg: string) => { asked.push(msg); return true; },
  }) as unknown as { confirmRemove: (b: Blk, zh: boolean) => boolean };

  const ok = confirmRemove({ id: "g", type: "gallery", enabled: true, config: { images: ["a.jpg"] } }, true);
  assert.equal(ok, true);
  assert.equal(asked.length, 1, "no confirmation before an irreversible delete");
  assert.match(asked[0], /相片拼貼牆/, `the prompt does not say what is being deleted: ${asked[0]}`);
});

test("cancelling the prompt refuses the delete", () => {
  const { confirmRemove } = build({
    blockLabel: (type: string) => type,
    confirm: () => false,
  }) as unknown as { confirmRemove: (b: Blk, zh: boolean) => boolean };
  assert.equal(confirmRemove({ id: "g", type: "gallery", enabled: true, config: { images: ["a.jpg"] } }, true), false);
});

test("an untouched block is deleted without a prompt", () => {
  let asked = 0;
  const { confirmRemove } = build({
    blockLabel: (type: string) => type,
    confirm: () => { asked += 1; return true; },
  }) as unknown as { confirmRemove: (b: Blk, zh: boolean) => boolean };

  assert.equal(confirmRemove({ id: "n", type: "faq", enabled: true, config: {} }, true), true);
  assert.equal(asked, 0, "a block with nothing in it still asks");
});

test("content is found however deep in the config it sits", () => {
  // the shared rule the editor imports
  const of = (config: Record<string, unknown>) => blockHasContent({ id: "x", type: "t", enabled: true, config });

  assert.equal(of({}), false);
  assert.equal(of({ title: "   " }), false, "whitespace counted as content");
  assert.equal(of({ items: [] }), false);
  assert.equal(of({ heading: { zh: "", en: "" } }), false, "an empty bilingual pair counted as content");
  assert.equal(of({ heading: { zh: "宜蘭", en: "" } }), true, "a filled bilingual field was missed");
  assert.equal(of({ items: [{ label: "one" }] }), true, "a repeated row was missed");
  assert.equal(of({ _fontSize: "20px" }), true, "a style the author set would be thrown away silently");
});

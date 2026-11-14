import assert from "node:assert/strict";
import test from "node:test";
import { callArguments, compileDeclarations, jsxTags } from "./sourceEval";
import {
  type History,
  canRedo,
  canUndo,
  initHistory,
  pushHistory,
  redoHistory,
  undoHistory,
} from "../app/admin/modules/historyStack.ts";

/**
 * Undo and redo on the villa page editor.
 *
 * The article editor and the homepage editor both hold their block list in
 * `useUndoableList` and both draw the shared UndoRedoButtons. This one held a
 * bare `useState`, so a mis-aimed 刪除 or a drag that landed one row off could
 * not be taken back at all — on the editor that also had no draft rescue, which
 * made a villa page the most fragile surface in the admin.
 *
 * The six mutators were changed to the updater form shortly before this, and
 * that property is the thing most easily lost while swapping the hook out:
 * `setBlocks(blocks.map(…))` and `setBlocks(prev => prev.map(…))` differ by four
 * characters, look identical in review, and only the second survives two writes
 * in one React tick. So the mutators are lifted out of the shipping file and RUN
 * here, against a store that behaves the way React's queue does, rather than
 * being matched as text.
 */

const EDITOR = "app/admin/(dashboard)/sites/[id]/pages/[pageKey]/PropertyBlockEditor.tsx";

type Block = { id: string; type: string; enabled: boolean; config: Record<string, unknown> };

const SAVED: Block[] = [
  { id: "a", type: "contact_info", enabled: true, config: {} },
  { id: "b", type: "newsletter", enabled: true, config: {} },
  { id: "c", type: "contact_form", enabled: true, config: {} },
];

/**
 * The editor's mutators, over a store that works like `useUndoableList` does.
 *
 * `blocks` is deliberately a STALE snapshot — the value from the render the
 * handler was created in. That is what a real React tick hands a closure, and
 * it is the only way a test can tell an updater from a finished array: a
 * mutator that reads `blocks` computes against the render's value and loses
 * whatever the previous call in the same tick did.
 */
function editorUnder(
  saved: Block[] = SAVED,
  selectedId: string | null = null,
  // `dragIndex` / `dropIndex` are render values the handler closes over, so
  // they are fixed before the handlers are built — as they are in a real
  // render — rather than assigned afterwards.
  dragging: { index: number | null; drop: number | null } = { index: null, drop: null },
) {
  let history: History<Block[]> = initHistory(saved);
  const setBlocks = (next: unknown, tag: string | null = null) => {
    const resolved = typeof next === "function" ? (next as (b: Block[]) => Block[])(history.present) : next as Block[];
    history = pushHistory(history, resolved, { tag });
  };
  const selection: { id: string | null } = { id: selectedId };
  const drag = { ...dragging };

  const built = compileDeclarations(
    EDITOR,
    ["makeId", "toggle", "remove", "add", "updateConfig", "move", "onDrop"],
    ["setBlocks", "blocks", "selectedId", "setSelectedId", "dragIndex", "dropIndex", "setDragIndex", "setDropIndex"],
  )({
    setBlocks,
    // The render's value, frozen. See above.
    blocks: saved,
    selectedId,
    setSelectedId: (id: string | null) => { selection.id = id; },
    dragIndex: dragging.index,
    dropIndex: dragging.drop,
    setDragIndex: (i: number | null) => { drag.index = i; },
    setDropIndex: (i: number | null) => { drag.drop = i; },
  });

  return {
    ...(built as unknown as {
      toggle: (id: string) => void;
      remove: (id: string) => void;
      add: (type: string) => void;
      updateConfig: (id: string, config: Record<string, unknown>) => void;
      move: (id: string, delta: number) => void;
      onDrop: () => void;
    }),
    drag,
    selection,
    order: () => history.present.map((b) => `${b.id}:${b.enabled ? 1 : 0}`).join(" "),
    steps: () => history.past.length,
    undo: () => { history = undoHistory(history); },
    redo: () => { history = redoHistory(history); },
    get canUndo() { return canUndo(history); },
    get canRedo() { return canRedo(history); },
  };
}

test("two changes in one tick both survive", () => {
  /* Hide one block and delete another before React has re-rendered. Written
     against the render's `blocks`, the second call computes from the value the
     first one already replaced, and the hide comes back. */
  const e = editorUnder();
  e.toggle("a");
  e.remove("b");
  assert.equal(e.order(), "a:0 c:1", "the second write overwrote the first");
});

test("pressing 上移 twice judges the second press against the first", () => {
  const e = editorUnder();
  e.move("c", -1);
  e.move("c", -1);
  assert.equal(e.order(), "c:1 a:1 b:1", "the second move was measured against the pre-move order");
});

test("a move that would leave the list is refused rather than dropping the block", () => {
  const e = editorUnder();
  e.move("a", -1);
  e.move("c", 1);
  assert.equal(e.order(), "a:1 b:1 c:1");
  assert.equal(e.steps(), 0, "a refused move still cost an undo step");
});

test("the edge of the list is measured against the list as it now is", () => {
  /* Delete a block and move the new last one down in the same tick. The bound
     has to come from the list the delete produced: measured against the
     render's three-block list, `to` is 2 in a list of two and `splice` puts the
     block back at the end — a "下移" that silently reorders nothing, or on a
     longer list moves it somewhere it was never dragged. */
  const e = editorUnder();
  e.remove("a");
  e.move("c", 1);
  assert.equal(e.order(), "b:1 c:1", "the move was judged against the pre-delete length");
  assert.equal(e.steps(), 1, "the refused move was recorded as an undo step of its own");
});

test("a drag lands where it was dropped, from the current order", () => {
  // Dragging the last block to the top, with a hide already queued in the same
  // tick — the drop has to be applied to the list the hide produced.
  const e = editorUnder(SAVED, null, { index: 2, drop: 0 });
  e.toggle("a");
  e.onDrop();
  assert.equal(e.order(), "c:1 a:0 b:1", "the drop was applied to the pre-toggle list");
  assert.equal(e.drag.index, null, "the drag state was left set");
  assert.equal(e.drag.drop, null);
});

test("a drop with nothing being dragged changes no order", () => {
  const e = editorUnder();
  e.onDrop();
  assert.equal(e.order(), "a:1 b:1 c:1");
  assert.equal(e.steps(), 0, "a no-op drop cost an undo step");
});

/* ── what the undo stack does with all that ── */

test("undo walks back one operation at a time", () => {
  const e = editorUnder();
  e.toggle("a");
  e.move("c", -1);
  e.toggle("b");
  assert.equal(e.order(), "a:0 c:1 b:0");

  e.undo();
  assert.equal(e.order(), "a:0 c:1 b:1", "undoing the hide did something else");
  e.undo();
  assert.equal(e.order(), "a:0 b:1 c:1", "undoing the move did something else");
  e.undo();
  assert.equal(e.order(), "a:1 b:1 c:1", "the editor did not get back to the saved page");
  assert.equal(e.canUndo, false, "there is history behind the page as it was opened");

  e.redo();
  assert.equal(e.order(), "a:0 b:1 c:1", "redo did not replay the first step");
});

test("a deleted block comes back, with its content", () => {
  /* The whole point on this editor: 刪除 asks before it takes a configured
     block, and the answer to a mis-aimed confirm used to be "rebuild it". */
  const configured: Block[] = [
    { id: "a", type: "partners", enabled: true, config: { items: [{ name: "品牌" }] } },
    { id: "b", type: "newsletter", enabled: true, config: {} },
  ];
  const e = editorUnder(configured, "a");
  e.remove("a");
  assert.equal(e.order(), "b:1");
  assert.equal(e.selection.id, null, "the inspector stayed open on a block that is gone");
  e.undo();
  assert.equal(e.order(), "a:1 b:1");
});

test("a run of typing in one block is one undo step, not one per keystroke", () => {
  /* Untagged, the 60-step history would be spent on half a sentence and one
     Ctrl+Z would step back one character. */
  const e = editorUnder();
  e.updateConfig("a", { heading: "聯" });
  e.updateConfig("a", { heading: "聯絡" });
  e.updateConfig("a", { heading: "聯絡我" });
  assert.equal(e.steps(), 1, `a keystroke run cost ${e.steps()} undo steps`);
  e.undo();
  assert.deepEqual(e.order(), "a:1 b:1 c:1");
});

test("moving to another block starts a new step", () => {
  const e = editorUnder();
  e.updateConfig("a", { heading: "一" });
  e.updateConfig("b", { heading: "二" });
  assert.equal(e.steps(), 2, "edits to two different blocks folded into one undo step");
});

test("a structural change is never folded into the typing before it", () => {
  const e = editorUnder();
  e.updateConfig("a", { heading: "一" });
  e.toggle("a");
  assert.equal(e.steps(), 2, "hiding a block was folded into the edit before it");
  e.undo();
  assert.equal(e.order(), "a:1 b:1 c:1", "one undo took back both the hide and the edit");
});

test("an added block is undoable and is selected", () => {
  const e = editorUnder();
  e.add("partners");
  assert.equal(e.order().split(" ").length, 4);
  assert.ok(e.selection.id?.startsWith("block-"), "the new block was not opened for editing");
  e.undo();
  assert.equal(e.order(), "a:1 b:1 c:1");
});

/* ── and that the editor is actually holding that stack ── */

test("the editor's list is the shared undoable one, with the shared buttons", () => {
  const held = callArguments(EDITOR, "useUndoableList");
  assert.equal(held.length, 1, "the villa page editor no longer holds an undoable list");
  const buttons = jsxTags(EDITOR).find((t) => t.tag === "UndoRedoButtons");
  assert.ok(buttons, "the toolbar has no undo/redo control, so nothing says the feature exists");
  for (const [prop, expected] of [
    ["canUndo", "history.canUndo"],
    ["canRedo", "history.canRedo"],
    ["onUndo", "history.undo"],
    ["onRedo", "history.redo"],
  ] as const) {
    assert.equal(buttons!.attrs.get(prop), expected, `the ${prop} button is wired to ${buttons!.attrs.get(prop)}`);
  }
});

test("every mutator hands the setter an updater, not a finished array", () => {
  /* The behavioural tests above cover the six as they stand. This is the
     seventh: a mutator added later, wired the easy way. */
  const setters = callArguments(EDITOR, "setBlocks");
  assert.ok(setters.length >= 6, `only ${setters.length} setBlocks calls found — did the mutators move?`);
  for (const [first] of setters) {
    assert.match(
      first,
      /^\(?(prev|cur|current)\)?\s*=>/,
      `setBlocks is handed a finished value, which loses a write made in the same tick: ${first.slice(0, 60)}`,
    );
  }
});

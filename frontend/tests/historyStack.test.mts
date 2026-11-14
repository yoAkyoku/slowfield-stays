import assert from "node:assert/strict";
import test from "node:test";
import {
  COALESCE_MS,
  HISTORY_LIMIT,
  canRedo,
  canUndo,
  historyIntent,
  initHistory,
  isTextEntryTarget,
  pushHistory,
  redoHistory,
  resetHistory,
  undoHistory,
} from "../app/admin/modules/historyStack.ts";

/**
 * Run with: npm test  (node --test, no test framework dependency)
 *
 * The block editors had no undo at all: a reorder, a duplicate, a hide or a
 * removed column was final. This is the stack behind the buttons and the
 * Ctrl+Z binding, kept as plain data so the rules can be checked here rather
 * than by clicking through two editors.
 */

const key = (over: Partial<Parameters<typeof historyIntent>[0]> = {}) => ({
  key: "z",
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...over,
});

test("a fresh history has nothing to undo or redo", () => {
  const h = initHistory(["a"]);
  assert.equal(canUndo(h), false);
  assert.equal(canRedo(h), false);
});

test("undo restores the previous list, redo replays it", () => {
  const before = ["a", "b", "c"];
  const afterDelete = ["a", "c"];
  let h = initHistory(before);
  h = pushHistory(h, afterDelete);
  assert.deepEqual(h.present, afterDelete);

  h = undoHistory(h);
  assert.deepEqual(h.present, before, "the deleted block comes back with its neighbours");
  assert.equal(canRedo(h), true);

  h = redoHistory(h);
  assert.deepEqual(h.present, afterDelete);
});

test("a reorder is one step, and undo puts the order back", () => {
  const before = ["a", "b", "c"];
  let h = initHistory(before);
  h = pushHistory(h, ["b", "a", "c"]);
  h = pushHistory(h, ["b", "c", "a"]);
  assert.equal(h.past.length, 2, "two moves are two steps, not one");
  assert.deepEqual(undoHistory(h).present, ["b", "a", "c"]);
  assert.deepEqual(undoHistory(undoHistory(h)).present, before);
});

test("a run of typing under the same tag collapses to one step", () => {
  let h = initHistory("");
  const at = 1_000;
  h = pushHistory(h, "h", { tag: "edit:1", at });
  h = pushHistory(h, "he", { tag: "edit:1", at: at + 40 });
  h = pushHistory(h, "hel", { tag: "edit:1", at: at + 80 });
  h = pushHistory(h, "hello", { tag: "edit:1", at: at + 120 });
  assert.equal(h.past.length, 1, "four keystrokes, one undo step");
  assert.deepEqual(undoHistory(h).present, "", "undo steps back by edit, not by character");
});

test("a pause longer than the window starts a new step", () => {
  let h = initHistory("");
  h = pushHistory(h, "one", { tag: "edit:1", at: 1_000 });
  h = pushHistory(h, "one two", { tag: "edit:1", at: 1_000 + COALESCE_MS + 1 });
  assert.equal(h.past.length, 2);
  assert.deepEqual(undoHistory(h).present, "one");
});

test("editing a different block does not fold into the previous run", () => {
  let h = initHistory("");
  h = pushHistory(h, "a", { tag: "edit:1", at: 1_000 });
  h = pushHistory(h, "ab", { tag: "edit:2", at: 1_010 });
  assert.equal(h.past.length, 2);
});

test("a structural change never folds, even back to back", () => {
  let h = initHistory<string[]>([]);
  h = pushHistory(h, ["a"], { at: 1_000 });
  h = pushHistory(h, ["a", "b"], { at: 1_001 });
  assert.equal(h.past.length, 2, "two adds are two undo steps");
});

test("a structural change straight after typing ends the run", () => {
  let h = initHistory("");
  h = pushHistory(h, "abc", { tag: "edit:1", at: 1_000 });
  h = pushHistory(h, "abc+block", { at: 1_010 });
  assert.equal(h.past.length, 2);
  assert.deepEqual(undoHistory(h).present, "abc");
});

test("a change after an undo drops the redo branch", () => {
  let h = initHistory("a");
  h = pushHistory(h, "b");
  h = undoHistory(h);
  assert.equal(canRedo(h), true);
  h = pushHistory(h, "c");
  assert.equal(canRedo(h), false, "redo would replay a history that no longer exists");
});

test("an edit right after an undo cannot fold into the undone run", () => {
  let h = initHistory("");
  h = pushHistory(h, "abc", { tag: "edit:1", at: 1_000 });
  h = undoHistory(h);
  h = pushHistory(h, "x", { tag: "edit:1", at: 1_020 });
  assert.equal(h.past.length, 1, "the undo is still reachable");
  assert.deepEqual(undoHistory(h).present, "");
});

test("undo and redo on an exhausted stack are no-ops", () => {
  const h = initHistory("a");
  assert.equal(undoHistory(h), h);
  assert.equal(redoHistory(h), h);
});

test("pushing the identical value records nothing", () => {
  const value = ["a"];
  const h = initHistory(value);
  assert.equal(pushHistory(h, value), h);
});

test("history is capped and drops the oldest states first", () => {
  let h = initHistory(0, 5);
  for (let i = 1; i <= 20; i += 1) h = pushHistory(h, i);
  assert.equal(h.past.length, 5, "a long session cannot grow without bound");
  // Five undos walk back to 15; there is nothing older to reach.
  for (let i = 0; i < 5; i += 1) h = undoHistory(h);
  assert.equal(h.present, 15);
  assert.equal(canUndo(h), false);
});

test("the default cap is a session's worth of steps, not a handful", () => {
  assert.ok(HISTORY_LIMIT >= 50);
});

test("reset forgets the past", () => {
  let h = initHistory("a");
  h = pushHistory(h, "b");
  h = resetHistory(h, "saved");
  assert.equal(h.present, "saved");
  assert.equal(canUndo(h), false);
  assert.equal(canRedo(h), false);
});

/* ── Which keystrokes belong to the block list, and which to a field ── */

test("text fields and rich text keep their own undo", () => {
  assert.equal(isTextEntryTarget({ tagName: "INPUT", type: "text" }), true);
  assert.equal(isTextEntryTarget({ tagName: "input", type: "search" }), true);
  assert.equal(isTextEntryTarget({ tagName: "INPUT", type: "number" }), true);
  assert.equal(isTextEntryTarget({ tagName: "INPUT" }), true, "no type attribute means type=text");
  assert.equal(isTextEntryTarget({ tagName: "TEXTAREA" }), true);
  assert.equal(isTextEntryTarget({ tagName: "DIV", isContentEditable: true }), true);
});

test("controls with no text cursor hand the keystroke to the block list", () => {
  for (const type of ["checkbox", "radio", "range", "color", "file", "submit", "button"]) {
    assert.equal(isTextEntryTarget({ tagName: "INPUT", type }), false, type);
  }
  assert.equal(isTextEntryTarget({ tagName: "BUTTON" }), false);
  assert.equal(isTextEntryTarget({ tagName: "SELECT" }), false);
  assert.equal(isTextEntryTarget({ tagName: "BODY" }), false);
  assert.equal(isTextEntryTarget(null), false);
});

test("Ctrl+Z undoes and Ctrl+Shift+Z redoes", () => {
  assert.equal(historyIntent(key({ ctrlKey: true })), "undo");
  assert.equal(historyIntent(key({ ctrlKey: true, shiftKey: true })), "redo");
});

test("Cmd is the Mac spelling of the same chord", () => {
  assert.equal(historyIntent(key({ metaKey: true })), "undo");
  assert.equal(historyIntent(key({ metaKey: true, shiftKey: true })), "redo");
  assert.equal(historyIntent(key({ key: "Z", metaKey: true, shiftKey: true })), "redo");
});

test("Ctrl+Y redoes, for the editors that expect it", () => {
  assert.equal(historyIntent(key({ key: "y", ctrlKey: true })), "redo");
});

test("an unmodified or Alt-modified Z is just a letter", () => {
  assert.equal(historyIntent(key()), null);
  assert.equal(historyIntent(key({ ctrlKey: true, altKey: true })), null);
  assert.equal(historyIntent(key({ key: "a", ctrlKey: true })), null);
});

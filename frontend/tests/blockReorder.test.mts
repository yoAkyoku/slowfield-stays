import assert from "node:assert/strict";
import test from "node:test";

/**
 * The drop index used by the block editor's drag-and-drop.
 *
 * This mirrors the two lines inside `handleDrop` rather than importing them,
 * because they live inside a React component. It is here because the previous
 * version subtracted one for downward drags (a drop-between-gaps adjustment
 * applied to a drop-onto-row model), so dragging a block down by exactly one
 * cancelled itself out and the feature read as broken.
 */
function reorder<T>(list: T[], sourceIndex: number, targetIndex: number): T[] {
  const arr = [...list];
  const [moved] = arr.splice(sourceIndex, 1);
  arr.splice(targetIndex, 0, moved);
  return arr;
}

const blocks = ["a", "b", "c", "d"];

test("dragging down by one actually moves it", () => {
  assert.deepEqual(reorder(blocks, 0, 1), ["b", "a", "c", "d"]);
});

test("dragging up by one moves it", () => {
  assert.deepEqual(reorder(blocks, 2, 1), ["a", "c", "b", "d"]);
});

test("the block lands on the row that was highlighted", () => {
  // Dropping "a" on the row holding "c" puts "a" where "c" was.
  assert.equal(reorder(blocks, 0, 2)[2], "a");
  // And dropping "d" on the row holding "a" puts it first.
  assert.equal(reorder(blocks, 3, 0)[0], "d");
});

test("moving to either end keeps every block exactly once", () => {
  for (const [from, to] of [[0, 3], [3, 0], [1, 3], [2, 0]] as const) {
    const out = reorder(blocks, from, to);
    assert.equal(out.length, blocks.length);
    assert.deepEqual([...out].sort(), [...blocks].sort());
  }
});

/**
 * The homepage / villa editor (HomepageBlockEditor) reorders on a DIFFERENT
 * model, and the two are easy to confuse because the code looks alike.
 *
 * There, onDragOver picks `index` or `index + 1` from which half of the row the
 * cursor is over, and a drop line is drawn in that GAP. Removing the dragged
 * block first shifts every later gap down by one, which is what the `- 1` in
 * `dropIndex > dragIndex ? dropIndex - 1 : dropIndex` corrects. Mirrored here,
 * not imported, because it lives inside a React component.
 *
 * This is the assertion that the two models must not be swapped: the article
 * editor's row model must NOT subtract, and this gap model must.
 */
function reorderByGap<T>(list: T[], dragIndex: number, dropIndex: number): T[] {
  const next = [...list];
  const [moved] = next.splice(dragIndex, 1);
  const target = dropIndex > dragIndex ? dropIndex - 1 : dropIndex;
  next.splice(target, 0, moved);
  return next;
}

test("gap model: dropping in the gap just below the next row moves down by one", () => {
  // Gap 2 is between "b" and "c". Dragging "a" there means [b, a, c, d].
  assert.deepEqual(reorderByGap(blocks, 0, 2), ["b", "a", "c", "d"]);
});

test("gap model: dropping into an adjacent gap is a no-op", () => {
  // The gaps either side of "a" are 0 and 1; landing in either leaves it put.
  assert.deepEqual(reorderByGap(blocks, 0, 0), blocks);
  assert.deepEqual(reorderByGap(blocks, 0, 1), blocks);
});

test("gap model: the block lands where the drop line was drawn", () => {
  // Gap 4 is past the end, so "a" goes last.
  assert.deepEqual(reorderByGap(blocks, 0, 4), ["b", "c", "d", "a"]);
  // Gap 0 is before the first row, so "d" goes first.
  assert.deepEqual(reorderByGap(blocks, 3, 0), ["d", "a", "b", "c"]);
  // Gap 1 while dragging upward puts "c" between "a" and "b".
  assert.deepEqual(reorderByGap(blocks, 2, 1), ["a", "c", "b", "d"]);
});

test("gap model: every block survives a move to either end", () => {
  for (const [from, to] of [[0, 4], [3, 0], [1, 4], [2, 0]] as const) {
    const out = reorderByGap(blocks, from, to);
    assert.equal(out.length, blocks.length);
    assert.deepEqual([...out].sort(), [...blocks].sort());
  }
});

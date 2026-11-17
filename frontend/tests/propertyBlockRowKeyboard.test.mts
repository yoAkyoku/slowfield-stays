import assert from "node:assert/strict";
import test from "node:test";
import { compileDeclarations, jsxTags } from "./sourceEval";
import { activateOnKey as sharedActivateOnKey } from "../app/admin/modules/blockEditorUtils.ts";

/**
 * Opening a block on a villa page without a mouse.
 *
 * The row that opens a block's settings was two bare `<span>`s inside a `<div>`
 * carrying an onClick: measured `tabindex` null, `role` null. There was no
 * keyboard route to the inspector at all — not an awkward one, none — and a
 * screen reader announced the row as loose text with no hint that it opened
 * anything. The homepage editor's identical row has shipped `role="button"
 * tabIndex={0} aria-expanded aria-label onKeyDown` all along, which is what made
 * the gap easy to miss: the same job worked one screen away.
 *
 * The row cannot simply BE a `<button>`: the piece holds the block's preview
 * thumbnail, an iframe.
 */

const EDITORS = [
  { file: "app/admin/(dashboard)/sites/[id]/pages/[pageKey]/PropertyBlockEditor.tsx", label: "villa page blocks" },
  { file: "app/admin/(dashboard)/homepage/HomepageBlockEditor.tsx", label: "homepage blocks" },
];

for (const { file, label } of EDITORS) {
  const openRow = jsxTags(file).find((t) => t.attrs.get("className") === "hpb-piece__open");

  test(`${label}: the block row is reachable and announced as a control`, () => {
    assert.ok(openRow, `${file} has no .hpb-piece__open row — the block row is a plain div again`);
    assert.equal(openRow!.attrs.get("role"), label === "villa page blocks" ? 'reordering ? undefined : "button"' : "button", "editing rows announce a control; ordering rows use move buttons");
    assert.equal(openRow!.attrs.get("tabIndex"), label === "villa page blocks" ? "reordering ? undefined : 0" : "0", "editing rows are keyboard reachable");
    assert.ok(openRow!.attrs.has("aria-label"), "the row has no accessible name");
    assert.ok(
      openRow!.attrs.has("aria-expanded"),
      "the row never says whether the settings it opens are open",
    );
    assert.ok(openRow!.attrs.has("onKeyDown"), "the row takes clicks but not key presses");
  });

  test(`${label}: the row's expanded state tracks the selected block`, () => {
    // Not a constant, and not the wrong block: it must be this row's own id
    // against the selection, or every row claims the same state.
    assert.match(
      openRow!.attrs.get("aria-expanded") ?? "",
      /selectedId\s*===\s*block\.id/,
      "aria-expanded is not derived from this row's own selection",
    );
  });

  test(`${label}: the row names the block, not just "edit"`, () => {
    assert.match(
      openRow!.attrs.get("aria-label") ?? "",
      /label\(block\.type\)/,
      "the accessible name does not include the block's type, so every row announces the same thing",
    );
  });

  test(`${label}: the drag grip stays out of the reading order`, () => {
    // Dragging is mouse-only; the move up / down buttons are the keyboard route.
    // Announcing an unreachable grip is noise between the row and its actions.
    const grip = jsxTags(file).find((t) => t.attrs.get("className") === "hpb-handle");
    assert.ok(grip, `${file} has no .hpb-handle`);
    assert.equal(grip!.attrs.get("aria-hidden"), "true");
  });
}

/* ── The key handler itself, run ────────────────────────────────────────────
   `role="button"` buys the announcement and nothing else: the browser only
   synthesises a click from Enter/Space for a real <button>. This is the code
   that closes that gap, so it is worth running rather than grepping for. */

type KeyEvent = { key: string; preventDefault: () => void };

for (const { file, label } of EDITORS) {
  // Both editors import the one activateOnKey; run that.
  const activateOnKey = sharedActivateOnKey as (e: KeyEvent, run: () => void) => void;

  const press = (key: string) => {
    let ran = 0;
    let prevented = 0;
    activateOnKey({ key, preventDefault: () => { prevented += 1; } }, () => { ran += 1; });
    return { ran, prevented };
  };

  test(`${label}: Enter opens the block`, () => {
    assert.equal(press("Enter").ran, 1);
  });

  test(`${label}: Space opens the block and does not scroll the page instead`, () => {
    const { ran, prevented } = press(" ");
    assert.equal(ran, 1);
    assert.equal(prevented, 1, "Space would scroll the canvas out from under the row it just opened");
  });

  test(`${label}: other keys are left alone`, () => {
    // Tab must keep moving, arrows must keep scrolling, and typing "a" in a
    // field that bubbles here must not open a block.
    for (const key of ["Tab", "ArrowDown", "Escape", "a", "Shift"]) {
      const { ran, prevented } = press(key);
      assert.equal(ran, 0, `${key} opened a block`);
      assert.equal(prevented, 0, `${key} was swallowed`);
    }
  });
}

/**
 * Dialogs built on the admin kit's <Dialog> (app/admin/ui/Dialog.tsx).
 *
 * The focus-trap tests were written when every dialog carried its own
 * aria-modal panel and its own useOverlay call. Most admin dialogs now render
 * the shared <Dialog>, which owns both — so the guarantees move: the contract
 * (aria-modal on the role="dialog" panel, Escape + Tab trap from useOverlay with
 * trapFocus on that same panel, nothing rendered while closed) is asserted once
 * against Dialog.tsx, and each caller is checked for the parts that are still
 * its own: which flag opens it, that onClose really closes it, and that it
 * holds an action besides the built-in close button.
 */
import assert from "node:assert/strict";
import { readCode } from "./readCode";
import { callArguments, jsxTags } from "./sourceEval";

export const KIT_DIALOG = "app/admin/ui/Dialog.tsx";

type Tag = ReturnType<typeof jsxTags>[number];

/** The kit <Dialog> in `file` matching the optional open flag / text, if the file uses one. */
export function findKitDialogs(file: string, opts: { active?: string; modalText?: string } = {}): Tag[] {
  return jsxTags(file).filter(
    (t) =>
      t.tag === "Dialog" &&
      (!opts.active || t.attrs.get("open") === opts.active) &&
      (!opts.modalText || t.fullText.includes(opts.modalText)),
  );
}

/** Dialog.tsx keeps the promise its aria-modal makes. Throws (assert) if not. */
export function assertKitDialogContract(): void {
  const src = readCode(KIT_DIALOG);
  const tags = jsxTags(KIT_DIALOG);
  const modal = tags.filter((t) => t.attrs.get("aria-modal") === "true");
  assert.equal(modal.length, 1, "the kit Dialog should have exactly one aria-modal panel");
  assert.equal(modal[0].attrs.get("role"), "dialog", "the kit Dialog's aria-modal element is not role=dialog");
  const overlays = callArguments(KIT_DIALOG, "useOverlay");
  assert.equal(overlays.length, 1, "the kit Dialog no longer calls useOverlay exactly once");
  const [active, dismiss, options] = overlays[0];
  assert.equal(active, "open", "the kit Dialog's hook does not watch its open prop");
  assert.equal(dismiss, "onClose", "Escape in the kit Dialog does not call onClose");
  const ref = options?.match(/trapFocus\s*:\s*([A-Za-z_$][\w$]*)/)?.[1];
  assert.ok(ref, "the kit Dialog calls useOverlay without trapFocus");
  assert.equal(modal[0].attrs.get("ref"), ref, "the kit Dialog traps a ref that is not its aria-modal panel");
  /* Closed, it renders nothing — or, with keepMounted, its layer is not
     displayed, so nothing in it can be seen, focused or tabbed to while the
     hook is off. */
  assert.match(src, /if \(!open && !keepMounted\) return null;/, "the kit Dialog renders while closed, so the hook and the panel can disagree");
  assert.match(src, /style=\{open \? undefined : \{ display: "none" \}\}/, "a kept-mounted closed Dialog is still displayed");
  assert.ok(
    modal[0].fullText.includes("onClick={onClose}") && /aria-label=\{closeLabel\}/.test(modal[0].fullText),
    "the kit Dialog lost its labelled close button inside the trapped panel",
  );
  assert.match(modal[0].fullText, /aria-labelledby=\{titleId\}/, "the kit Dialog panel is no longer named by its title");
}

/** Controls a reader must reach inside a caller's <Dialog> (its own close button not counted). */
export function kitDialogControls(tag: Tag): number {
  return (tag.fullText.match(/<(button\b|Button\b|ButtonLink\b|[A-Z][\w$]*Button\b|SubmitButton\b)/g) ?? []).length;
}

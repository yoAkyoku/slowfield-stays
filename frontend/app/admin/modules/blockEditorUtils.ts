/**
 * Pieces both block editors need — the brand homepage editor and the villa
 * page editor. Each used to carry its own copy, and the copies had drifted:
 * one minted six-character ids that collide on a busy page, and the two
 * disagreed on whether a block "has content" worth confirming a delete for.
 */

import { plainText } from "../../modules/safeHtml";

/** A block as the editors hold it. */
export type EditorBlock = {
  id: string;
  type: string;
  enabled: boolean;
  config: Record<string, unknown>;
};

/** A block id, which is also its React list key and the handle the selection
 *  holds. Six base-36 characters alone collide about 2 times in 100 across the
 *  fifty-odd blocks a busy page accumulates; a collision makes two rows share a
 *  key, so selecting either opens the same inspector. The timestamp prefix
 *  keeps ids minted in different milliseconds apart whatever the random half
 *  does. */
export function makeBlockId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** zh/en pick for the editor's own chrome, by the locale being edited. */
export function bi(editLocale: string, zh: string, en: string): string {
  return editLocale === "zh" ? zh : en;
}

/** Enter/Space on a role="button" element, which the browser only does for real
 *  buttons. A block row cannot BE a button: its thumbnail is an iframe of the
 *  real block, and interactive content is invalid inside a button. */
export function activateOnKey(e: { key: string; preventDefault(): void }, run: () => void): void {
  if (e.key !== "Enter" && e.key !== " ") return;
  e.preventDefault(); // Space would otherwise scroll the canvas
  run();
}

/** Scroll something into view, honouring the visitor's motion setting. Smooth
 *  shows which way the page moved; anyone who asked the OS for less motion gets
 *  the jump instead. Guarded because some environments have no matchMedia. */
export function revealElement(el: HTMLElement | null | undefined, block: ScrollLogicalPosition = "center"): void {
  if (!el) return;
  const still = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: still ? "auto" : "smooth", block });
}

/** Deep copy with a fresh id. structuredClone rather than a spread because a
 *  config nests arrays and objects that a shallow copy would leave shared, so
 *  editing the duplicate would also edit the original. */
export function cloneBlock<B extends EditorBlock>(block: B): B {
  return { ...structuredClone(block), id: makeBlockId() };
}

/** Whether deleting this block loses work that cannot be retyped from the row.
 *
 *  Confirming every delete trains people to dismiss the dialog unread, so a
 *  block added by a misclick and never filled in goes without one.
 *  A style the author set (_fontSize, _bgColor and friends) counts: deleting
 *  the block throws it away just as surely as its text. Markup with no text in
 *  it (an emptied rich-text field saves as "<p></p>") does not.
 *
 *  The two editors used to disagree here — the homepage one skipped style keys
 *  and the villa one did not, so the same block asked before deleting on one
 *  page and not the other. */
export function blockHasContent(block: Pick<EditorBlock, "config">): boolean {
  const filled = (v: unknown): boolean => {
    if (v === null || v === undefined || v === false || v === "") return false;
    if (typeof v === "string") return plainText(v).length > 0;
    if (Array.isArray(v)) return v.some(filled);
    if (typeof v === "object") return Object.values(v as Record<string, unknown>).some(filled);
    return true;
  };
  return Object.values(block.config ?? {}).some(filled);
}

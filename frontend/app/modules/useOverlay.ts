"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * The two things every overlay in this app needs and half of them were missing.
 *
 * There were six separate Escape handlers and eleven separate scroll locks, and
 * they did not agree with each other:
 *
 *  · Three modals — the media upload dialog, the related-stays picker and the
 *    villa block editor's preview — had no Escape handler, no focus handling and
 *    no `role="dialog"`. A keyboard user who opened one could not close it.
 *
 *  · Ten of the eleven scroll locks reset `body.style.overflow` to `""` on
 *    close rather than to what it was before. Open a lightbox from a page whose
 *    mobile menu already locked the body, close the lightbox, and the page
 *    scrolls behind the menu that is still open. Only LightboxGallery saved the
 *    previous value, which is why this was invisible in the one place anyone
 *    thought to check.
 *
 * The lock is reference-counted for that reason: nested overlays are the case
 * that breaks, so releasing one must not unlock the page while another holds it.
 */

let lockCount = 0;
let savedOverflow: string | null = null;

function acquireScrollLock(): () => void {
  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount += 1;
  let released = false;
  return () => {
    // Effects can clean up more than once under StrictMode; releasing twice
    // would drop the count below zero and unlock while an overlay is still up.
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
      document.body.style.overflow = savedOverflow ?? "";
      savedOverflow = null;
    }
  };
}

/** Hold the page still while `active`, restoring exactly what was there before. */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    return acquireScrollLock();
  }, [active]);
}

/** What Tab can reach. Matches the set the group header's own trap used.
 * :not([disabled]) rather than a disabled check per element: a disabled
 * control is not in the tab order, so including it would send Tab to a dead
 * end at either edge of the wrap. */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Does this match actually have a box on screen?
 *
 * The selector above is a guess at the tab order, and it over-matches: a
 * `display: none` file input behind a styled label matches `input:not([disabled])`
 * and measures 0×0. The browser skips it when Tab moves, so it is never
 * `document.activeElement` — which is what both ends of the wrap below are
 * compared against. A zero-sized element at either end therefore makes that end
 * unreachable and the wrap never fires: Tab walks out of the panel instead.
 * The media upload dialog is exactly this — with no files queued its start
 * button is `disabled`, leaving the hidden file input as the last match.
 *
 * `.focus()` on one is a silent no-op too, so the same element at the front of
 * the list swallows the opening focus and leaves the reader on <body>.
 */
function hasBox(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 || rect.height > 0;
}

/**
 * Focus the first candidate that will actually take it, and say whether any did.
 *
 * `hasBox` catches the elements that are measurably not there, but not every
 * refusal is measurable: content inside a collapsed `<details>` still reports
 * its old rect in Chrome and still cannot be focused. `.focus()` reports
 * nothing either way, so the only reliable test is to ask afterwards where
 * focus ended up. Everything here depends on that answer — a trap that does not
 * know where focus is cannot hold it.
 */
function focusFirstAvailable(candidates: HTMLElement[]): boolean {
  for (const el of candidates) {
    el.focus();
    if (document.activeElement === el) return true;
  }
  return false;
}

/**
 * Escape closes, the page holds still, and focus comes back where it started.
 *
 * `onDismiss` is held in a ref so a caller passing an inline arrow — which is
 * every caller — does not tear down and re-add the listener on each render.
 */
export function useOverlay(
  active: boolean,
  onDismiss: () => void,
  options?: {
    lockScroll?: boolean;
    restoreFocus?: boolean;
    /** The dialog panel. Pass it to move focus in on open and hold Tab inside.
     *  Required by anything claiming `aria-modal="true"`: that attribute tells
     *  assistive tech the rest of the page is unavailable, so a panel that lets
     *  Tab walk out behind it is worse than one that never claimed to be modal. */
    trapFocus?: RefObject<HTMLElement | null>;
  },
): void {
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;

  const lockScroll = options?.lockScroll ?? true;
  const restoreFocus = options?.restoreFocus ?? true;
  const trapFocus = options?.trapFocus;

  useScrollLock(active && lockScroll);

  useEffect(() => {
    if (!active) return;
    // Whatever the reader was on before the overlay opened. Without this, a
    // keyboard user who closes a dialog is returned to the top of the document
    // and has to tab back to where they were.
    const previouslyFocused = restoreFocus ? document.activeElement : null;

    const panel = trapFocus?.current ?? null;
    // Re-queried on every Tab: a panel can fill in after it opens (a list that
    // is still loading), and a trap built once would hold the wrong ends.
    const focusables = () =>
      panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(hasBox) : [];

    // Nothing inside would take focus. The panel itself is the fallback, and it
    // can only be focused if it is in the tab order at all — a bare <div> is
    // not, and `.focus()` on it is another silent no-op. Add the attribute if
    // the caller did not, and take it off again on the way out so the DOM is
    // left as it was found.
    let addedTabIndex = false;
    if (panel && !focusFirstAvailable(focusables())) {
      if (!panel.hasAttribute("tabindex")) {
        panel.tabIndex = -1;
        addedTabIndex = true;
      }
      panel.focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Nested overlays: the innermost one closes, and the one underneath does
        // not close with it.
        e.stopPropagation();
        dismiss.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = focusables();
      if (items.length === 0) return;
      const focused = document.activeElement;
      // Focus fell out of the panel without leaving the page: clicking a
      // dialog's own heading — anything in it that is not a control — puts
      // focus on <body>, and Tab from <body> starts again at the top of the
      // document, which is the page this dialog says is unavailable. Only
      // <body> is caught, never another element: a nested overlay's own panel
      // is "outside" this one, and pulling focus back would break it.
      if (!focused || focused === document.body) {
        e.preventDefault();
        focusFirstAvailable(e.shiftKey ? [...items].reverse() : items);
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && focused === first) {
        e.preventDefault();
        focusFirstAvailable([...items].reverse());
      } else if (!e.shiftKey && focused === last) {
        e.preventDefault();
        focusFirstAvailable(items);
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      if (addedTabIndex) panel?.removeAttribute("tabindex");
      if (previouslyFocused instanceof HTMLElement && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [active, restoreFocus, trapFocus]);
}

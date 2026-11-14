import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";
import { compileDeclarations } from "./sourceEval";

/**
 * `.focus()` fails silently, and the Tab trap is built on top of it.
 *
 * `useOverlay` moved focus with `(focusables()[0] ?? panel).focus()` and then
 * never asked whether that worked. It often does not:
 *
 *  · The focusable selector is a guess at the tab order and over-matches. A
 *    `display: none` file input behind a styled upload label matches
 *    `input:not([disabled])` and measures 0×0. The browser skips it when Tab
 *    moves, so it is never `document.activeElement`.
 *  · A rect is not the whole story either. Anything inside a collapsed
 *    `<details>` still reports the box it had when the section was open, and
 *    still refuses focus. The villa page's 文章分類 fold is one, measured at
 *    26×26 while unfocusable.
 *
 * Both ends of the wrap are `document.activeElement === first/last` checks, so
 * an element that can never be the active element at either end means that end
 * never fires and Tab walks out of a panel that says `aria-modal="true"`. And a
 * refused opening focus leaves the reader on <body>, where NEITHER end matches
 * and the trap is not just leaky but absent.
 *
 * These run the shipped helpers rather than grep for them: the difference
 * between `el.focus()` and "focus it and check it took" is invisible to a
 * substring assertion and is the entire fix.
 */

/* The real `FOCUSABLE`, `hasBox`, `focusables`, `focusFirstAvailable` and the
   Tab/Escape handler, lifted out of the hook in declaration order so each one
   closes over the real version of the one before it. `panel` and `dismiss` are
   what they close over from the effect. */
const build = compileDeclarations(
  "app/modules/useOverlay.ts",
  ["FOCUSABLE", "hasBox", "focusables", "focusFirstAvailable", "onKey"],
  ["panel", "dismiss"],
);

/** A stand-in element. `takesFocus` is what the browser would decide: a
 *  zero-sized box, a `display: none` control and a collapsed `<details>`
 *  subtree all refuse, and none of them report the refusal. */
type FakeElement = {
  name: string;
  width: number;
  height: number;
  takesFocus: boolean;
  focus(): void;
  getBoundingClientRect(): { width: number; height: number };
};

const body = { name: "body" } as unknown as FakeElement;

/** The document every lifted helper reads through. Assigned to the global so
 *  the compiled source resolves `document` exactly as it does in a browser. */
const doc = { activeElement: body as unknown, body };
(globalThis as unknown as { document: unknown }).document = doc;

function el(name: string, opts?: { width?: number; height?: number; takesFocus?: boolean }): FakeElement {
  const width = opts?.width ?? 80;
  const height = opts?.height ?? 24;
  const node: FakeElement = {
    name,
    width,
    height,
    takesFocus: opts?.takesFocus ?? true,
    focus() {
      // A browser moves focus or does nothing, and says which only through
      // document.activeElement afterwards.
      if (node.takesFocus) doc.activeElement = node;
    },
    getBoundingClientRect: () => ({ width, height }),
  };
  return node;
}

function harness(children: FakeElement[]) {
  const queried: string[] = [];
  const panel = {
    name: "panel",
    querySelectorAll: (selector: string) => {
      queried.push(selector);
      return children;
    },
  };
  const dismissed: number[] = [];
  const api = build({ panel, dismiss: { current: () => dismissed.push(1) } });
  return {
    queried,
    dismissed,
    focusables: api.focusables as () => FakeElement[],
    focusFirstAvailable: api.focusFirstAvailable as (c: FakeElement[]) => boolean,
    onKey: api.onKey as (e: unknown) => void,
  };
}

/** A keydown, with the two things the handler is allowed to do to it recorded. */
function keyEvent(key: string, shiftKey = false) {
  const e = {
    key,
    shiftKey,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() { e.defaultPrevented = true; },
    stopPropagation() { e.propagationStopped = true; },
  };
  return e;
}

test("a zero-sized match is not offered as somewhere focus can go", () => {
  const hidden = el("hidden file input", { width: 0, height: 0 });
  const real = el("close button");
  const { focusables } = harness([hidden, real]);
  assert.deepEqual(
    focusables().map((e) => e.name),
    ["close button"],
    "the 0×0 match survived the filter — .focus() on it is a no-op and the wrap would hold nothing",
  );
});

test("only a box of no width AND no height is dropped", () => {
  // A control can legitimately be a sliver — a 1px-tall skip link, a rail that
  // has not been measured on this axis. Dropping those would take real
  // destinations out of the tab order, which is the opposite of the fix.
  const sliver = el("1px tall", { width: 120, height: 0 });
  const narrow = el("1px wide", { width: 0, height: 40 });
  const { focusables } = harness([sliver, narrow]);
  assert.deepEqual(focusables().map((e) => e.name), ["1px tall", "1px wide"]);
});

test("the filter keeps the panel's own order — Tab follows the DOM", () => {
  const items = [el("close"), el("search"), el("thumb 1"), el("thumb 2")];
  const { focusables } = harness(items);
  assert.deepEqual(focusables().map((e) => e.name), ["close", "search", "thumb 1", "thumb 2"]);
});

test("focus moves to the first candidate that will actually take it", () => {
  // The measurable case and the unmeasurable one in one list: the browser
  // refuses both, and says so about neither.
  const zeroSized = el("0×0", { width: 0, height: 0, takesFocus: false });
  const inCollapsedDetails = el("inside a closed <details>", { takesFocus: false });
  const reachable = el("done button");
  const { focusFirstAvailable } = harness([]);
  doc.activeElement = body;

  assert.equal(focusFirstAvailable([zeroSized, inCollapsedDetails, reachable]), true);
  assert.equal(
    (doc.activeElement as FakeElement).name,
    "done button",
    "focus stopped at an element that refused it, which is where the reader was stranded",
  );
});

test("when nothing takes focus it says so, rather than reporting success", () => {
  // The hook's answer to this is to fall back to the panel, and it can only
  // know to do that if this returns false.
  const { focusFirstAvailable } = harness([]);
  doc.activeElement = body;
  const refused = [el("a", { takesFocus: false }), el("b", { takesFocus: false })];
  assert.equal(focusFirstAvailable(refused), false);
  assert.equal(doc.activeElement, body, "focus was reported as moved and was not");
});

test("a candidate that takes focus ends the walk — later ones are left alone", () => {
  const first = el("first");
  const later = el("later");
  let laterFocused = false;
  later.focus = () => { laterFocused = true; };
  const { focusFirstAvailable } = harness([]);
  assert.equal(focusFirstAvailable([first, later]), true);
  assert.equal((doc.activeElement as FakeElement).name, "first");
  assert.equal(laterFocused, false, "focus was moved twice, so it landed past where the reader should be");
});

test("Tab off the last control wraps to the first, skipping the zero-sized one", () => {
  // The media upload dialog with nothing queued: 開始上傳 is disabled, so the
  // dropzone's hidden file input is the last thing the selector matches. Before
  // the filter, `last` was that input, `document.activeElement` was never it,
  // and this branch never ran — one Tab off 關閉 left the dialog.
  const close = el("close");
  const hidden = el("hidden file input", { width: 0, height: 0, takesFocus: false });
  const { onKey } = harness([close, hidden]);
  doc.activeElement = close;

  const e = keyEvent("Tab");
  onKey(e);
  assert.equal(e.defaultPrevented, true, "Tab was allowed to leave the panel");
  assert.equal((doc.activeElement as FakeElement).name, "close", "the wrap did not come back inside");
});

test("Shift+Tab off the first control wraps to the last real one", () => {
  const close = el("close");
  const done = el("done");
  const trailingHidden = el("hidden file input", { width: 0, height: 0, takesFocus: false });
  const { onKey } = harness([close, done, trailingHidden]);
  doc.activeElement = close;

  const e = keyEvent("Tab", true);
  onKey(e);
  assert.equal(e.defaultPrevented, true);
  assert.equal(
    (doc.activeElement as FakeElement).name,
    "done",
    "Shift+Tab wrapped onto the invisible element, so focus was nowhere",
  );
});

test("Tab from the middle of the panel is left to the browser", () => {
  // Over-reaching here would break every dialog: the trap only has business at
  // the two ends.
  const items = [el("close"), el("middle"), el("done")];
  const { onKey } = harness(items);
  doc.activeElement = items[1];

  const e = keyEvent("Tab");
  onKey(e);
  assert.equal(e.defaultPrevented, false, "the trap took over a Tab that was already staying inside");
  assert.equal(doc.activeElement, items[1]);
});

test("Tab with focus on <body> is pulled back in, not let out", () => {
  // Clicking a dialog's own heading — not a control — puts focus on <body>.
  // From there Tab restarts at the top of the document, which is the page the
  // dialog has told a screen reader is unavailable.
  const items = [el("close"), el("done")];
  const { onKey } = harness(items);
  doc.activeElement = body;

  const e = keyEvent("Tab");
  onKey(e);
  assert.equal(e.defaultPrevented, true, "Tab from <body> was allowed into the page behind the dialog");
  assert.equal((doc.activeElement as FakeElement).name, "close");
});

test("Shift+Tab with focus on <body> comes back at the end of the panel", () => {
  const items = [el("close"), el("done")];
  const { onKey } = harness(items);
  doc.activeElement = body;

  const e = keyEvent("Tab", true);
  onKey(e);
  assert.equal(e.defaultPrevented, true);
  assert.equal((doc.activeElement as FakeElement).name, "done");
});

test("focus elsewhere on the page is not yanked back — nested overlays", () => {
  // A dialog opened from inside another one lives outside the outer panel. Both
  // traps are listening; if the outer one treated "not mine" as "come back", it
  // would steal focus out of the inner dialog on every Tab. Only <body> — focus
  // nowhere at all — is treated as lost.
  const items = [el("close"), el("done")];
  const { onKey } = harness(items);
  const inner = el("a control in the dialog on top");
  doc.activeElement = inner;

  const e = keyEvent("Tab");
  onKey(e);
  assert.equal(e.defaultPrevented, false);
  assert.equal(doc.activeElement, inner);
});

test("Escape still closes, and still does not close the overlay underneath", () => {
  const { onKey, dismissed } = harness([el("close")]);
  const e = keyEvent("Escape");
  onKey(e);
  assert.equal(dismissed.length, 1, "Escape no longer dismisses");
  assert.equal(e.propagationStopped, true, "Escape would close every nested overlay at once");
});

test("the panel is queried with the shared focusable selector", () => {
  const { queried, focusables } = harness([el("close")]);
  focusables();
  assert.equal(queried.length, 1);
  assert.match(queried[0], /button:not\(\[disabled\]\)/);
  assert.match(queried[0], /\[tabindex\]:not\(\[tabindex="-1"\]\)/);
});

test("the opening focus falls back to the panel, and makes the panel focusable first", () => {
  // The behaviour above is in the effect, which needs React to run. What can be
  // asserted here is that the fallback exists and is not itself a silent no-op:
  // a bare <div> is not in the tab order, so `panel.focus()` without a tabindex
  // does nothing, and the reader is left on <body> after all.
  const src = readCode("app/modules/useOverlay.ts");
  assert.match(
    src,
    /if \(panel && !focusFirstAvailable\(focusables\(\)\)\)/,
    "the opening focus no longer checks whether it landed",
  );
  assert.match(src, /panel\.tabIndex = -1;/, "the panel fallback cannot take focus without a tabindex");
  assert.match(
    src,
    /if \(addedTabIndex\) panel\?\.removeAttribute\("tabindex"\)/,
    "a tabindex the hook added is left on the element after the overlay closes",
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import { compileDeclarations, jsxTags } from "./sourceEval";
import { readCode } from "./readCode";

/**
 * The search bar's dropdowns can be operated without a mouse.
 *
 * All four fields (縣市 / 地區 / 人數 / 設施) are one component, and it announced
 * an interface it did not have: the button carried `aria-haspopup="listbox"`,
 * `aria-expanded` and `aria-controls`, so a screen reader said "expanded,
 * listbox" — and inside were `<li role="option">` with only an `onClick`. No
 * `id`, no `tabindex`, no key handler, and no `aria-activedescendant` on the
 * button. Measured before the fix: `anyFocusableInList: 0`. That is worse than
 * a plain `<select>`, which at least works.
 *
 * The handler is lifted out of the component and run, rather than grepped for:
 * "there is a case for ArrowDown" and "ArrowDown moves the active row" are
 * different claims, and only the second one is the fix.
 */

const PATH = "app/modules/StaySearchBar.tsx";

/** Drive the real onKeyDown against a small model of the component's state.
 *
 *  The handler is rebuilt before every keypress, which is what React does: each
 *  render creates a fresh closure over that render's `open` / `activeIndex` /
 *  `value`. Building it once and pressing twice would test a stale closure that
 *  never exists in the running component. */
/* The key logic is one function, listboxKey, that both fields hand their
   own "where does a closed list open" and "what does Enter do" to. It is
   lifted out and run as it is, and each field's own handler and helpers are
   compiled around it, so the driver exercises the real code end to end. */
const listboxKey = compileDeclarations(PATH, ["listboxKey"])({}).listboxKey as (
  event: { key: string; preventDefault: () => void },
  state: Record<string, unknown>,
  openOn: (key: string) => number,
  choose: (index: number) => void,
) => void;

type DriverState = { open: boolean; activeIndex: number; prevented: number };

/** What useListbox binds for the handler on one render. */
function bound(state: DriverState, count: number) {
  const setActiveIndex = (v: number | ((i: number) => number)) => {
    state.activeIndex = typeof v === "function" ? v(state.activeIndex) : v;
  };
  const openAt = (i: number) => { state.open = true; state.activeIndex = i; };
  const close = () => { state.open = false; state.activeIndex = -1; };
  const listboxKeyDown = (e: never, openOn: never, choose: never) =>
    listboxKey(e, { open: state.open, count, activeIndex: state.activeIndex, setActiveIndex, openAt, close }, openOn, choose);
  return { close, listboxKeyDown };
}

function driver(items: Array<{ value: string; label: string; clear?: boolean }>, value = "") {
  const state = { open: false, activeIndex: -1, value, prevented: 0 };
  const build = compileDeclarations(PATH, ["selectedIndex", "commit", "onKeyDown"], [
    "disabled", "items", "value", "setValue", "close", "listboxKeyDown",
  ]);

  const press = (key: string) => {
    const { onKeyDown } = build({
      disabled: false,
      items,
      value: state.value,
      setValue: (v: string) => { state.value = v; },
      ...bound(state, items.length),
    }) as { onKeyDown: (e: { key: string; preventDefault: () => void }) => void };
    onKeyDown({ key, preventDefault: () => { state.prevented += 1; } });
    return state;
  };

  return { state, press };
}

const OPTIONS = [
  { value: "a", label: "A" },
  { value: "b", label: "B" },
  { value: "c", label: "C" },
];

test("the arrow keys open the list and move through it", () => {
  const d = driver(OPTIONS);
  d.press("ArrowDown");
  assert.equal(d.state.open, true, "ArrowDown does not open the list");
  assert.equal(d.state.activeIndex, 0);
  d.press("ArrowDown");
  assert.equal(d.state.activeIndex, 1, "ArrowDown does not move the active row");
  d.press("ArrowUp");
  assert.equal(d.state.activeIndex, 0);
  // Wrapping, so the last row is one key away from the first.
  d.press("ArrowUp");
  assert.equal(d.state.activeIndex, OPTIONS.length - 1, "ArrowUp does not wrap to the end");
  d.press("ArrowDown");
  assert.equal(d.state.activeIndex, 0, "ArrowDown does not wrap to the start");
});

test("Home and End jump to the ends, but only while open", () => {
  const d = driver(OPTIONS);
  d.press("End");
  assert.equal(d.state.open, false, "End opened the list; it should do nothing when closed");
  d.press("ArrowDown");
  d.press("End");
  assert.equal(d.state.activeIndex, OPTIONS.length - 1);
  d.press("Home");
  assert.equal(d.state.activeIndex, 0);
});

test("Enter chooses the active row and closes", () => {
  const d = driver(OPTIONS);
  d.press("ArrowDown");
  d.press("ArrowDown");
  d.press("Enter");
  assert.equal(d.state.value, "b", "Enter did not select the active row");
  assert.equal(d.state.open, false, "the list stayed open after choosing");
});

test("Escape closes without choosing, and Tab leaves", () => {
  const d = driver(OPTIONS, "a");
  d.press("ArrowDown");
  d.press("ArrowDown");
  d.press("Escape");
  assert.equal(d.state.open, false);
  assert.equal(d.state.value, "a", "Escape changed the value");

  const t = driver(OPTIONS);
  t.press("ArrowDown");
  t.press("Tab");
  assert.equal(t.state.open, false, "Tab left the list open behind the moving focus");
});

test("opening lands on the row that is already chosen", () => {
  // Otherwise a keyboard user has to count from the top to find where they are.
  const d = driver(OPTIONS, "c");
  d.press("ArrowDown");
  assert.equal(d.state.activeIndex, 2, "opening did not land on the selected row");
});

test("the clear row is part of the same sequence", () => {
  // It is drawn first when a value is set, so an index has to mean the same
  // thing to the key handler and to the renderer.
  const items = [{ value: "", label: "Any", clear: true }, ...OPTIONS];
  const d = driver(items, "a");
  d.press("ArrowDown");
  d.press("Home");
  d.press("Enter");
  assert.equal(d.state.value, "", "the clear row does not clear");
});

test("the markup gives the button something to point at", () => {
  const src = readCode(PATH);
  assert.match(src, /aria-activedescendant=/, "the button never names the active row");
  assert.match(src, /id=\{optionId\(index\)\}/, "the options have no ids, so aria-activedescendant cannot resolve");
  // The rows must not be in the tab order — focus stays on the button, which is
  // what aria-activedescendant is for.
  const options = jsxTags(PATH).filter((t) => t.attrs.get("role") === "option");
  assert.ok(options.length > 0, "no role=option rows found");
  for (const row of options) {
    assert.ok(row.attrs.has("id"), `an option has no id: ${row.text}`);
    assert.ok(!row.attrs.has("tabIndex"), "an option is in the tab order; focus belongs on the button");
  }
  /* EVERY listbox button, not the first one. This file has two — the single
     select and the 設施 multi-select — and checking only one is how the second
     went unnoticed until this assertion looped. */
  const buttons = jsxTags(PATH).filter((t) => t.attrs.get("aria-haspopup") === "listbox");
  assert.equal(buttons.length, 2, `expected 2 listbox buttons, found ${buttons.length}`);
  for (const button of buttons) {
    assert.ok(button.attrs.has("aria-activedescendant"), `a listbox button does not name the active row: ${button.text}`);
    assert.ok(button.attrs.has("onKeyDown"), `a listbox button has no key handler: ${button.text}`);
  }
  // A visible mark for the active row: the list is not focused, so :focus
  // cannot show it and a CSS rule has to.
  const css = readCode("app/globals.css");
  assert.match(css, /\.ssb-select-opt\.is-active/, "the active row has no visible style");
});


/* ── the 設施 multi-select ─────────────────────────────────────────────────── */

function facilitiesDriver(options: Array<{ value: string; label: string }>) {
  const state = { open: false, activeIndex: -1, prevented: 0, selected: [] as string[] };
  const build = compileDeclarations(PATH, ["onFacilitiesKeyDown"], ["options", "toggle", "listboxKeyDown"]);
  const press = (key: string) => {
    const { onFacilitiesKeyDown } = build({
      options,
      toggle: (v: string) => {
        state.selected = state.selected.includes(v)
          ? state.selected.filter((x) => x !== v)
          : [...state.selected, v];
      },
      listboxKeyDown: bound(state, options.length).listboxKeyDown,
    }) as { onFacilitiesKeyDown: (e: { key: string; preventDefault: () => void }) => void };
    onFacilitiesKeyDown({ key, preventDefault: () => {} });
    return state;
  };
  return { state, press };
}

const FACILITIES = [
  { value: "pool", label: "Pool" },
  { value: "spa", label: "Spa" },
  { value: "bbq", label: "BBQ" },
];

test("the facilities list ticks with the keyboard and stays open", () => {
  const d = facilitiesDriver(FACILITIES);
  d.press("ArrowDown");
  assert.equal(d.state.open, true);
  d.press("Enter");
  assert.deepEqual(d.state.selected, ["pool"], "Enter did not tick the active row");
  /* Deliberately still open: this is a multi-select, and closing after each
     tick would mean reopening the panel once per facility. */
  assert.equal(d.state.open, true, "the multi-select closed after one tick");
  d.press("ArrowDown");
  d.press(" ");
  assert.deepEqual(d.state.selected, ["pool", "spa"], "Space did not tick the second row");
  // Ticking a chosen row again removes it.
  d.press("Enter");
  assert.deepEqual(d.state.selected, ["pool"]);
});

test("the facilities list closes on Escape without losing what was ticked", () => {
  const d = facilitiesDriver(FACILITIES);
  d.press("ArrowDown");
  d.press("Enter");
  d.press("Escape");
  assert.equal(d.state.open, false);
  assert.deepEqual(d.state.selected, ["pool"], "Escape discarded the selection");
});

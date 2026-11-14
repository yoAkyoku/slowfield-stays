import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readCode, readStyles } from "./readCode";

/**
 * The topbar's menus must paint above the page, not under it.
 *
 * `.admin-topbar` uses `backdrop-filter: blur(14px)`, and backdrop-filter
 * creates a stacking context. Every z-index inside the bar is therefore sealed
 * within it — the language menu's `z-index: 50` competes only with its
 * siblings, never with the page. The bar itself was `position: static;
 * z-index: auto`, which paints below ANY positioned page content, so the
 * sticky `.stays-workspace-header` (z-index: 5) covered the menu's second row.
 *
 * The visible result was a language menu that offered 中文 and appeared to have
 * no English at all. English was in the DOM the whole time, full opacity,
 * correct colour, simply painted over — which is why it read as a missing
 * feature rather than a CSS bug.
 *
 * The bar has to stay BELOW the mobile drawer, which covers it when open.
 */

const CSS = readStyles("app/globals.css");

function rule(selector: string): string {
  const needle = String.fromCharCode(10) + selector + " {";
  const at = CSS.indexOf(needle);
  assert.ok(at !== -1, `rule not found: ${selector}`);
  const open = at + needle.length;
  return CSS.slice(open, CSS.indexOf("}", open));
}

function num(body: string, prop: string): number | null {
  for (const declaration of body.replace(/\/\*[\s\S]*?\*\//g, "").split(";")) {
    const [name, value] = declaration.split(":");
    if (value && name.trim() === prop) {
      const parsed = Number.parseInt(value.trim(), 10);
      return Number.isNaN(parsed) ? null : parsed;
    }
  }
  return null;
}

const TOPBAR = rule(".admin-topbar");

test("the topbar establishes its own place in the page's stacking order", () => {
  // Without a position, z-index does nothing at all.
  assert.match(TOPBAR, /position:\s*(relative|sticky)/);
  assert.ok(num(TOPBAR, "z-index") !== null, "the topbar declares no z-index");
  assert.match(TOPBAR, /position:\s*sticky/, "the admin header scrolls away");
  assert.match(TOPBAR, /top:\s*0/, "the sticky admin header has no top anchor");
});

test("the sidebar hamburger stays at the top while its navigation scrolls", () => {
  const sidebarHeader = rule(".sb-header");
  assert.match(sidebarHeader, /position:\s*sticky/, "the sidebar header scrolls away");
  assert.match(sidebarHeader, /top:\s*0/, "the sidebar header has no top anchor");
});

test("it outranks positioned page content", () => {
  const topbar = num(TOPBAR, "z-index")!;
  // The sticky section headers are the things that covered the menu.
  // .stays-workspace-header is gone (pages use the kit PageHeader, which is not
  // sticky); the sticky things left on admin pages are the kit's save bar and
  // the frozen first column of wide tables.
  for (const selector of [".a-form-actions--sticky", ".admin-shell .cms-sticky-first thead th:first-child"]) {
    const z = num(rule(selector), "z-index");
    /* Was `if (z === null) continue`, which is a silent pass: the list holds one
       selector, so a rename, a move into a comma group, or the z-index simply
       being dropped would have left this test asserting nothing while staying
       green. Not hypothetical here — `rule()` matches `selector + " {"`, so
       writing this selector alongside another is enough to make it unfindable.
       An unmeasurable selector is a broken test, not a passing one. */
    assert.ok(
      z !== null,
      `${selector} has no findable z-index — either the rule was renamed or it ` +
        `is now written in a comma group, and this check stopped covering it`,
    );
    assert.ok(topbar > z!, `${selector} is z-index ${z}, topbar only ${topbar}`);
  }
});

test("it stays below the mobile drawer, which must cover it", () => {
  const topbar = num(TOPBAR, "z-index")!;
  const overlay = num(rule(".sb-overlay"), "z-index");
  assert.ok(overlay !== null, ".sb-overlay declares no z-index");
  assert.ok(topbar < overlay!, `topbar ${topbar} would sit above the drawer overlay ${overlay}`);
});

test("the mobile hamburger paints above the sticky topbar and below the drawer", () => {
  const topbar = num(TOPBAR, "z-index")!;
  const trigger = num(rule(".sb-mobile-trigger"), "z-index");
  const overlay = num(rule(".sb-overlay"), "z-index")!;
  assert.ok(trigger !== null, ".sb-mobile-trigger declares no z-index");
  assert.ok(trigger! > topbar, `hamburger ${trigger} is hidden behind topbar ${topbar}`);
  assert.ok(trigger! < overlay, `hamburger ${trigger} would cover drawer overlay ${overlay}`);
});

test("the mobile hamburger survives a cached copy of the old stylesheet", () => {
  const sidebar = readCode("app/admin/modules/AdminSidebar.tsx");
  assert.match(sidebar, /className="sb-mobile-trigger"[\s\S]*?style=\{\{\s*zIndex:\s*61\s*\}\}/);
});

test("the backdrop-filter that causes this is still there", () => {
  // If it is ever removed the seal disappears and this rule can be simplified;
  // while it is here, the z-index above is load-bearing.
  assert.match(TOPBAR, /backdrop-filter:\s*blur/);
});

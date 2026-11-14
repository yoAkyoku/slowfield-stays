import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readCode } from "./readCode";

/**
 * Anything reorderable by dragging must also be reorderable by pressing.
 *
 * HTML5 drag and drop does not fire on a touch screen. Three editors relied on
 * it alone, so on a phone or tablet the order could not be changed at all — not
 * awkwardly, not at all, at any viewport width:
 *
 *   - villa page blocks (PropertyBlockEditor)
 *   - page order in 頁面管理, which also sets nav and footer order (SitePageEditor)
 *
 * The homepage editor had shipped ChevronUp/ChevronDown all along, which is
 * what made the gap easy to miss: the same job had a working control one screen
 * away. Keyboard users were locked out too, for the same reason.
 */

const EDITORS = [
  {
    file: "app/admin/(dashboard)/homepage/HomepageBlockEditor.tsx",
    label: "homepage blocks",
  },
  {
    file: "app/admin/(dashboard)/sites/[id]/pages/[pageKey]/PropertyBlockEditor.tsx",
    label: "villa page blocks",
  },
  {
    file: "app/admin/(dashboard)/sites/[id]/SitePageEditor.tsx",
    label: "page order",
  },
];

for (const { file, label } of EDITORS) {
  const src = readFileSync(file, "utf8");

  test(`${label}: drag is present, so a press alternative is required`, () => {
    // If dragging ever goes away this test should stop demanding an
    // alternative to it — but while it is here, so is the requirement.
    assert.match(src, /onDragStart=/, `${file} no longer uses drag — revisit this test`);
  });

  test(`${label}: offers a move-up and a move-down control`, () => {
    const up = /aria-label=\{[^}]*(?:上移|Move up)/.test(src);
    const down = /aria-label=\{[^}]*(?:下移|Move down)/.test(src);
    assert.ok(up, `${file} has no labelled move-up control`);
    assert.ok(down, `${file} has no labelled move-down control`);
  });

  test(`${label}: the move controls disable at the ends instead of wrapping`, () => {
    assert.match(
      src,
      /disabled=\{index === 0\}/,
      `${file} does not disable move-up on the first row`,
    );
    assert.match(
      src,
      /disabled=\{index === (?:blocks|pages)\.length - 1\}/,
      `${file} does not disable move-down on the last row`,
    );
  });
}

test("page reordering persists the same way whether dragged or pressed", () => {
  // The drop handler wrote sort_order overrides and called autoSavePages
  // inline. If the button path skipped that, an order changed on a phone would
  // look right and be gone on reload.
  const src = readCode("app/admin/(dashboard)/sites/[id]/SitePageEditor.tsx");
  const helper = src.slice(src.indexOf("const movePage"), src.indexOf("const [draggedPageId"));
  assert.match(helper, /sort_order: i/, "movePage does not renumber sort_order");
  assert.match(helper, /autoSavePages\(overrides\)/, "movePage does not persist");
});

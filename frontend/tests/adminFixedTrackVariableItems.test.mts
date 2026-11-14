import assert from "node:assert/strict";
import test from "node:test";
import { readCode, readStyles } from "./readCode.mts";

/**
 * The admin half of the fixed-tracks / variable-items audit.
 *
 * Same defect as `fixedTrackVariableItems.test.mts`, found on 正式發布前營運檢查
 * (/admin/readiness): the 工程驗證命令 card declares THREE columns
 * (`22px minmax(0, 1fr) auto`) while SubmitButton renders FIVE children —
 * span / strong / code / small / em. Only `em` was ever given a column, so
 * `small` auto-placed into the third track beside it. That track is `auto`, so
 * it took the detail sentence's max-content width and starved `minmax(0, 1fr)`.
 *
 * Measured at a 1440px viewport before the fix: 「Python tests」 rendered 0px
 * wide, and `cd backend && python -m pytest` rendered 0px wide and 450px tall —
 * the command, which is the entire point of the card, came out one character
 * per line. At 1024px all four buttons did. The declared rows read
 * `38.4px 450px 0px 0px`: two empty rows invented by `grid-row: 1 / span 4` on
 * an icon that had only two rows to span.
 *
 * The second cause sat one level up. `.readiness-command-grid` was
 * `repeat(2, minmax(0, 1fr))`, halving a column that is only whatever is left
 * after `.readiness-commands` gives its heading a 240px floor — 248px wide at a
 * 900px viewport. The 1fr fallback only arrives at 820px, so every width from
 * 820px to roughly 1400px divided a width that was never enough for two.
 *
 * Every CSS assertion here is POSITIONAL — the LAST declaration of that
 * property on that selector outside an at-rule. globals.css is 36,000 lines
 * with a long tail of overrides, so "the value appears somewhere" is not
 * evidence that it wins.
 */

const CSS = readStyles("app/globals.css");
const READINESS = "app/admin/(dashboard)/readiness/page.tsx";

/* ── 1. the two command groups wrap instead of halving a narrow column ───── */

/* ── The 工程驗證命令 list, after the admin kit migration ─────────────────────
   The commands used to be a three-track grid per button (icon / copy / badge),
   and every test above this line's helpers guarded one way that grid could put
   copy into the badge's column. The list is now the kit checklist: each command
   is a flex row (mark, a text column that can shrink, the badge at the end) —
   there are no tracks to land in. What still has to hold is that long commands
   wrap inside their own column instead of pushing the badge off the row, and
   that the two groups stack on a narrow screen. */

test("the commands really are grouped, and the groups stack on narrow screens", () => {
  const src = readCode(READINESS);
  assert.match(src, /<Grid cols=\{2\}>\s*\{commandCopy\.groups\.map\(\(group, groupIndex\) => \(/,
    `${READINESS}: the command groups are no longer laid out in a two-column kit Grid`);
  assert.match(CSS, /@media \(max-width: 760px\) \{[\s\S]*?\.a-grid--2,[\s\S]*?\{ grid-template-columns: 1fr; \}/,
    "the kit two-column grid no longer collapses to one column on phones");
});

test("each command row keeps mark, copy and badge in that order", () => {
  const src = readCode(READINESS);
  assert.match(
    src,
    /<SubmitButton className="readiness-toggle">\s*\{checkMark\(done\)\}\s*<span className="readiness-toggle__text">\s*<strong>\{title\}<\/strong>\s*<code>\{command\}<\/code>\s*<span className="a-checklist__text">\{detail\}<\/span>\s*<\/span>\s*<Badge/,
    "the command row no longer renders mark / title / command / detail / badge in order",
  );
});

test("a long command wraps inside its own column instead of pushing the badge out", () => {
  const row = CSS.match(/\.readiness-toggle \{([^}]*)\}/)?.[1] ?? "";
  assert.match(row, /display:\s*flex/, "the command row is no longer a flex row");
  const text = CSS.match(/\.readiness-toggle__text \{([^}]*)\}/)?.[1] ?? "";
  assert.match(text, /flex:\s*1/, "the copy column no longer takes the free space");
  assert.match(text, /min-width:\s*0/, "the copy column cannot shrink, so a long command widens the row");
  const code = CSS.match(/\.readiness-toggle__text code \{([^}]*)\}/)?.[1] ?? "";
  assert.match(code, /overflow-wrap:\s*anywhere/, "a long command cannot break, so it overflows the row");
});

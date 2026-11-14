import assert from "node:assert/strict";
import test from "node:test";
import { readStyles, readCode } from "./readCode.mts";

/**
 * 卡片區對齊內文 — the opt-in that puts the CMS card list on the same vertical
 * axis as the copy above it (客戶: 內容要置中).
 *
 * Measured on /brand before the change: the rich-text blocks are capped at
 * 960px and centred, while `.category-browse-section` had no max-width at all.
 * Its inner edges therefore landed 62px OUTSIDE the copy at a 1440px viewport
 * and 24px INSIDE it at 1158px — never aligned, and the mismatch reversed
 * direction as the window resized.
 *
 * Every assertion here guards a way this can regress silently:
 *   - the two measures drifting apart again (each hard-coding its own number),
 *   - the card text centring but the tag row above it not (that row is a flex
 *     container, where `text-align` does nothing),
 *   - the default flipping ON and redrawing 最新消息 / 旅遊專欄 / 選品 uninvited,
 *   - the switch saving but falling outside the unsaved-work guard.
 */

const CSS = readStyles("app/globals.css");

type Decl = { at: number; value: string };
function declarations(selector: string, property: string): Decl[] {
  const out: Decl[] = [];
  const RULE = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = RULE.exec(CSS); m; m = RULE.exec(CSS)) {
    if (!m[1].split(",").map((s) => s.replace(/\s+/g, " ").trim()).includes(selector)) continue;
    for (const d of m[2].split(";")) {
      const c = d.indexOf(":");
      if (c === -1 || d.slice(0, c).trim() !== property) continue;
      out.push({ at: m.index, value: d.slice(c + 1).replace(/\s+/g, " ").trim() });
    }
  }
  return out;
}

const SECTION = ".category-browse-section.is-cards-match-text";
const COPY = ".property-rich-text.is-centered";

test("the card list is capped at a measure, not left unbounded", () => {
  const d = declarations(SECTION, "max-width").at(-1);
  assert.ok(d, "the card area has no max-width; it goes back to overhanging the copy");
  const m = declarations(SECTION, "margin-inline").at(-1);
  assert.ok(m && m.value === "auto", "a capped section that is not centred sits off-axis instead");
});

test("the copy and the card list read the SAME measure", () => {
  // Two literals drift the moment somebody edits one of them. One variable is
  // the whole reason the edges stay together.
  const card = declarations(SECTION, "max-width").at(-1)!.value;
  const copy = declarations(COPY, "max-width").at(-1);
  assert.ok(copy, "the centred copy variant lost its max-width");
  /* The SAME variable, whichever one it is. Naming --index-measure pinned the
     answer rather than the property: when the block frame moved to
     --block-measure the copy went with it and this failed for a change that
     preserved exactly what it protects. What must hold is that neither side
     hard-codes a literal and both read one source. */
  const varOf = (v: string) => /var\((--[a-z-]+)/.exec(v)?.[1] ?? null;
  assert.ok(varOf(card), `the card area hard-codes its width (${card}) instead of sharing the copy's measure`);
  assert.ok(varOf(copy!.value), `the copy hard-codes its width (${copy!.value}); the two can now drift apart`);
  assert.equal(
    varOf(card),
    varOf(copy!.value),
    `the cards read ${varOf(card)} and the copy reads ${varOf(copy!.value)} — they will drift apart`,
  );
});

test("the shared measure is actually declared somewhere", () => {
  // var() with a fallback fails open, so a missing declaration is invisible.
  const card = declarations(SECTION, "max-width").at(-1)!.value;
  const name = /var\((--[a-z-]+)/.exec(card)![1];
  assert.ok(
    declarations(":root", name).length > 0,
    `${name} is referenced but never declared`,
  );
});

test("card copy centres, and so does the tag row above it", () => {
  const bodyAlign = declarations(`${SECTION} .article-card-body`, "text-align").at(-1);
  assert.ok(bodyAlign && bodyAlign.value === "center", "the card copy is not centred");
  /* `.tags` is `display: flex`. text-align on the parent reaches the title and
     the summary but leaves the chips hard left, which reads as a bug, not a
     layout. */
  const tags = declarations(`${SECTION} .article-card-body .tags`, "justify-content").at(-1);
  assert.ok(
    tags && tags.value === "center",
    "the tag row keeps its chips hard left while the title and summary centre around them",
  );
});

test("nothing changes on a page that has not opted in", () => {
  const page = readCode("app/modules/content/CategoryPage.tsx");
  assert.match(
    page,
    /cards_match_text === true/,
    "the gate is not `=== true`: an index that was never configured would be redrawn",
  );
  assert.match(page, /is-cards-match-text/, "the class is never applied, so the setting does nothing");
});

test("the save keeps it off when the form never carried the field", () => {
  const action = readCode("app/admin/modules/propertyPagesActions.ts");
  const line = /^.*_cards_match_text.*$/m.exec(action)?.[0];
  assert.ok(line, "the save action drops the field, so the switch never persists");
  assert.match(
    line!,
    /"0"/,
    "an absent field defaults ON, which would narrow every grid on the next save of any page",
  );
  /* `(^|[^_\w])` so the underscore-prefixed INPUT key two lines above does not
     satisfy it — the point of this line is that the value reaches the stored
     config, and `_cards_match_text` is the form field it comes from. */
  assert.match(
    action,
    /(^|[^_\w])cards_match_text:\s*\w/m,
    "the value is read but never written to the page config",
  );
});

test("the switch is inside the unsaved-work guard", () => {
  /* The guard compares two snapshots. A field left out of them makes the
     toggle look free of consequence: navigate away and it is gone, with no
     warning — the failure the guard exists to prevent. */
  const editor = readCode("app/admin/(dashboard)/sites/[id]/pages/[pageKey]/PropertyBlockEditor.tsx");
  assert.match(editor, /cardsMatchText: boolean;/, "not part of the snapshot type");
  assert.match(editor, /v.cardsMatchText/, "not serialised into the snapshot");
  assert.match(editor, /cardsMatchText: initialCardsMatchText/, "the baseline snapshot omits it");
  assert.match(editor, /_cards_match_text !== undefined/, "a recovered draft would silently lose the setting");
});

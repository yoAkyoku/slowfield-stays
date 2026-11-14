import assert from "node:assert/strict";
import test from "node:test";
import { readStyles } from "./readCode";

/**
 * A row's actions are reachable without a mouse.
 *
 * The three admin lists each hid their 操作 column behind
 * `opacity: 0; pointer-events: none`, revealed by `:hover` on the row. On a
 * tablet there is no hover, so the column read as empty and the buttons could
 * not be pressed at all — the admin is meant to be usable on an iPad, and
 * 表單聯絡 in particular is the screen someone works from away from a desk.
 * `:focus-within` covered a keyboard; nothing covered a finger.
 *
 * It also cost a session of debugging: with the buttons hidden, an automated
 * click at the button's own centre landed on the CELL — `elementsFromPoint`
 * returned the parent, because an element with `pointer-events: none` is not in
 * the hit-test tree — and the resulting "the button does nothing" was reported
 * as a product bug that did not exist.
 *
 * The check is positional rather than existential. globals.css is ~36,000 lines
 * with a long tail of later overrides, so what matters is the LAST declaration
 * outside an at-rule — the same trap carouselTouchAction.test.mts and
 * roleTypeCascade.test.mts exist for.
 */

const CSS = readStyles("app/globals.css");

/** The container each list puts its row buttons in. */
const ACTION_CONTAINERS = [
  { selector: ".inquiry-actions-cell .admin-row-actions", list: "表單聯絡" },
  { selector: ".cms-actions-cell .admin-row-actions", list: "CMS 內容頁 / 橫幅" },
  { selector: ".stay-catalog-actions .admin-row-actions", list: "住宿" },
  /* The bare container, which is what the three above are a scoped variant of
     and what 帳號管理 uses on its own — 刪除 / 復原 / 永久刪除 on an admin account
     sit in it with nothing between them and this rule. It has no opacity or
     pointer-events declaration today; the point of listing it is that the next
     one has to come past this test. */
  { selector: ".admin-row-actions", list: "帳號管理 (the shared bar)" },
];

type Decl = { at: number; value: string; inAtRule: boolean };

/**
 * Every declaration of `property` landing on exactly `selector`, in source
 * order, with the at-rule depth carried forward across matches — the rule regex
 * only ever matches an innermost rule, so braces inside a match balance and
 * only the text between matches moves the depth.
 */
function declarationsFor(selector: string, property: string): Decl[] {
  const out: Decl[] = [];
  const RULE = /([^{}]+)\{([^{}]*)\}/g;
  let cursor = 0;
  let depth = 0;
  for (let m = RULE.exec(CSS); m; m = RULE.exec(CSS)) {
    for (const ch of CSS.slice(cursor, m.index)) {
      if (ch === "{") depth += 1;
      else if (ch === "}") depth -= 1;
    }
    cursor = m.index + m[0].length;
    const selectors = m[1].split(",").map((s) => s.replace(/\s+/g, " ").trim());
    if (!selectors.includes(selector)) continue;
    for (const declaration of m[2].split(";")) {
      const colon = declaration.indexOf(":");
      if (colon === -1) continue;
      if (declaration.slice(0, colon).trim() !== property) continue;
      out.push({
        at: m.index,
        value: declaration.slice(colon + 1).replace(/\s+/g, " ").trim(),
        inAtRule: depth > 0,
      });
    }
  }
  return out;
}

for (const { selector, list } of ACTION_CONTAINERS) {
  test(`${list}: the row actions are not transparent by default`, () => {
    const winner = declarationsFor(selector, "opacity").filter((d) => !d.inAtRule).at(-1);
    /* No declaration at all is fine — the initial value is 1. What is not fine
       is one that hides them. */
    if (!winner) return;
    assert.notEqual(
      winner.value,
      "0",
      `${selector} is invisible until something reveals it; a touch device never will`,
    );
  });

  test(`${list}: the row actions accept a tap`, () => {
    const winner = declarationsFor(selector, "pointer-events").filter((d) => !d.inAtRule).at(-1);
    if (!winner) return;
    assert.notEqual(
      winner.value,
      "none",
      `${selector} is outside the hit-test tree, so its buttons cannot be pressed by any input`,
    );
  });
}

test("no admin row-action group is revealed by hover alone", () => {
  /* The shape that caused it, caught by shape rather than by selector: a rule
     whose only trigger is `:hover` handing back `opacity` or `pointer-events`
     means the default took them away, and a finger cannot get them back.
     `:focus-within` alongside is not a rescue — that is a keyboard. */
  const offenders: string[] = [];
  const RULE = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = RULE.exec(CSS); m; m = RULE.exec(CSS)) {
    const selectorText = m[1].replace(/\s+/g, " ").trim();
    if (!/:hover/.test(selectorText)) continue;
    if (!/admin-row-actions|actions-cell|catalog-actions/.test(selectorText)) continue;
    const body = m[2];
    if (/pointer-events\s*:\s*auto/.test(body) || /opacity\s*:\s*1/.test(body)) {
      offenders.push(selectorText.slice(0, 90));
    }
  }
  assert.deepEqual(
    offenders,
    [],
    "these rules give the row actions back on hover, which means something took them away: "
      + offenders.join(" | "),
  );
});

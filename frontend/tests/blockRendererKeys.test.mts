import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { readCode } from "./readCode";
import { REGISTRY } from "./blockTypes.mts";

/**
 * Every block a renderer returns carries a React key.
 *
 * `PropertyPageRenderer`'s switch had 23 cases and one of them — `contact_form`
 * — was missing `key={block.id}`. It produced no warning, because
 * `renderWithPairs` wraps each result in a `BlockWrapper` that has its own key,
 * so the returned element is a lone child rather than an array member. That is
 * the whole problem with fixing it and stopping: the defect is invisible today
 * and becomes a real one the moment a caller puts a render result straight into
 * an array — and nothing would have said so.
 *
 * The renderers now draw from the shared table in modules/blockRegistry and
 * keep a short table of their own for the types they draw differently. Every
 * entry of every one of those tables is checked, so a type added tomorrow is
 * covered without anyone remembering to list it.
 */

const TABLES = [
  REGISTRY,
  "app/modules/home/HomepageBlocks.tsx",
  "app/modules/content/PageBlocks.tsx",
];

/** Root JSX elements a `type: (c) => …` table entry produces, through ternaries and parens. */
function entryElements(text: string): Array<{ entry: string; tag: string; hasKey: boolean; text: string }> {
  const file = ts.createSourceFile("x.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: Array<{ entry: string; tag: string; hasKey: boolean; text: string }> = [];
  const roots = (e: ts.Node): ts.Node[] => {
    if (ts.isParenthesizedExpression(e)) return roots(e.expression);
    if (ts.isConditionalExpression(e)) return [...roots(e.whenTrue), ...roots(e.whenFalse)];
    return [e];
  };
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAssignment(node)
      && ts.isArrowFunction(node.initializer)
      && node.initializer.parameters[0]?.name.getText(file) === "c"
    ) {
      for (const r of roots(node.initializer.body)) {
        if (!ts.isJsxElement(r) && !ts.isJsxSelfClosingElement(r)) continue; // e.g. SHARED_BLOCKS.x(c)
        const opening = ts.isJsxElement(r) ? r.openingElement : r;
        const hasKey = opening.attributes.properties.some(
          (p) => ts.isJsxAttribute(p) && ts.isIdentifier(p.name) && p.name.text === "key",
        );
        out.push({ entry: node.name.getText(file), tag: opening.tagName.getText(file), hasKey, text: opening.getText(file).slice(0, 90) });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out;
}

for (const path of TABLES) {
  test(`${path}: every block drawn from the table has a key`, () => {
    const elements = entryElements(readCode(path));
    assert.ok(elements.length > 0, `no table entries found in ${path} — is the parser still finding them?`);
    const missing = elements.filter((e) => !e.hasKey);
    assert.deepEqual(
      missing.map((e) => e.entry),
      [],
      `these blocks are drawn without a key:\n  ${missing.map((e) => e.text).join("\n  ")}`,
    );
  });
}

test("the shared table is where most blocks come from", () => {
  assert.ok(entryElements(readCode(REGISTRY)).length >= 20, "the shared table has shrunk — did a renderer grow its own switch again?");
});

test("the guard would notice a missing key", () => {
  /* The check above is only worth having if it can fail. A table where one
     entry lost its key is simulated here rather than trusted. */
  const text = readCode(REGISTRY).replace(" key={c.key}", "");
  assert.equal(entryElements(text).filter((e) => !e.hasKey).length, 1, "removing one key went unnoticed");
});

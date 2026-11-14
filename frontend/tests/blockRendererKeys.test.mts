import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { readCode } from "./readCode";

/**
 * Every block a renderer returns carries a React key.
 *
 * `PropertyPageRenderer`'s switch has 23 cases and one of them — `contact_form`
 * — was missing `key={block.id}`. It produced no warning, because
 * `renderWithPairs` wraps each result in a `BlockWrapper` that has its own key,
 * so the returned element is a lone child rather than an array member. That is
 * the whole problem with fixing it and stopping: the defect is invisible today
 * and becomes a real one the moment a caller puts a render result straight into
 * an array — and nothing would have said so.
 *
 * Measured: deleting `key={block.id}` from that case passed all 822 tests.
 * This is the assertion that makes it fail.
 *
 * Written as "every returned element", not "these 23 named cases", so a case
 * added tomorrow is covered without anyone remembering to list it.
 */

/* The two renderers that dispatch with a switch. PageBlocks is deliberately
   absent: it dispatches through a map of `render:` callbacks rather than a
   switch, so "the element this case produces" is a different shape there and a
   detector that pretended otherwise would report zero and pass for nothing —
   which is exactly what the first version of this file did. */
const RENDERERS = [
  "app/modules/property/PropertyPageRenderer.tsx",
  "app/modules/home/HomepageBlocks.tsx",
];

/** Root JSX elements a switch case produces — whether it returns them
 *  (PropertyPageRenderer) or assigns them to a local (HomepageBlocks). */
function returnedElements(path: string): Array<{ tag: string; hasKey: boolean; text: string }> {
  const text = readCode(path);
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: Array<{ tag: string; hasKey: boolean; text: string }> = [];

  const unwrap = (node: ts.Node): ts.Node => {
    let current = node;
    while (ts.isParenthesizedExpression(current)) current = current.expression;
    return current;
  };

  const insideCase = (node: ts.Node): boolean => {
    for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
      if (ts.isCaseClause(p) || ts.isDefaultClause(p)) return true;
      if (ts.isFunctionLike(p)) return false;
    }
    return false;
  };

  const record = (expr: ts.Node): void => {
    const e = unwrap(expr);
    if (!ts.isJsxElement(e) && !ts.isJsxSelfClosingElement(e)) return;
    const opening = ts.isJsxElement(e) ? e.openingElement : e;
    const hasKey = opening.attributes.properties.some(
      (prop) => ts.isJsxAttribute(prop) && ts.isIdentifier(prop.name) && prop.name.text === "key",
    );
    out.push({ tag: opening.tagName.getText(file), hasKey, text: opening.getText(file).slice(0, 90) });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isReturnStatement(node) && node.expression && insideCase(node)) {
      record(node.expression);
    }
    // `el = <BlockX … />; break;` — the other shape the same dispatch takes.
    if (
      ts.isBinaryExpression(node)
      && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && insideCase(node)
    ) {
      record(node.right);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out;
}

for (const path of RENDERERS) {
  test(`${path}: every block returned from the switch has a key`, () => {
    const elements = returnedElements(path);
    assert.ok(elements.length > 5, `only ${elements.length} returned elements found — is the parser still finding the switch?`);
    const missing = elements.filter((e) => !e.hasKey);
    assert.deepEqual(
      missing.map((e) => e.tag),
      [],
      `these blocks are returned without a key:\n  ${missing.map((e) => e.text).join("\n  ")}`,
    );
  });
}

test("the guard would notice a missing key", () => {
  /* The check above is only worth having if it can fail. A renderer where one
     case lost its key is simulated here rather than trusted — the same reason
     the fix needed a test in the first place. */
  const text = readCode(RENDERERS[0]).replace(" key={block.id}", "");
  const file = ts.createSourceFile("probe.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let keyless = 0;
  const visit = (node: ts.Node): void => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const has = node.attributes.properties.some(
        (p) => ts.isJsxAttribute(p) && ts.isIdentifier(p.name) && p.name.text === "key",
      );
      if (!has) keyless += 1;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  assert.ok(keyless > 0, "removing every key produced no keyless element — the parser is not seeing the JSX");
});

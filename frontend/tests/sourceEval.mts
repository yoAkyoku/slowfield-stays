import ts from "typescript";
import { readCode } from "./readCode";

/**
 * Run a component's real helpers, instead of grepping for them.
 *
 * Most of this suite asserts against source text, which is the only option for
 * anything that needs React to run. But a fair number of the defects it guards
 * are not "is this call still here" — they are "does this code still do the
 * right thing when it runs twice". `setBlocks(blocks.map(…))` and
 * `setBlocks(prev => prev.map(…))` differ by four characters and are both
 * present in every version of the file; only one of them survives two writes in
 * one React tick. A substring assertion cannot tell those apart, and a test that
 * cannot tell them apart is not guarding the fix.
 *
 * So: lift the declaration out of the file with the TypeScript parser, compile
 * it, and call it. The code under test is the code that ships — not a copy of it
 * written into the test, which is the other way this file could have gone and
 * which drifts the moment anyone edits one side.
 *
 * Comments are blanked first (readCode), so a commented-out declaration reads as
 * missing rather than as passing.
 */

function parse(path: string): { file: ts.SourceFile; text: string } {
  const text = readCode(path);
  return {
    file: ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX),
    text,
  };
}

/** The source text of each named `const`/`function` declaration, wherever it
 *  sits in the file — several of these live inside the component body. */
export function declarationText(path: string, names: string[]): Map<string, string> {
  const { file } = parse(path);
  const found = new Map<string, string>();
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)) {
      found.set(node.name.text, node.getText(file));
    }
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && names.includes(decl.name.text)) {
          // The whole statement, so `const`/`let` and the terminator come with it.
          found.set(decl.name.text, node.getText(file));
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

/**
 * Compile the named declarations into a factory.
 *
 * `freeVars` are the bindings the declarations close over in the component —
 * state, setters, imported helpers. The factory takes them as an object and
 * hands back the compiled functions, so a test can drive them with a stand-in
 * for React's state queue.
 */
export function compileDeclarations(
  path: string,
  names: string[],
  freeVars: string[] = [],
): (ctx: Record<string, unknown>) => Record<string, (...args: never[]) => unknown> {
  const found = declarationText(path, names);
  const missing = names.filter((n) => !found.has(n));
  if (missing.length) {
    throw new Error(`${path}: no declaration for ${missing.join(", ")} (renamed, removed, or commented out)`);
  }
  const destructure = freeVars.length ? `const { ${freeVars.join(", ")} } = __ctx;` : "";
  const source = [
    "function __build(__ctx) {",
    destructure,
    ...names.map((n) => found.get(n)!),
    `return { ${names.join(", ")} };`,
    "}",
  ].join("\n");
  const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.Preserve },
  }).outputText;
  return new Function(`${js}\nreturn __build;`)() as never;
}

/** Compile a standalone expression lifted from a file (an array literal, a
 *  guard condition) into a value. `freeVars` work as above. */
export function evaluateExpression(expression: string, freeVars: string[] = []): (ctx: Record<string, unknown>) => unknown {
  const destructure = freeVars.length ? `const { ${freeVars.join(", ")} } = __ctx;` : "";
  const source = `function __build(__ctx) {\n${destructure}\nreturn (${expression});\n}`;
  const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.Preserve },
  }).outputText;
  return new Function(`${js}\nreturn __build;`)() as never;
}

/** The initialiser of a named `const`, as source text. */
export function initialiserText(path: string, name: string): string {
  const { file } = parse(path);
  let out: string | null = null;
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name && node.initializer) {
      out = node.initializer.getText(file);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  if (out === null) throw new Error(`${path}: no const ${name}`);
  return out;
}

export type JsxTag = {
  tag: string;
  /** Attribute name → source text of its value ("button", {0}, {a === b}). */
  attrs: Map<string, string>;
  /** The opening tag's own source, for messages. */
  text: string;
  /** The whole element including its children — used to ask what is inside it. */
  fullText: string;
};

/** Every JSX element in a file, with its attributes. Reading the tree rather
 *  than the raw text means an attribute is found however the line is wrapped,
 *  and never found inside a comment or an unrelated string. */
export function jsxTags(path: string): JsxTag[] {
  const { file } = parse(path);
  const out: JsxTag[] = [];
  const collect = (node: ts.JsxOpeningElement | ts.JsxSelfClosingElement): void => {
    const attrs = new Map<string, string>();
    for (const prop of node.attributes.properties) {
      if (!ts.isJsxAttribute(prop) || !ts.isIdentifier(prop.name)) continue;
      const init = prop.initializer;
      let value = "";
      if (!init) value = "true";
      else if (ts.isStringLiteral(init)) value = init.text;
      else if (ts.isJsxExpression(init) && init.expression) value = init.expression.getText(file);
      attrs.set(prop.name.text, value);
    }
    const whole = ts.isJsxOpeningElement(node) && node.parent ? node.parent.getText(file) : node.getText(file);
    out.push({ tag: node.tagName.getText(file), attrs, text: node.getText(file).slice(0, 200), fullText: whole });
  };
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) collect(node);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out;
}

/** The argument list (as source text) of every call to `name` in a file. */
export function callArguments(path: string, name: string): string[][] {
  const { file } = parse(path);
  const out: string[][] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.expression.getText(file) === name) {
      out.push(node.arguments.map((a) => a.getText(file)));
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out;
}

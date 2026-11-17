/**
 * Which block types a page renderer can draw, and with what.
 *
 * The renderers used to switch over every type, so a test could read the
 * `case "x"` labels. They now draw from the shared table in
 * modules/blockRegistry (SHARED_BLOCKS) and list only the types they draw
 * their own way, as entries of an object literal passed to renderBlockType.
 * These helpers read both, so "can this renderer draw x" keeps meaning what
 * the page will actually do.
 */
import ts from "typescript";
import { readCode } from "./readCode";

export const REGISTRY = "app/modules/blockRegistry.tsx";

/** `type: (c) => …` entries in a source file: property name → the arrow's body. */
function entries(src: string): Map<string, string> {
  const out = new Map<string, string>();
  const file = ts.createSourceFile("x.tsx", src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (node: ts.Node) => {
    if (
      ts.isPropertyAssignment(node) &&
      ts.isArrowFunction(node.initializer) &&
      node.initializer.parameters.length === 1 &&
      node.initializer.parameters[0].name.getText(file) === "c"
    ) {
      out.set(node.name.getText(file).replace(/^"|"$/g, ""), node.initializer.body.getText(file));
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out;
}

/** The shared table: type → the JSX it draws. */
export function sharedBlocks(): Map<string, string> {
  return entries(readCode(REGISTRY).slice(readCode(REGISTRY).indexOf("export const SHARED_BLOCKS")));
}

/** The types a renderer draws its own way: type → the JSX it draws. */
export function ownBlocks(file: string): Map<string, string> {
  return entries(readCode(file));
}

/** Every type a renderer can draw. */
export function drawnTypes(file: string): Set<string> {
  const src = readCode(file);
  const out = new Set([...src.matchAll(/case "([a-z_]+)"/g)].map((m) => m[1]));
  for (const t of ownBlocks(file).keys()) out.add(t);
  if (src.includes("renderBlockType(")) for (const t of sharedBlocks().keys()) out.add(t);
  return out;
}

/** The JSX a renderer draws for `type`: its own entry, else the shared one. */
export function drawing(file: string, type: string): string | undefined {
  return ownBlocks(file).get(type) ?? (readCode(file).includes("renderBlockType(") ? sharedBlocks().get(type) : undefined);
}

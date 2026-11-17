import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

import * as tr from "../app/modules/tr.ts";
import * as safeHtml from "../app/modules/safeHtml.ts";
import * as media from "../app/modules/media.ts";
import { sharedModule } from "./sharedModules.mts";

/**
 * "Nobody implemented this" and "the config is empty" look identical on the
 * page and have completely different fixes — which is the entire reason
 * reportUnknownBlock exists (see unknownBlock.ts). Four types in
 * ContentBlockRenderer were written as `if (block.type === "image" && block.url)`,
 * one condition covering both questions, so a block whose picture or URL had not
 * been chosen yet fell past every branch to the bottom of the loop and logged
 *
 *   [blocks] ContentBlockRenderer has no renderer for block type "image"
 *
 * about a type with a renderer three lines up. The one diagnostic written to
 * tell the two cases apart was reporting the wrong one.
 */

type El = { type: unknown; props: Record<string, unknown> };
function h(type: unknown, props: Record<string, unknown> | null, ...children: unknown[]): El {
  return { type, props: { ...(props ?? {}), children: children.length === 1 ? children[0] : children } };
}
const FRAGMENT = Symbol("fragment");

const reported: string[] = [];

function compile(file: string, imports: Record<string, unknown>): Record<string, unknown> {
  const js = ts.transpileModule(readFileSync(file, "utf8"), {
    fileName: file,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
      jsxFactory: "__h",
      jsxFragmentFactory: "__FRAGMENT",
    },
  }).outputText;
  const mod = { exports: {} as Record<string, unknown> };
  const req = (id: string) => {
    if (!(id in imports)) {
      const shared = sharedModule(file, id, (p, remap) => compile(p, remap(imports)));
      if (shared) return shared;
      throw new Error(`${file}: no stub for import "${id}"`);
    }
    return imports[id];
  };
  new Function("exports", "require", "module", "__h", "__FRAGMENT", js)(
    mod.exports, req, mod, h, FRAGMENT,
  );
  return mod.exports;
}

const stub = (name: string) => ({ default: () => h("div", { "data-stub": name }) });

const ContentBlockRenderer = compile("app/modules/content/ContentBlockRenderer.tsx", {
  react: {},
  "../safeHtml": safeHtml,
  "../tr": tr,
  "../media": media,
  "../property/blocks/BlockOembed": stub("oembed"),
  "../property/blocks/BlockPartners": stub("partners"),
  "../property/blocks/BlockRichText": stub("richtext"),
  // The real one dedupes per renderer+type and writes to the console; this
  // records every call instead, which is the thing under test.
  "../unknownBlock": {
    reportUnknownBlock: (renderer: string, type: unknown) => {
      reported.push(`${renderer}:${String(type)}`);
      return null;
    },
  },
}).default as (p: Record<string, unknown>) => unknown;

function draw(blocks: unknown[], depth = 0): string[] {
  reported.length = 0;
  ContentBlockRenderer({ blocks, depth, locale: "zh" });
  return [...reported];
}

const EMPTY_BUT_IMPLEMENTED: ReadonlyArray<readonly [string, Record<string, unknown>, number]> = [
  ["image", { type: "image" }, 0],
  ["image", { type: "image", url: "" }, 0],
  ["image_grid", { type: "image_grid", images: [] }, 0],
  ["image_grid", { type: "image_grid" }, 0],
  ["video_embed", { type: "video_embed" }, 0],
  ["video_embed", { type: "video_embed", url: "" }, 0],
  // Nesting deeper than one level is a deliberate refusal, not a missing case.
  ["columns", { type: "columns", items: [{ blocks: [] }] }, 1],
];

for (const [name, block, depth] of EMPTY_BUT_IMPLEMENTED) {
  test(`an empty ${name} block is not reported as a type with no renderer`, () => {
    assert.deepEqual(
      draw([block], depth),
      [],
      `${JSON.stringify(block)} at depth ${depth} was logged as unimplemented`,
    );
  });
}

test("a type that genuinely has no renderer is still reported", () => {
  // The diagnostic has to keep firing, or silencing the false ones would just
  // be the silent `return null` these renderers all used to end in.
  assert.deepEqual(draw([{ type: "carousel_of_carousels" }]), [
    "ContentBlockRenderer:carousel_of_carousels",
  ]);
});

test("the implemented types still draw when their content is there", () => {
  for (const [block, depth] of [
    [{ type: "image", url: "/a.jpg" }, 0],
    [{ type: "image_grid", images: [{ url: "/a.jpg" }] }, 0],
    [{ type: "video_embed", url: "https://youtu.be/abc" }, 0],
    [{ type: "columns", items: [{ blocks: [] }] }, 0],
  ] as Array<[Record<string, unknown>, number]>) {
    assert.deepEqual(draw([block], depth), [], `${String(block.type)} stopped rendering`);
  }
});

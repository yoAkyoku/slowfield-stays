import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";
import { compileDeclarations, declarationText, evaluateExpression, initialiserText, jsxTags } from "./sourceEval";

/**
 * The article editor's 編輯中（未儲存）preview must draw what it offers.
 *
 * The overlay has two tabs, 編輯中（未儲存）and 已儲存的頁面, and they were
 * contradicting each other. 合作品牌 is on this editor's own palette; an author
 * added one, filled in eight brands, and the draft tab showed nothing while the
 * saved tab showed the block correctly. Two previews that disagree are worse
 * than one that is merely wrong: after that, neither can be believed.
 *
 * The cause is that the draft preview is a hand-written switch over
 * `block.type` while the page goes through ContentBlockRenderer, so the two
 * drift by construction. The rule below is written against that: whatever the
 * public renderer draws, the preview draws too — by delegating to the same
 * component, not by growing a second copy of it.
 */

const CMS = "app/admin/(dashboard)/cms/PageBlockEditor.tsx";
const PUBLIC = "app/modules/content/ContentBlockRenderer.tsx";

/** The block types the preview has a branch for. */
function previewTypes(): Set<string> {
  const fn = declarationText(CMS, ["LivePreviewBlock"]).get("LivePreviewBlock");
  assert.ok(fn, `${CMS}: LivePreviewBlock is gone`);
  return new Set([...fn!.matchAll(/\.type === "([a-z_]+)"/g)].map((m) => m[1]));
}

/** Config-shaped types the published page draws, with the component each uses. */
function publicForeignTypes(): Map<string, string> {
  const src = readCode(PUBLIC);
  const out = new Map<string, string>();
  for (const m of src.matchAll(/raw\.type === "([a-z_]+)"\)\s*\{\s*return <([A-Za-z]+)/g)) {
    out.set(m[1], m[2]);
  }
  return out;
}

/** Whether a component's module default-exports an async function. */
function isAsyncComponent(componentName: string): boolean {
  const importLine = readCode(PUBLIC).match(
    new RegExp(`import ${componentName} from "([^"]+)"`),
  );
  if (!importLine) return false;
  const path = `app/modules/${importLine[1].replace(/^\.\.\/\.\.\//, "").replace(/^\.\.\//, "")}.tsx`;
  return /export default async function/.test(readCode(path));
}

test("every type the palette offers is drawn by the draft preview", () => {
  /* A type in PRIMARY_TYPES with no branch renders as nothing at all, which
     reads as "the preview is broken" rather than "this block does nothing" —
     and the author has no way to tell which. */
  const offered = evaluateExpression(initialiserText(CMS, "PRIMARY_TYPES"))({}) as string[];
  assert.ok(offered.length > 5, `only parsed ${offered.length} palette types — did PRIMARY_TYPES move?`);
  const drawn = previewTypes();
  const missing = offered.filter((t) => !drawn.has(t));
  assert.deepEqual(missing, [], `blank in 編輯中（未儲存）but on the palette: ${missing.join(", ")}`);
});

test("everything a column can hold is drawn too", () => {
  // Column children go through the same function, recursively.
  const nested = evaluateExpression(initialiserText(CMS, "COLUMN_TYPES"))({}) as string[];
  const drawn = previewTypes();
  assert.deepEqual(nested.filter((t) => !drawn.has(t)), []);
});

test("the preview draws what the published page draws, or cannot", () => {
  /* The self-maintaining half: whatever ContentBlockRenderer grows a branch
     for, this preview needs one as well, or the two tabs disagree again. The
     one permitted exception is a component the preview physically cannot call —
     an async server component — because rendering one from a client component
     throws and takes the whole editor down. */
  const drawn = previewTypes();
  const publicTypes = publicForeignTypes();
  assert.ok(publicTypes.size >= 3, `only found ${publicTypes.size} config-shaped branches in the public renderer`);
  for (const [type, component] of publicTypes) {
    if (drawn.has(type)) continue;
    assert.ok(
      isAsyncComponent(component),
      `the published page draws "${type}" with <${component}> and the draft preview does not — the two tabs contradict each other`,
    );
  }
});

test("the preview never renders an async server component", () => {
  /* Verified the hard way: adding <BlockOembed> here — which fetches the
     provider's oEmbed endpoint while rendering — replaced the whole editor with
     "An unknown Component is an async Client Component" the moment a page
     holding one was opened. */
  const rendered = new Set(
    jsxTags(CMS)
      .map((t) => t.tag)
      .filter((tag) => /^Block[A-Z]/.test(tag)),
  );
  for (const tag of rendered) {
    const importLine = readCode(CMS).match(new RegExp(`import ${tag} from "([^"]+)"`));
    if (!importLine) continue;
    const path = `app/${importLine[1].replace(/^(\.\.\/)+/, "")}.tsx`;
    assert.doesNotMatch(
      readCode(path),
      /export default async function/,
      `<${tag}> is an async server component; rendering it from this client editor crashes the page`,
    );
  }
});

test("the partner block is drawn by the component the page uses, not a copy", () => {
  /* A second partner grid living in the admin is exactly how the preview and
     the page drift apart again — which is the defect this fixes. */
  const fn = declarationText(CMS, ["LivePreviewBlock"]).get("LivePreviewBlock") ?? "";
  assert.match(fn, /<BlockPartners\b/, "the preview no longer delegates the partner block");
  assert.match(
    readCode(CMS),
    /import BlockPartners from "[^"]*property\/blocks\/BlockPartners"/,
    "the partner grid is imported from somewhere other than the front end's own",
  );
  assert.doesNotMatch(fn, /property-partners/, "the preview has grown its own copy of the partner markup");
});

test("a partner block added from the palette is the shape the renderer reads", () => {
  /* Config-shaped, not field-shaped like the rest of the CMS union — a block
     added here has to be readable by BlockPartners on the page as well as in
     the preview, or 合作品牌 saves and then renders nothing. */
  const built = compileDeclarations(CMS, ["blockId", "emptyBlock"])({});
  const emptyBlock = built.emptyBlock as (t: string) => Record<string, unknown>;
  const partners = emptyBlock("partners");
  assert.equal(partners.type, "partners");
  assert.deepEqual(partners.config, { layout: "cards", items: [] });
  assert.ok(partners.id, "the block has no id, so the list keys on its index");
  // And an unknown type still cannot crash the editor.
  assert.equal(emptyBlock("something_new").type, "paragraph");
});

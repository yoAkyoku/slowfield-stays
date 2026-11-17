import assert from "node:assert/strict";
import { staysVariantsFor } from "../app/modules/blockStyle.ts";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readStyles } from "./readCode";
import ts from "typescript";

import * as tr from "../app/modules/tr.ts";
import * as i18n from "../app/modules/i18n.ts";
import * as contentTypes from "../app/modules/contentTypes.ts";
import * as fontPresets from "../app/modules/fontPresets.ts";
import * as blockVAlign from "../app/admin/modules/blockVAlign.ts";
import * as alternatingRows from "../app/admin/modules/alternatingRows.ts";
import * as siteContentTypes from "../app/admin/modules/siteContentTypes.ts";
import * as aboutImages from "../app/modules/home/blocks/aboutImages.ts";
import * as contentFilter from "../app/modules/contentFilter.ts";
import { sharedModule } from "./sharedModules.mts";

/**
 * Run with: npm test  (node --test, no test framework dependency)
 *
 * Three 後台設定 that the form offered and the page ignored:
 *
 *   1. 相片拼貼牆 · 每張圖的「圖片說明」 — the editor writes a per-image caption and
 *      BlockGallery mapped every entry down to its URL, so nothing downstream
 *      could ever show one.
 *   2. 相片拼貼牆 · 「並排時圖片填滿欄高」 — the only switch outside the layout-options
 *      guard, so it appeared on the one block whose markup the rule cannot reach.
 *   3. 圖片相簿 · 拼貼版面的「欄數」 — silently dropped by the renderer, because each
 *      collage count is a hand-composed arrangement with no columns to set.
 *
 * These are render assertions, not source-text ones. A test that greps the file
 * for a class name passes as soon as the string appears *somewhere*, which is
 * how this codebase has been fooled before; here the component is actually
 * called and the returned tree is walked, so "the caption is in the markup" is
 * the thing being checked rather than "the word caption is in the file".
 *
 * Components are compiled with the TypeScript that ships with the repo and run
 * against a five-line element factory instead of React: nothing here needs a
 * DOM, and stubbing the imports keeps a form test from dragging in the editor's
 * whole client-side world.
 */

/* ── A tiny JSX runtime: elements as plain data ── */

type El = { type: unknown; props: Record<string, unknown> };

const isEl = (v: unknown): v is El =>
  typeof v === "object" && v !== null && "type" in v && "props" in v;

function h(type: unknown, props: Record<string, unknown> | null, ...children: unknown[]): El {
  return { type, props: { ...(props ?? {}), children: children.length === 1 ? children[0] : children } };
}
const FRAGMENT = Symbol("fragment");

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
    if (id === "next/link") return { default: (p: Record<string, unknown>) => h("a", p, p.children) };
    if (!(id in imports)) {
      const shared = sharedModule(file, id);
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

/* ── Walking the returned tree ── */

/** Call every function component in the tree, so what comes back is markup. */
function expand(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(expand);
  if (!isEl(node)) return node;
  if (typeof node.type === "function") {
    return expand((node.type as (p: Record<string, unknown>) => unknown)(node.props));
  }
  return { type: node.type, props: { ...node.props, children: expand(node.props.children) } };
}

function walk(node: unknown, visit: (el: El) => void): void {
  if (Array.isArray(node)) return node.forEach((n) => walk(n, visit));
  if (!isEl(node)) return;
  visit(node);
  walk(node.props.children, visit);
}

function findAll(node: unknown, type: unknown): El[] {
  const out: El[] = [];
  walk(node, (el) => { if (el.type === type) out.push(el); });
  return out;
}

/** Every string rendered anywhere in the tree, in order. */
function texts(node: unknown): string[] {
  const out: string[] = [];
  const collect = (n: unknown): void => {
    if (Array.isArray(n)) return n.forEach(collect);
    if (typeof n === "string") { if (n.trim()) out.push(n); return; }
    if (isEl(n)) return collect(n.props.children);
  };
  collect(node);
  return out;
}

/* ── The front-end chain: config → BlockGallery → HomePhotoGallery → markup ── */

const HomePhotoGallery = compile("app/modules/home/HomePhotoGallery.tsx", {
  react: {
    useState: (initial: unknown) => [initial, () => undefined],
    useEffect: () => undefined,
  },
  // A timer is not markup; the autoplay hook has its own tests.
  "../useAutoAdvance": { default: () => ({ current: null }) },
});
const BlockGallery = compile("app/modules/home/blocks/BlockGallery.tsx", {
  "../../i18n": i18n,
  "../../tr": tr,
  "../HomePhotoGallery": HomePhotoGallery,
});

type GalleryConfig = Record<string, unknown>;

/** The markup a 相片拼貼牆 block produces for a reader in `locale`. */
function renderGallery(config: GalleryConfig, locale: "zh" | "en") {
  const Block = BlockGallery.default as (p: Record<string, unknown>) => unknown;
  return expand(Block({ locale, config }));
}

const CAPTIONED = {
  images: [
    { url: "/one.jpg", caption: { zh: "中庭泳池", en: "Courtyard pool" } },
    { url: "/two.jpg", caption: { zh: "主臥", en: "Master suite" } },
  ],
};

test("每張圖的圖片說明 reaches the page as a figcaption", () => {
  // The whole of the reported bug: the editor's per-image 圖片說明 was mapped
  // away in BlockGallery, so no arrangement of props downstream could show it.
  const captions = findAll(renderGallery(CAPTIONED, "zh"), "figcaption").map((el) => el.props.children);
  assert.deepEqual(captions, ["中庭泳池", "主臥"]);
});

test("the caption is bilingual, like every other visitor-facing string", () => {
  const en = findAll(renderGallery(CAPTIONED, "en"), "figcaption").map((el) => el.props.children);
  assert.deepEqual(en, ["Courtyard pool", "Master suite"]);
});

test("a caption written in one language only still shows in the other", () => {
  // Same rule the block's own 標題 follows (cfgT): a half-translated block reads
  // in the language it has rather than rendering an empty line.
  const config = { images: [{ url: "/one.jpg", caption: { zh: "只有中文" } }] };
  assert.deepEqual(texts(findAll(renderGallery(config, "en"), "figcaption")), ["只有中文"]);
});

test("a legacy plain-string caption is shown as written", () => {
  const config = { images: [{ url: "/one.jpg", caption: "水岸" }] };
  assert.deepEqual(texts(findAll(renderGallery(config, "zh"), "figcaption")), ["水岸"]);
  assert.deepEqual(texts(findAll(renderGallery(config, "en"), "figcaption")), ["水岸"]);
});

test("an uncaptioned photo renders no caption element at all", () => {
  // Not an empty <figcaption>: an empty caption node still takes layout, which
  // is how a gallery of untitled photos would grow a row of blank strips.
  const config = { images: [{ url: "/one.jpg" }, { url: "/two.jpg", caption: { zh: "", en: "" } }] };
  const tree = renderGallery(config, "zh");
  assert.equal(findAll(tree, "img").length, 2);
  assert.equal(findAll(tree, "figcaption").length, 0);
});

test("the caption describes the photo to a screen reader too", () => {
  // Otherwise the alt text is "標題 3", which tells a blind reader nothing the
  // heading has not already said. Falls back to that when there is no caption.
  const alts = findAll(renderGallery({ ...CAPTIONED, title: "空間" }, "zh"), "img").map((el) => el.props.alt);
  assert.deepEqual(alts, ["中庭泳池", "主臥"]);
  const bare = findAll(renderGallery({ images: ["/one.jpg"], title: "空間" }, "zh"), "img");
  assert.equal(bare[0].props.alt, "空間 1");
});

test("legacy bare-URL entries keep working, with and without neighbours", () => {
  // Blocks saved before the editor normalised its entries are still stored as
  // plain strings; they have no caption and must not be dropped for it.
  const config = { images: ["/legacy.jpg", { url: "/new.jpg", caption: { zh: "新的" } }, { caption: { zh: "沒有圖" } }] };
  const tree = renderGallery(config, "zh");
  assert.deepEqual(findAll(tree, "img").map((el) => el.props.src), ["/legacy.jpg", "/new.jpg"]);
  assert.deepEqual(texts(findAll(tree, "figcaption")), ["新的"]);
});

/* ── The admin form ── */

/* Marker components: the form is rendered, not executed in a browser, so these
   stand in for the editor primitives and let a field be found by the label the
   editor actually sees rather than by a string in the source. */
function Field(_: Record<string, unknown>) { return null; }
function FieldLabel(_: Record<string, unknown>) { return null; }
function HeadingInput(_: Record<string, unknown>) { return null; }
function ImageUploadInput(_: Record<string, unknown>) { return null; }
function FontFacePicker(_: Record<string, unknown>) { return null; }
function FoldSection(_: Record<string, unknown>) { return null; }
function DeletedBadge(_: Record<string, unknown>) { return null; }

const noop = () => {};
const blockForms = compile("app/admin/modules/blockForms.tsx", {
  "./blockVAlign": blockVAlign,
  react: { useState: (v: unknown) => [v, noop], useEffect: noop, useMemo: (f: () => unknown) => f(), useRef: (v: unknown) => ({ current: v }), useId: () => "id" },
  "../(dashboard)/homepage/ImageUploadInput": { default: ImageUploadInput },
  "../../modules/property/blocks/mapMode": { resolveMapMode: () => "embed" },
  /* The picker dialogs' Escape/scroll-lock/focus-trap hook. It only touches the
     document, which this render has none of, so a no-op is the whole stub. */
  "../../modules/useOverlay": { useOverlay: noop },
  "./RichTextEditor": { default: () => null },
  "./blockFields": { Field, FieldLabel, HeadingInput, getVal: () => "", setVal: (c: unknown) => c },
  "../../modules/property/blocks/FeatureIcon": { default: () => null },
  /* The real helper, not a stub returning a fixed list: the layout dropdown is
     gated by it, and a stub here would let the gate and the renderer's fallback
     drift apart without a test noticing — which is the whole failure this
     harness exists to catch. */
  "../../modules/blockStyle": { staysVariantsFor },
  /* The font picker is an editor primitive like Field above — a marker, so a
     field can still be found by the label the editor sees. */
  "./FontFacePicker": { FontFacePicker },
  /* Editor primitives, markers for the same reason Field is: the collapsible
     group wrapper and the 已刪除 tag. `walk` never calls a component, so a
     marker keeps everything nested inside it findable. */
  "./FoldSection": { default: FoldSection },
  "./DeletedBadge": { default: DeletedBadge },
  /* The real module, for the same reason blockStyle and contentTypes are real:
     safeFace is the allow-list the per-role 字體 menu and the page share, and a
     stub would let the editor accept a face the renderer drops. */
  "../../modules/fontPresets": fontPresets,
  /* The real module for the same reason: 資料來源's order and every category's
     name come from it, and the block form re-exports its tables — a stub would
     let the editor's list and the page's diverge again without a test noticing. */
  "../../modules/contentTypes": contentTypes,
  /* The real module, not a stub: altRowRenders is the editor's copy of
     BlockAlternating's own filter, and a stub would let the two drift — which
     is the drift that renumbers the rows. */
  "./alternatingRows": alternatingRows,
  "./siteContentTypes": siteContentTypes,
  "../../modules/home/blocks/aboutImages": aboutImages,
  "../../modules/contentFilter": contentFilter,
  /* The icon set. Icons are markers here for the same reason Field is — every
     one of them renders a bare <svg>, so a component that returns null keeps the
     tree walkable and nothing a test looks for lives inside one. Declared rather
     than allowed through, because the harness's whole point is that a module
     cannot quietly grow a dependency. */
  "lucide-react": new Proxy({}, { get: () => () => null }),
});

function renderGalleryForm(config: GalleryConfig, showLayoutOptions: boolean) {
  const Form = blockForms.GalleryConfigForm as (p: Record<string, unknown>) => unknown;
  return Form({ c: config, zh: true, editLocale: "zh", onChange: noop, showLayoutOptions });
}

/** The 欄位 labels an editor sees, in order. */
const fieldLabels = (tree: unknown) => findAll(tree, Field).map((el) => String(el.props.label));

const FILL_HEIGHT = "並排時圖片填滿欄高（自適應填充）";
const COLUMNS = "欄數";

test("並排時圖片填滿欄高 is offered on 圖片相簿, where the rule can reach the block", () => {
  const tree = renderGalleryForm({ images: [] }, true);
  assert.ok(texts(tree).includes(FILL_HEIGHT), "the switch belongs on the layout-capable form");
  assert.equal(findAll(tree, "input").filter((el) => el.props.type === "checkbox").length, 1);
});

test("並排時圖片填滿欄高 is gone from 相片拼貼牆, where ticking it did nothing", () => {
  // That block renders as .home-gallery-section; the CSS behind the switch is
  // scoped to .property-block-pair .property-image-gallery, so the box could be
  // ticked, saved and re-opened without ever changing the page.
  const tree = renderGalleryForm({ images: [] }, false);
  assert.ok(!texts(tree).includes(FILL_HEIGHT));
  assert.equal(findAll(tree, "input").filter((el) => el.props.type === "checkbox").length, 0);
});

test("排版, 欄數 and 卡片比例 all disappear together on 相片拼貼牆", () => {
  // The guard is what makes this form honest about which settings it can honour;
  // 填滿欄高 was the one that had escaped it. 顯示方式 (大圖輪播 / 小圖牆) is the
  // one setting this block does honour, so it is the only one listed.
  assert.deepEqual(fieldLabels(renderGalleryForm({ images: [] }, false)), ["顯示方式", "眉批（選填）", "標題（選填）"]);
});

test("欄數 is offered on every layout that reads it", () => {
  for (const layout of [undefined, "grid", "carousel", "collage", "centered"]) {
    const labels = fieldLabels(renderGalleryForm({ layout }, true));
    assert.ok(labels.includes(COLUMNS), `欄數 must stay on layout ${String(layout)}`);
  }
});

test("欄數 is withdrawn on 拼貼, which has no columns to set", () => {
  // Each count is a composed arrangement — the tiles are placed by
  // grid-column/grid-row inside a container that sets its own column track — so
  // the renderer drops the number rather than scattering the composition. A
  // setting that cannot be honoured should not be offered.
  for (const layout of ["scatter", "overlap"]) {
    const labels = fieldLabels(renderGalleryForm({ layout }, true));
    assert.ok(!labels.includes(COLUMNS), `欄數 must not be offered on layout ${layout}`);
    assert.ok(labels.includes("排版"), "the layout picker itself must stay, or it cannot be changed back");
    /* 卡片比例 goes with 欄數 now. The collage places its tiles absolutely with
       explicit width/height and its own rules outrank .has-card-ratio, so the
       ratio moved nothing there either — it was offered and inert, the same
       defect this test was written for one field over. */
    assert.ok(!labels.includes("卡片比例"), `卡片比例 must not be offered on layout ${layout}`);
  }
});

/* ── Why 欄數 is withdrawn rather than implemented ── */

const LightboxGallery = compile("app/modules/property/LightboxGallery.tsx", {
  react: { useState: (v: unknown) => [v, noop], useEffect: noop, useCallback: (f: unknown) => f, useRef: (v: unknown) => ({ current: v }) },
  "react-dom": { createPortal: (n: unknown) => n },
  "../content/ScrollRail": { default: (p: Record<string, unknown>) => h("div", { className: p.className, style: p.style }, p.children) },
  "../useOverlay": { useOverlay: noop },
});
const BlockImageGallery = compile("app/modules/property/blocks/BlockImageGallery.tsx", {
  "../../i18n": i18n,
  "../../tr": tr,
  "../LightboxGallery": LightboxGallery,
});

/** The element that carries the gallery's own grid, whatever layout it is in. */
function galleryWrapper(config: GalleryConfig) {
  const Block = BlockImageGallery.default as (p: Record<string, unknown>) => unknown;
  const tree = expand(Block({ locale: "zh", config }));
  const divs = findAll(tree, "div").filter((el) => String(el.props.className ?? "").match(/gallery-grid|property-scatter/));
  assert.equal(divs.length, 1, "expected exactly one gallery grid element");
  return divs[0];
}

const THREE = [{ url: "/a.jpg" }, { url: "/b.jpg" }, { url: "/c.jpg" }];

test("欄數 does reach every other layout — this is not a dead setting everywhere", () => {
  // Which is why the fix is to withdraw the field on 拼貼 alone rather than to
  // drop it from the form: on these four the number in the editor is the number
  // of columns on the page.
  for (const layout of ["grid", "collage", "centered"]) {
    const style = galleryWrapper({ images: THREE, layout, columns: 3 }).props.style as Record<string, unknown>;
    assert.equal(style.gridTemplateColumns, "repeat(3, 1fr)", `layout ${layout}`);
  }
  // 輪播 is a rail, not a grid: the count sets how many cards fit across.
  const rail = galleryWrapper({ images: THREE, layout: "carousel", columns: 3 });
  assert.deepEqual(rail.props.style, { "--rail-cols": 3 });
});

test("拼貼 replaces the grid entirely, so a column count has nowhere to land", () => {
  const wrapper = galleryWrapper({ images: THREE, layout: "scatter", columns: 3 });
  assert.match(String(wrapper.props.className), /property-scatter--n3/);
  assert.equal(wrapper.props.style, undefined, "an inline column track here would overwrite the composition");
});

/**
 * 「並排時圖片填滿欄高」 must be able to change something.
 *
 * Two rules had opposite intent. The older one — "paired, the photo fills the
 * row" — set `height: 100%` on both the gallery and its grid unconditionally.
 * The newer one, written to a later instruction (客戶: 正常並排是內容置中，但有
 * 開關可以選擇自適應填充), centres by default and fills only under
 * `.is-fill-height`. The older rule won on source order, so the switch did
 * nothing whether ticked or not, and the feature that had been built to spec
 * was invisible.
 *
 * Measured after the fix: unticked 306px (its own height, centred), ticked
 * 469px (the column). The invariant is that the GRID's height is not forced
 * outside `.is-fill-height` — the outer box may still take the row, because the
 * centring needs somewhere to centre within.
 */
test("the paired gallery grid is not forced to full height unconditionally", () => {
  /* Comments are stripped first. Without that, the text before a `{` includes
     the rule's own comment, and this rule's comment names `.is-fill-height`
     while explaining the fix — so the skip below treated the offending rule as
     the switch's own and the test passed against the exact code it exists to
     reject. Verified by re-applying the mutation: red now, green before. */
  const css = readStyles("app/globals.css").replace(/\/\*[\s\S]*?\*\//g, "");
  const offenders: string[] = [];
  const re = /([^{}]*\.property-block-pair[^{}]*)\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    /* Each selector on its own. Testing the whole comma-separated list meant one
       exempt entry excused every other selector sharing the rule — the offending
       one just had to be written second, and the whole rule was skipped.
       `\b` is no good for a class name either: it matches at a hyphen, so
       `-grid-item` would be read as `-grid`. */
    const parts = m[1].split(",").map((x) => x.replace(/\s+/g, " ").trim());
    const targeted = parts.filter((one) => /\.property-image-gallery-grid(?![\w-])/.test(one));
    if (!targeted.length) continue;
    // Only the switch's own rule is exempt, and only for the selectors that
    // carry the class.
    const guilty = targeted.filter((one) => !/\.is-fill-height(?![\w-])/.test(one));
    if (!guilty.length) continue;
    if (/height:\s*100%/.test(m[2])) offenders.push(...guilty);
  }
  assert.deepEqual(
    offenders,
    [],
    `these rules fill the paired gallery whatever the switch says: ${offenders.join(" | ")}`,
  );
});

test("the switch still has a rule that fills the grid when it is on", () => {
  const css = readStyles("app/globals.css");
  assert.match(
    css,
    /\.property-block-pair \.property-image-gallery\.is-fill-height \.property-image-gallery-grid \{[^}]*height: 100%/,
    "nothing fills the grid any more, so ticking the switch does nothing either",
  );
});

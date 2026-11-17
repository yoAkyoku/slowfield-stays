import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

import { readCode } from "./readCode";
import { declarationText } from "./sourceEval";
import * as contentTypes from "../app/modules/contentTypes.ts";
import * as fontPresets from "../app/modules/fontPresets.ts";
import { staysVariantsFor } from "../app/modules/blockStyle.ts";
import * as blockVAlign from "../app/admin/modules/blockVAlign.ts";
import * as alternatingRows from "../app/admin/modules/alternatingRows.ts";
import * as aboutImages from "../app/modules/home/blocks/aboutImages.ts";
import * as contentFilter from "../app/modules/contentFilter.ts";
import * as siteContentTypes from "../app/admin/modules/siteContentTypes.ts";
import { sharedModule } from "./sharedModules.mts";

/**
 * 內容集合's settings panel — the audit of it, held in place.
 *
 * The panel was eleven controls in one flat list, in an order that contradicted
 * what depended on what, with two labels that read the same and two more that
 * both said 「標籤」 while acting on opposite ends of the block. Two of the
 * findings could take a live page down on their own:
 *
 *   • 分類過濾 was free text matched exactly against the entries' own tags. A
 *     typo matched nothing, so every source returned empty, so BlockStays
 *     returned null and the block vanished from the page — with no empty state,
 *     no error and nothing in the panel to say why.
 *   • The 資料來源 picker had no `deleted` filter, unlike 頁面管理, 內容管理's
 *     category dropdown and the site nav. 禾境 deleted its 媒體報導 page
 *     and its homepage block still names `media` as a source.
 *
 * Both fixes have a second half that is easy to lose: an existing block must
 * keep working. A hand-typed filter tag that matches nothing must stay selected
 * rather than be silently dropped the first time someone opens the panel, and a
 * deleted category a block is already drawing must stay visible — marked — so it
 * can be removed deliberately instead of disappearing along with the only
 * control that could undo it.
 */

/* ── A tiny JSX runtime: elements as plain data ────────────────────────── */

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

/** Call every function component in the tree, so what comes back is markup.
 *  The markers below all pass their children through, so nothing nested inside
 *  a Field or a fold is lost on the way. */
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

/* ── The module under test ────────────────────────────────────────────── */

/* Markers for the editor primitives, so a field can be found by the label the
   editor actually sees rather than by a string in the source. Each one renders
   its children, so the same tree can be walked twice: unexpanded to find the
   markers themselves, expanded to read the copy inside the pickers. */
function Field(p: Record<string, unknown>) { return h("div", { className: "field" }, p.children); }
function FieldLabel(p: Record<string, unknown>) { return h("span", null, p.children); }
function HeadingInput(_: Record<string, unknown>) { return null; }
function FoldSection(p: Record<string, unknown>) { return h("div", { className: "fold" }, p.children); }
function DeletedBadge(p: Record<string, unknown>) {
  return h("span", { className: "admin-deleted-badge" }, p.label);
}

/** Elements carrying a class name, in the expanded tree. */
function findClass(node: unknown, cls: string): El[] {
  const out: El[] = [];
  walk(node, (el) => { if (String(el.props.className ?? "").split(" ").includes(cls)) out.push(el); });
  return out;
}

const noop = () => {};

/**
 * @param openDialogs render with every disclosure open.
 *
 * The pickers are `useState(false)` + a modal that renders its children only
 * when open, so the option lists are simply absent from a default render. This
 * stub turns a `false` initial state into `true` — the two booleans in the file
 * are exactly those two `open` flags — which is what puts the dialog bodies in
 * the tree. The lazy `useState(() => …)` form is honoured properly either way;
 * without that, the sources-tags hook would hand back its own initialiser.
 */
function blockFormsWith(openDialogs: boolean): Record<string, unknown> {
  return compile("app/admin/modules/blockForms.tsx", {
    "./blockVAlign": blockVAlign,
    react: {
      useState: (v: unknown) => [
        typeof v === "function" ? (v as () => unknown)() : (openDialogs && v === false ? true : v),
        noop,
      ],
      useEffect: noop,
      useMemo: (f: () => unknown) => f(),
      useRef: (v: unknown) => ({ current: v }),
      useId: () => "id",
    },
    "../(dashboard)/homepage/ImageUploadInput": { default: () => null },
    "../../modules/property/blocks/mapMode": { resolveMapMode: () => "embed" },
    "../../modules/useOverlay": { useOverlay: noop },
    "../../modules/home/blocks/aboutImages": aboutImages,
    "./RichTextEditor": { default: () => null },
    "./blockFields": { Field, FieldLabel, HeadingInput, getVal: () => "", setVal: (c: unknown) => c },
    // The kit's confirm dialog: a form only asks it; the answer is the test's.
  "../ui": { useConfirm: () => ({ ask: async () => true, tell: async () => undefined }) },
    "../../modules/property/blocks/FeatureIcon": { default: () => null },
    "./FontFacePicker": { FontFacePicker: () => null },
    "./FoldSection": { default: FoldSection },
    "./DeletedBadge": { default: DeletedBadge },
    /* The real module, not a stub: altRowRenders is the editor's copy of
       BlockAlternating's own filter, and a stub would let the two drift — which
       is the drift that renumbers the rows. */
    "./alternatingRows": alternatingRows,
    /* The icon set. Icons are markers here for the same reason Field is — every
       one of them renders a bare <svg>, so a component that returns null keeps the
       tree walkable and nothing a test looks for lives inside one. Declared rather
       than allowed through, because the harness's whole point is that a module
       cannot quietly grow a dependency. */
    "lucide-react": new Proxy({}, { get: () => () => null }),
    /* Real, not stubbed: the layout list, the font allow-list and the category
       tables are all shared with the renderer, and a stub would let the editor
       and the page drift apart without a test noticing. */
    "../../modules/blockStyle": { staysVariantsFor },
    "../../modules/fontPresets": fontPresets,
    "../../modules/contentTypes": contentTypes,
    "../../modules/contentFilter": contentFilter,
    "./siteContentTypes": siteContentTypes,
  });
}

const blockForms = blockFormsWith(false);
const openForms = blockFormsWith(true);

type Cfg = Record<string, unknown>;
type Source = [string, string, string, boolean?];

const CATEGORY_SOURCES: Source[] = [
  ["stays", "住宿目錄", "Stay catalogue"],
  ["news", "最新消息", "News"],
  ["dining", "餐飲服務", "Dining"],
];

/**
 * The panel an editor sees for one block config.
 *
 * `raw` still holds the marker components (so a Field can be found by the label
 * the editor sees); `tree` is the same panel with every component called, which
 * is the only form the pickers' dialog bodies exist in.
 */
function renderPanel(config: Cfg, sources: Source[] = CATEGORY_SOURCES, opened = false) {
  const mod = opened ? openForms : blockForms;
  const Form = mod.StaysConfigForm as (p: Record<string, unknown>) => unknown;
  const raw = Form({
    c: config,
    zh: true,
    editLocale: "zh",
    onChange: noop,
    contentSources: sources,
    siteSlug: "slowfield",
  });
  return { raw, tree: expand(raw) };
}

/** The same panel for an admin working in English. */
function renderPanelEn(config: Cfg, sources: Source[] = CATEGORY_SOURCES) {
  const Form = blockForms.StaysConfigForm as (p: Record<string, unknown>) => unknown;
  const raw = Form({
    c: config,
    zh: false,
    editLocale: "en",
    onChange: noop,
    contentSources: sources,
    siteSlug: "slowfield",
  });
  return { raw, tree: expand(raw) };
}

/** The group headings, in order. */
const groups = (raw: unknown) =>
  findAll(raw, FoldSection).map((el) => String(el.props.title));

/** The 欄位 labels an editor sees, in order. */
const fieldLabels = (raw: unknown) =>
  findAll(raw, Field).map((el) => String(el.props.label));

/** What the 內容過濾標籤 dialog offers, one string per option row. */
const filterOptions = (tree: unknown) =>
  findClass(tree, "amenity-checkbox")
    .filter((el) => findAll(el, "input").some((i) => i.props.name === "bf-filter-tag"))
    .map((el) => texts(el).join(""));

/** What the 資料來源 dialog offers, one string per tick-box. */
const sourceOptions = (tree: unknown) =>
  findClass(tree, "amenity-checkbox")
    .filter((el) => findAll(el, "input").some((i) => i.props.type === "checkbox"))
    .map((el) => texts(el).join(""));

/** Prime the module-level fetch cache both compiled copies share. */
function seedTags(mod: Record<string, unknown>, source: string, tagLists: string[][]) {
  const cache = mod._sourceCache as Map<string, Array<{ id: number; image: string; title: string; tags: string[] }>>;
  cache.set(`slowfield|${source}|zh`, tagLists.map((tags, i) => ({
    id: i + 1, image: "", title: `entry ${i + 1}`, tags,
  })));
}

function clearTagCache(mod: Record<string, unknown>) {
  (mod._sourceCache as Map<string, unknown>).clear();
}

/* ── 4. 內容過濾標籤: the typo that emptied the block ──────────────────── */

test("the entry filter is a multi-select picker, not a box you can mistype into", () => {
  clearTagCache(openForms);
  seedTags(openForms, "news", [["住宿優惠"], ["春季"]]);
  const { tree } = renderPanel({ source: "news", filter_tag: "" }, CATEGORY_SOURCES, true);

  const shown = texts(tree);
  assert.ok(shown.includes("住宿優惠"), "the tags that exist are not offered");
  assert.ok(shown.includes("春季"), "only some of the source's tags are offered");
  // Checkboxes, not radios: multiple tags can be selected and nothing can be
  // typed that no entry carries.
  const inputs = findAll(tree, "input").filter((el) => el.props.name === "bf-filter-tag");
  assert.ok(inputs.length >= 3, `expected 不過濾 + one option per tag, found ${inputs.length}`);
  for (const el of inputs) assert.equal(el.props.type, "checkbox", "the filter is not multi-select");
  assert.ok(texts(tree).some((s) => s.includes("可複選")), "the picker does not explain multi-select OR behaviour");
});

test("a filter tag typed by hand before the picker existed keeps working", () => {
  /* The whole risk of replacing the box. 「住宿優慧」 is a real typo of 住宿優惠
     — no entry carries it — and the block it is saved on is live. Dropping it
     from the list would change what that block collects the moment someone
     opened the panel, and would hide the reason it is showing nothing. */
  clearTagCache(openForms);
  seedTags(openForms, "news", [["住宿優惠"]]);
  const { tree } = renderPanel({ source: "news", filter_tag: "住宿優慧" }, CATEGORY_SOURCES, true);

  const shown = texts(tree);
  assert.ok(
    filterOptions(tree).some((t) => t.includes("住宿優慧")),
    "a stored tag that matches nothing was dropped from the picker",
  );
  const chosen = findAll(tree, "input")
    .filter((el) => el.props.name === "bf-filter-tag" && el.props.checked === true);
  assert.equal(chosen.length, 1, "the stored value is no longer the selected option");
  // …and the editor is told what it is doing to the page.
  assert.ok(
    shown.some((s) => s.includes("找不到任何內容") && s.includes("整個消失")),
    "nothing warns that this filter empties the block",
  );
  assert.ok(findClass(tree, "admin-deleted-badge").length >= 1, "the orphaned value carries no marker");
});

test("a stored tag that does match is not accused of matching nothing", () => {
  clearTagCache(openForms);
  seedTags(openForms, "news", [["住宿優惠"]]);
  const { tree } = renderPanel({ source: "news", filter_tag: "住宿優惠" }, CATEGORY_SOURCES, true);
  const shown = texts(tree);
  assert.ok(!shown.some((s) => s.includes("找不到任何內容")), "a working filter is reported as broken");
  assert.equal(findClass(tree, "admin-deleted-badge").length, 0, "a working filter is marked as unmatched");
  // Listed once, not twice — the stored value IS one of the available tags,
  // and appending it as an orphan on top would offer the same tag twice.
  assert.equal(filterOptions(tree).filter((t) => t.includes("住宿優惠")).length, 1, "the stored tag is offered twice");
});

test("the picker folds case and spacing the way the page does", () => {
  /* BlockStays matches `String(tag).trim().toLowerCase()`. Comparing any other
     way here would put a 「matches nothing」 warning on a filter the page is
     applying perfectly well — or, worse, hide one that is really broken. */
  assert.match(
    readCode("app/modules/contentFilter.ts"),
    /String\(tag \?\? ""\)\.trim\(\)\.toLowerCase\(\)/,
    "the shared filter matcher no longer trims and folds entry tags like the picker",
  );
  clearTagCache(openForms);
  seedTags(openForms, "news", [["Local"]]);
  const { tree } = renderPanel({ source: "news", filter_tag: " local " }, CATEGORY_SOURCES, true);
  assert.ok(
    !texts(tree).some((s) => s.includes("找不到任何內容")),
    "a filter the page matches is reported here as matching nothing",
  );
});

test("multiple filter tags use OR semantics and an empty new list clears the legacy value", () => {
  assert.deepEqual(
    contentFilter.contentFilterTags({ filter_tags: [" 春季 ", "住宿優惠", "春季"] }),
    ["春季", "住宿優惠"],
  );
  assert.equal(
    contentFilter.hasContentFilterTag(["秋季", "春季"], ["住宿優惠", "春季"]),
    true,
    "an entry matching any selected tag should be included",
  );
  assert.equal(
    contentFilter.hasContentFilterTag(["秋季"], ["住宿優惠", "春季"]),
    false,
    "an entry matching none of the selected tags should be excluded",
  );
  assert.deepEqual(
    contentFilter.contentFilterTags({ filter_tag: "住宿優惠", filter_tags: [] }),
    [],
    "clearing the new multi-select must not resurrect the old single tag",
  );
});

test("the picker still works when no source has a single tag", () => {
  clearTagCache(openForms);
  seedTags(openForms, "news", [[], []]);
  const { tree } = renderPanel({ source: "news", filter_tag: "" }, CATEGORY_SOURCES, true);
  const shown = texts(tree);
  /* 不過濾 is always an OPTION, not merely the words on the closed trigger:
     with the option gone the dialog is a dead end that cannot be answered. */
  assert.ok(
    filterOptions(tree).some((t) => t.includes("不過濾")),
    "the no-filter option is gone on an empty tag list",
  );
  assert.ok(
    shown.some((s) => s.includes("都沒有標籤")),
    "an empty list says nothing about why it is empty",
  );

  // …and a value stored against that empty list is still there to be removed.
  const stored = renderPanel({ source: "news", filter_tag: "住宿優惠" }, CATEGORY_SOURCES, true);
  assert.ok(
    filterOptions(stored.tree).some((t) => t.includes("住宿優惠")),
    "an empty tag list swallows the stored value",
  );
  assert.ok(
    filterOptions(stored.tree).some((t) => t.includes("不過濾")),
    "there is no way back to no filter at all",
  );
});

test("the filter reads every source the block merges, not just the first", () => {
  clearTagCache(openForms);
  seedTags(openForms, "news", [["春季"]]);
  seedTags(openForms, "dining", [["外燴"]]);
  const { tree } = renderPanel(
    { source: "news", extra_sources: ["dining"], filter_tag: "" },
    CATEGORY_SOURCES,
    true,
  );
  const shown = texts(tree);
  // The filter is applied to every source, so offering only the primary's tags
  // would hide the only values that can narrow the other ones.
  assert.ok(shown.includes("春季") && shown.includes("外燴"), "the extra sources' tags are not offered");
});

/* ── 8. Deleted categories in the 資料來源 picker ──────────────────────── */

const WITH_DELETED: Source[] = [
  ["stays", "住宿目錄", "Stay catalogue"],
  ["news", "最新消息", "News"],
  ["media", "媒體報導", "In the Press", true],
  ["dining", "餐飲服務", "Dining"],
];

test("a deleted category a block is still drawing stays in the picker, marked", () => {
  /* 禾境, exactly: the 媒體報導 page is tombstoned in 頁面管理 and the
     homepage block still lists `media` among its sources. Filtering it out
     would have removed the row AND the only control that can take it off the
     block, leaving nine press entries on the page with nothing in the admin to
     explain them. */
  const { tree } = renderPanel(
    { source: "news", extra_sources: ["media", "dining"] },
    WITH_DELETED,
    true,
  );
  const shown = texts(tree);
  assert.ok(
    sourceOptions(tree).some((t) => t.includes("媒體報導")),
    "a category the block is using vanished from its own picker",
  );
  assert.ok(findClass(tree, "admin-deleted-badge").length >= 1, "nothing marks it as deleted");
  assert.ok(
    shown.some((s) => s.includes("已在頁面管理刪除") && s.includes("取消勾選")),
    "the panel does not say why it is there or how to remove it",
  );
  // The closed trigger says so too, so it is visible without opening anything.
  assert.ok(
    shown.some((s) => s.includes("媒體報導（已刪除）")),
    "the source summary reads as though the category were live",
  );
});

test("a deleted category nothing is using is not offered as a new choice", () => {
  const { tree } = renderPanel({ source: "news", extra_sources: ["dining"] }, WITH_DELETED, true);
  const offered = sourceOptions(tree);
  assert.ok(
    !offered.some((t) => t.includes("媒體報導")),
    "a tombstoned category can still be newly picked — its index 404s and 內容管理 does not offer it",
  );
  assert.ok(
    !texts(tree).some((s) => s.includes("已在頁面管理刪除")),
    "the tombstone note shows with no tombstone",
  );
  // …and the live categories are all still there.
  for (const name of ["最新消息", "餐飲服務", "住宿目錄"]) {
    assert.ok(offered.some((t) => t.includes(name)), `${name} was filtered out along with the tombstone`);
  }
});

test("buildContentSources flags a tombstoned page rather than dropping it", () => {
  /* The flag has to be carried this far because the list is built once per
     editor and shared by every block on the page — only the picker knows which
     categories a given block still holds. */
  const build = blockForms.buildContentSources as (site: unknown) => Source[];
  const site = {
    parent_site_id: 1,
    settings: {
      pages: {
        news: { page_type: "cms_list", label: { zh: "最新消息", en: "News" }, sort_order: 0 },
        media: { label: { zh: "媒體報導", en: "In the Press" }, sort_order: 6, deleted: true },
      },
    },
  };
  const rows = build(site);
  const media = rows.find(([key]) => key === "media");
  assert.ok(media, "the tombstoned category is gone from the list entirely");
  assert.equal(media![3], true, "the tombstone is not flagged, so the picker cannot tell it apart");
  assert.deepEqual(media!.slice(1, 3), ["媒體報導", "In the Press"], "the client's own name was lost");
  const news = rows.find(([key]) => key === "news");
  assert.equal(news![3], undefined, "a live category is flagged as deleted");
});

/* ── 1 & 2. Grouping, and the order the dependencies run in ───────────── */

test("the panel is grouped rather than one flat run of controls", () => {
  const { raw } = renderPanel({ source: "news" });
  assert.deepEqual(groups(raw), ["來源與數量", "版面", "文字內容"]);
  // Inclusion stays open; the result summary keeps folded settings discoverable.
  for (const el of findAll(raw, FoldSection)) {
    assert.equal(el.props.defaultOpen === true, el.props.title === "來源與數量");
  }
  assert.ok(findClass(expand(raw), "hpb-collection-summary").length === 1);
  /* 文字內容, not 文字: 「文字外觀」 is the inspector fold immediately under this
     form and carries the font size and line height. */
  assert.ok(
    !groups(raw).includes("文字"),
    "a group called 文字 collides with the 文字外觀 fold below the form",
  );
});

test("the English panel is grouped and named the same way", () => {
  /* Every string added here has an English half, and the two halves have gone
     out of step in this file before. */
  const { raw } = renderPanelEn({ source: "news", variant: "grid" });
  assert.deepEqual(groups(raw), ["Source & count", "Layout", "Text content"], "the English groups drifted");
  const labels = fieldLabels(raw);
  for (const label of ["How entries are chosen", "Count per source", "Layout variant", "Side-scroll"]) {
    assert.ok(labels.includes(label), `${label} is missing from the English panel`);
  }
  assert.equal(new Set(labels).size, labels.length, `two English fields share a label: ${labels.join(" / ")}`);
});

test("挑選方式 comes before the two controls it decides the fate of", () => {
  const { raw, tree } = renderPanel({ source: "news" });
  const labels = fieldLabels(raw);
  const pick = labels.indexOf("挑選方式");
  assert.ok(pick >= 0, "挑選方式 is gone");
  const count = labels.findIndex((l) => l.includes("數量"));
  assert.ok(count > pick, "the count still sits above the control that decides whether it applies");
  /* The filter is a picker, not a Field, so it is found by its own label — it
     also has to come after 挑選方式, for the same reason. */
  const rendered = texts(tree);
  const pickAt = rendered.findIndex((s) => s.includes("自動：依排序取前 N 篇"));
  const filterAt = rendered.findIndex((s) => s.includes("只收錄哪些主題"));
  assert.ok(pickAt >= 0 && filterAt > pickAt, "內容過濾標籤 sits above 挑選方式");
});

/* ── 3. Two labels that read the same ─────────────────────────────────── */

test("橫向捲動 is named once, and the stored key is untouched", () => {
  const { raw } = renderPanel({ source: "news", variant: "grid" });
  const labels = fieldLabels(raw);
  assert.ok(labels.includes("排版樣式"), "the layout picker is gone");
  assert.ok(labels.includes("橫向捲動"), "the rail switch is not named after what it does");
  assert.ok(!labels.includes("排列方式"), "排列方式 and 排版樣式 read the same and both came back");
  /* A label change only. Renaming the key would silently reset every block that
     has the rail switched on. */
  const form = readCode("app/admin/modules/blockForms.tsx");
  assert.match(form, /checked=\{c\.rail === true\}/, "the rail switch no longer reads c.rail");
  assert.match(form, /onChange\(\{ \.\.\.c, rail: e\.target\.checked \}\)/, "the rail switch no longer writes c.rail");
  assert.match(readCode("app/modules/home/blocks/BlockStays.tsx"), /c\.rail === true/, "the page reads a different key now");
});

/* ── 5. Which tag control acts on which end ───────────────────────────── */

test("each tag control says whether it narrows the entries or only the chips", () => {
  clearTagCache(openForms);
  seedTags(openForms, "news", [["春季"]]);
  const { tree } = renderPanel(
    { source: "news", variant: "grid", show_tags: true, filter_tag: "" },
    CATEGORY_SOURCES,
    true,
  );
  const shown = texts(tree).join("\n");
  assert.ok(
    /決定「哪些文章會出現」/.test(shown),
    "內容過濾標籤 does not say that it decides which entries appear",
  );
  assert.ok(
    /卡片顯示標籤由每篇文章決定/.test(shown),
    "要顯示的標籤 does not say that it changes nothing about which entries appear",
  );
});

/* ── 7. 每個來源 on a source that can never have more than one ─────────── */

test("住宿目錄 is not told its count is per source", () => {
  /* SourcesPicker clears the categories when 住宿 is ticked and vice versa, so
     「每個來源」 there described a multiplication the editor cannot perform. */
  const stays = renderPanel({ source: "stays" });
  const staysLabels = fieldLabels(stays.raw);
  assert.ok(staysLabels.includes("顯示數量"), "the count field is gone from the catalogue source");
  assert.ok(!staysLabels.includes("每個來源顯示數量"), "住宿目錄 is still offered a per-source count");
  assert.ok(
    texts(stays.tree).some((s) => s.includes("只會有一個來源")),
    "nothing explains why the count is not per source here",
  );

  // …and a CMS source, which really can hold several, still is.
  const news = fieldLabels(renderPanel({ source: "news" }).raw);
  assert.ok(news.includes("每個來源顯示數量"), "the per-source count was removed from the sources that have several");
  assert.ok(!news.includes("顯示數量"), "the CMS sources lost the wording that says the count multiplies");
});

test("the panel never points at a control it is not showing", () => {
  /* 內容過濾標籤 is withheld on 住宿目錄 — the catalogue branch never reads
     filter_tag — so the tag switches must not send the editor upstairs to look
     for it, and 「查看更多」 lands on /stays, which is a listing rather than one
     of the CMS category pages. */
  const stays = texts(renderPanel({ source: "stays", variant: "grid", show_tags: true }).tree).join("\n");
  assert.ok(!/內容過濾標籤/.test(stays), "住宿目錄 is sent to a control its panel does not offer");
  assert.ok(!/分類頁/.test(stays), "the stay listing is described as a category page");
  assert.ok(/住宿列表頁/.test(stays), "nothing says where 查看更多 goes on the catalogue source");

  /* The cross-reference is still there where the control it names exists —
     matched on the pointer itself, not on the words 內容過濾標籤, which are also
     that control's own label and would pass with the pointer gone. */
  const news = texts(renderPanel({ source: "news", variant: "grid", show_tags: true }).tree).join("\n");
  assert.ok(
    /來源與數量 → 只收錄哪些主題/.test(news),
    "the CMS sources lost the pointer to the control that does narrow entries",
  );
});

/* ── 6. Where 「查看更多」 lands ──────────────────────────────────────── */

/** BlockStays' own `viewAllLabel`, compiled and run. */
function viewAllLabel(cfg: {
  source: string; extras: string[]; locale: "zh" | "en"; stored?: string; label?: string;
}): string {
  const PATH = "app/modules/home/blocks/BlockStays.tsx";
  const decl = declarationText(PATH, ["viewAllLabel"]).get("viewAllLabel");
  assert.ok(decl, `${PATH}: viewAllLabel is gone — renamed, or commented out`);
  const src = [
    "function __b(__ctx){",
    "const { c, locale, isStays, byCategory, zh, source, h, cfgT, categoryLabel } = __ctx;",
    decl!,
    "return viewAllLabel;",
    "}",
  ].join("\n");
  const js = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return new Function(`${js}\nreturn __b;`)()({
    c: { view_all_label: cfg.stored ?? "" },
    locale: cfg.locale,
    isStays: cfg.source === "stays",
    byCategory: cfg.extras.length > 0,
    zh: cfg.locale === "zh",
    source: cfg.source,
    h: { viewAll: "瀏覽全部住宿" },
    cfgT: (c: Record<string, unknown>, key: string) => String(c[key] ?? ""),
    categoryLabel: () => cfg.label ?? "最新消息",
  }) as string;
}

test("a merged row's automatic 查看更多 names the page it lands on", () => {
  /* The destination has only ever been the primary source's own index, and no
     editor control exists that could widen it: the villa list route folds in
     extra_content_types, the group's category route does not, and neither is
     exposed in 頁面管理. Hiding the link would have taken a working CTA off the
     villa, whose 最新消息 page does fold the extras in. So the link stays and
     the label stops over-promising. */
  assert.equal(viewAllLabel({ source: "news", extras: ["dining", "curation"], locale: "zh" }), "查看更多最新消息");
  assert.equal(
    viewAllLabel({ source: "news", extras: ["media"], locale: "en", label: "News" }),
    "More News",
  );
});

test("a single-source row's label is exactly what it was", () => {
  assert.equal(viewAllLabel({ source: "news", extras: [], locale: "zh" }), "查看更多");
  assert.equal(viewAllLabel({ source: "journal", extras: [], locale: "zh" }), "閱讀更多專欄");
  assert.equal(viewAllLabel({ source: "stays", extras: [], locale: "zh" }), "瀏覽全部住宿");
});

test("an admin-written label still wins over the automatic one", () => {
  assert.equal(
    viewAllLabel({ source: "news", extras: ["dining"], locale: "zh", stored: "全部消息" }),
    "全部消息",
  );
});

test("the label is built after the catalogue that names the destination", () => {
  /* It used to sit above the fetch, which is why it could not name a category
     at all. If it moves back up, `categoryLabel` is not defined yet and the
     block throws on every merged row — a crash, not a silent regression, but
     one worth catching here rather than on the homepage. */
  const src = readCode("app/modules/home/blocks/BlockStays.tsx");
  assert.ok(
    src.indexOf("const categoryLabel =") < src.indexOf("const viewAllLabel ="),
    "viewAllLabel is built before categoryLabel exists",
  );
  /* Same dependency, one consumer along. `railProps` used to read viewAllLabel;
     it is gone — the rail is now the ScrollRail component, which supplies the
     focusable region itself — and the ariaLabel that replaced it reads the same
     variable, so the ordering still has to hold. */
  assert.ok(
    src.indexOf("const viewAllLabel =") < src.indexOf("ariaLabel={String(headline || viewAllLabel)}"),
    "the rail's aria-label reads viewAllLabel before it is built",
  );
});


test("collection presets preserve inclusion rules and manual selections", () => {
  const config: Cfg = { source: "news", extra_sources: ["dining"], filter_tags: ["親子"], picked_ids: [12], pick_mode: "manual", limit: 4, headline: {zh: "自訂名稱"} };
  let changed: Cfg | undefined;
  const Form = blockForms.StaysConfigForm as (p: Record<string, unknown>) => unknown;
  const tree = expand(Form({c: config, zh: true, editLocale: "zh", onChange: (value: Cfg) => { changed = value; }, contentSources: CATEGORY_SOURCES}));
  const preset = findAll(tree, "button").find((button) => texts(button).includes("消息輪播"));
  assert.ok(preset);
  (preset.props.onClick as () => void)();
  assert.equal(changed?.variant, "news");
  assert.equal(changed?.filter_by, "category");
  for (const key of ["source", "extra_sources", "filter_tags", "picked_ids", "pick_mode", "limit", "headline"]) assert.deepEqual(changed?.[key], config[key]);
});

test("collection summary describes active manual rules instead of unused topic rules", () => {
  const {tree} = renderPanel({source: "news", extra_sources: ["dining"], pick_mode: "manual", picked_ids: [1,2], filter_tags: ["親子"], variant: "index"});
  const summary = findClass(tree, "hpb-collection-summary")[0];
  const copy = texts(summary).join(" ");
  assert.match(copy, /最新消息、餐飲服務/);
  assert.match(copy, /手動選擇 2 筆/);
  assert.match(copy, /不顯示篩選按鈕/);
  assert.doesNotMatch(copy, /符合任一主題/);
});

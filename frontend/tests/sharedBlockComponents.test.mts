import assert from "node:assert/strict";
import * as blockStyle from "../app/modules/blockStyle.ts";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

import * as tr from "../app/modules/tr.ts";
import * as safeHtmlMod from "../app/modules/safeHtml.ts";
import * as safeCss from "../app/modules/safeCss.ts";
import * as socialLinks from "../app/modules/socialLinks.ts";
import * as unknownBlock from "../app/modules/unknownBlock.ts";
import * as faqSchema from "../app/modules/faqSchema.ts";
import { readCode, readStyles } from "./readCode.mts";
import { sharedModule } from "./sharedModules.mts";

/**
 * FAQ, 入住須知 and 表格 draw the same thing on a group content page as on a
 * villa page — because there is one component for each, not two.
 *
 * PageBlocks used to carry its own copy of all three. They were not stubs: they
 * were near-complete second implementations, close enough to look right in a
 * diff and far enough apart to be visible to an editor. Every difference below
 * was measured on the copies before they were removed, and every one of them
 * had the same shape — the field is offered by one editor, it saves, the
 * admin's own preview draws it through the PROPERTY component and looks
 * correct, and the published group page does something else:
 *
 *   · an FAQ with no items rendered an empty <section> that still took its
 *     block padding, instead of dropping out (BlockFaqAccordion returns null)
 *   · an FAQ item with a question and no answer rendered an empty <p>
 *   · no FAQPage JSON-LD, so the same questions were eligible for a rich search
 *     result on a villa page and not on a content page
 *   · a rich answer went through safeHtml into a <p>, so an answer containing a
 *     list produced `<p><ul>…</ul></p>` — invalid, and every browser unnests it,
 *     which lifts the list out of the paragraph and out of the answer's styling
 *   · the table's backward-compatible header for the legacy pricing_table shape
 *     was 名稱／價格／說明 against the villa's 房型／價格／容量／說明: one column
 *     short, so every room's capacity was silently dropped
 *   · a table cell saved as a bilingual {zh,en} object went straight into a
 *     <td>, and React throws on an object child — the whole page, not the cell
 *   · 入住須知 did not filter empty labels, so a blank row still drew its "01"
 *     and an empty <strong>
 *
 * The blocks are rendered here, not grepped. Asking "does PageBlocks import
 * BlockTable" would pass against an import that no case uses; the question is
 * what comes out of the renderer for a given config.
 */

/* ── compile-and-render harness (same shape as contentBlockParity) ──────── */

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

const stub = (name: string) => ({ default: () => h("div", { "data-stub": name }) });
const REACT_STUB = { useState: (init: unknown) => [init, () => {}] };

/** The three villa components under test, compiled for real. */
const faqAccordion = compile("app/modules/property/blocks/BlockFaqAccordion.tsx", {
  "../../faqSchema": faqSchema,
  "../../JsonLd": {
    default: ({ data }: { data: unknown }) => h("script", { "data-jsonld": JSON.stringify(data) }),
  },
  react: REACT_STUB,
  "../../i18n": {},
  "../../tr": tr,
  "../../safeHtml": safeHtmlMod,
});
const houseRules = compile("app/modules/property/blocks/BlockHouseRules.tsx", {
  "../../i18n": {},
  "../../tr": tr,
});
const blockTable = compile("app/modules/property/blocks/BlockTable.tsx", {
  "../../i18n": {},
  "../../tr": tr,
});

const blockPairs = compile("app/modules/blockPairs.tsx", {
  "./blockStyle": blockStyle,
  "./BlockWrapper": { default: ({ children }: { children: unknown }) => h("div", { className: "wrap" }, children) },
});

const PAGE_BLOCK_STUBS: Record<string, unknown> = {
  "../socialLinks": socialLinks,
  react: REACT_STUB,
  "lucide-react": { Mail: "Mail", MapPin: "MapPin", MessageCircle: "MessageCircle", Phone: "Phone" },
  "../safeCss": safeCss,
  "../BlockWrapper": { default: ({ children }: { children: unknown }) => h("div", { className: "wrap" }, children) },
  "../blockPairs": blockPairs,
  "../safeHtml": safeHtmlMod,
  "../i18n": {},
  "../tr": tr,
  "../unknownBlock": unknownBlock,
  "./ContactOffices": stub("offices"),
  "../property/blocks/BlockFaqAccordion": faqAccordion,
  "../property/blocks/BlockHouseRules": houseRules,
  "../property/blocks/BlockTable": blockTable,
};
for (const id of [
  "../home/blocks/BlockFlow", "../home/blocks/BlockStays", "../home/blocks/BlockGallery",
  "../home/blocks/BlockPathways", "../home/blocks/BlockEditorial", "../home/blocks/BlockAbout",
  "../home/blocks/BlockNewsletter", "../home/blocks/BlockSearchBar",
  "../property/blocks/BlockFeatureList", "../property/blocks/BlockFeatureBadges",
  "../property/blocks/BlockImageGallery", "../property/blocks/BlockRichText",
  "../property/blocks/BlockOembed", "./ContactFormBlock", "../property/blocks/BlockContactInfo",
  "../property/blocks/BlockHeroBanner", "../property/blocks/BlockRooms",
  "../property/blocks/BlockMap", "../property/blocks/BlockAttractions",
  "../property/blocks/BlockPartners",
  "../property/blocks/BlockVideoText", "../property/blocks/BlockFeatureHero",
  "../property/blocks/BlockAlternating",
]) PAGE_BLOCK_STUBS[id] = stub(id);

const PageBlocks = compile("app/modules/content/PageBlocks.tsx", PAGE_BLOCK_STUBS).default as (
  p: Record<string, unknown>,
) => unknown;

function expand(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(expand);
  if (!isEl(node)) return node;
  if (typeof node.type === "function") {
    return expand((node.type as (p: Record<string, unknown>) => unknown)(node.props));
  }
  return { type: node.type, props: { ...node.props, children: expand(node.props.children) } };
}

/** One block, drawn the way a group content page draws it. */
const draw = (type: string, config: Record<string, unknown>, locale: "zh" | "en" = "zh") =>
  expand(PageBlocks({ blocks: [{ id: "b1", type, config }], locale }));

function texts(node: unknown): string[] {
  const out: string[] = [];
  const collect = (n: unknown): void => {
    if (Array.isArray(n)) return void n.forEach(collect);
    if (typeof n === "string") { if (n.trim()) out.push(n.trim()); return; }
    if (isEl(n)) collect(n.props.children);
  };
  collect(node);
  return out;
}

function classes(node: unknown): string[] {
  const out: string[] = [];
  const visit = (n: unknown): void => {
    if (Array.isArray(n)) return void n.forEach(visit);
    if (!isEl(n)) return;
    if (typeof n.props.className === "string") out.push(n.props.className);
    visit(n.props.children);
  };
  visit(node);
  return out;
}

/** Every element of a tag, anywhere in the tree. */
function tags(node: unknown, type: string): El[] {
  const out: El[] = [];
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) return void n.forEach(walk);
    if (!isEl(n)) return;
    if (n.type === type) out.push(n);
    walk(n.props.children);
  };
  walk(node);
  return out;
}

/**
 * Children that are neither elements, arrays, strings, numbers, null nor
 * undefined — i.e. the ones React refuses to render.
 *
 * "Objects are not valid as a React child" is thrown during render, so on a
 * server-rendered page it is not a broken cell: it is a 500 for the whole
 * route. A test that only looked at the text would see the cell missing and
 * call it cosmetic.
 */
function invalidChildren(node: unknown): unknown[] {
  const bad: unknown[] = [];
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) return void n.forEach(walk);
    if (n === null || n === undefined) return;
    if (typeof n === "string" || typeof n === "number" || typeof n === "boolean") return;
    if (isEl(n)) return walk(n.props.children);
    bad.push(n);
  };
  walk(node);
  return bad;
}

/* ── FAQ ────────────────────────────────────────────────────────────────── */

test("an FAQ with no items draws nothing, not an empty section", () => {
  const empty = draw("faq_accordion", { title: { zh: "常見問題", en: "FAQ" }, items: [] });
  assert.deepEqual(texts(empty), [], `an empty FAQ still rendered: ${JSON.stringify(texts(empty))}`);
  assert.ok(
    !classes(empty).some((c) => c.includes("faq")),
    "the FAQ block still draws a section with nothing in it, which takes its own block padding",
  );
});

test("an FAQ item with no answer is dropped rather than drawn as an empty paragraph", () => {
  const tree = draw("faq_accordion", {
    items: [
      { question: { zh: "有答案的問題" }, answer: { zh: "答案" } },
      { question: { zh: "還沒寫答案" }, answer: { zh: "" } },
    ],
  });
  const t = texts(tree);
  assert.ok(t.includes("有答案的問題"), "the complete item stopped rendering");
  assert.ok(!t.includes("還沒寫答案"), "a question with no answer is still drawn with an empty body under it");
});

test("the questions reach search engines as FAQPage data, on a content page too", () => {
  const tree = draw("faq_accordion", {
    items: [{ question: { zh: "可以帶寵物嗎" }, answer: { zh: "可以，需事先告知" } }],
  });
  const scripts = tags(tree, "script").filter((s) => typeof s.props["data-jsonld"] === "string");
  assert.equal(scripts.length, 1, "no FAQPage JSON-LD — the same block emits it on a villa page");
  const data = JSON.parse(String(scripts[0]!.props["data-jsonld"]));
  assert.equal(data["@type"], "FAQPage");
  assert.equal(data.mainEntity[0].name, "可以帶寵物嗎");
  assert.match(String(data.mainEntity[0].acceptedAnswer.text), /可以，需事先告知/);
});

test("a rich answer is not forced into a <p> it cannot legally live in", () => {
  /* `<p><ul>…</ul></p>` is what the old copy produced. It is not merely invalid:
     the parser closes the paragraph at the <ul>, so the list becomes a SIBLING
     of the answer's paragraph and escapes every rule written for
     `.stay-faq-answer p`. The list came out unstyled and outdented. */
  const tree = draw("faq_accordion", {
    items: [{ question: { zh: "包含什麼" }, answer: { zh: "<ul><li>早餐</li><li>停車</li></ul>" } }],
  });
  const withHtml = [...tags(tree, "p"), ...tags(tree, "div")]
    .filter((el) => (el.props.dangerouslySetInnerHTML as { __html?: string } | undefined)?.__html);
  assert.equal(withHtml.length, 1, "the rich answer is not rendered exactly once");
  assert.equal(
    withHtml[0]!.type,
    "div",
    "the answer HTML is back inside a <p>, so a list in it unnests itself out of the answer",
  );
  assert.match(
    String((withHtml[0]!.props.dangerouslySetInnerHTML as { __html: string }).__html),
    /<ul>/,
    "the list markup was stripped — this answer path must keep block elements",
  );
});

test("a plain-text answer still keeps its line breaks", () => {
  // The other half of the branch: not everything is editor HTML, and the older
  // plain answers rely on newline conversion.
  const tree = draw("faq_accordion", {
    items: [{ question: { zh: "怎麼去" }, answer: { zh: "先搭火車\n再轉客運" } }],
  });
  const html = [...tags(tree, "p"), ...tags(tree, "div")]
    .map((el) => (el.props.dangerouslySetInnerHTML as { __html?: string } | undefined)?.__html)
    .filter(Boolean)
    .join("");
  assert.match(html, /<br\s*\/?>/, "a typed line break in a plain answer is swallowed");
});

/* ── 表格 ───────────────────────────────────────────────────────────────── */

test("the legacy pricing table keeps its 容量 column on a content page", () => {
  const tree = draw("table", {
    items: [{ name: { zh: "海景四人房" }, price: 6800, capacity: 4, description: { zh: "含早餐" } }],
  });
  const t = texts(tree);
  for (const header of ["房型", "價格", "容量", "說明"]) {
    assert.ok(t.includes(header), `the ${header} column is missing: ${JSON.stringify(t)}`);
  }
  assert.ok(t.includes("4"), "the capacity value has nowhere to go, so the number is dropped entirely");
  assert.ok(t.includes("6800") && t.includes("含早餐"), "the rest of the row stopped rendering");
});

test("a bilingual cell renders as text instead of throwing the page away", () => {
  /* The editor saves {zh,en} into a cell. Written straight into a <td> that is
     an object child, and React does not render it — it throws, during the
     server render, for the whole route. */
  const tree = draw("table", {
    columns: [{ label: { zh: "項目" } }, { label: { zh: "說明" } }],
    rows: [[{ zh: "加床", en: "Extra bed" }, "NT$800"]],
  });
  assert.deepEqual(
    invalidChildren(tree),
    [],
    "a raw object is still handed to React as a child — this is a 500, not a blank cell",
  );
  const t = texts(tree);
  assert.ok(t.includes("加床"), `the Chinese cell text did not render: ${JSON.stringify(t)}`);
  assert.ok(!t.includes("Extra bed"), "the English cell text leaked onto the Chinese page");
});

test("a bilingual cell follows the page language", () => {
  const en = draw("table", {
    columns: [{ label: { zh: "項目", en: "Item" } }],
    rows: [[{ zh: "加床", en: "Extra bed" }]],
  }, "en");
  assert.ok(texts(en).includes("Extra bed"), "the English page shows the Chinese cell");
});

test("a table with neither columns nor rows draws nothing", () => {
  assert.deepEqual(texts(draw("table", { title: { zh: "價目表" } })), []);
});

/* ── 入住須知 ───────────────────────────────────────────────────────────── */

test("an 入住須知 row with no label is dropped, not numbered and left blank", () => {
  const tree = draw("house_rules", {
    items: [
      { label: { zh: "入住時間" }, detail: { zh: "15:00 後" } },
      { label: { zh: "" }, detail: { zh: "" } },
    ],
  });
  const t = texts(tree);
  assert.ok(t.includes("入住時間") && t.includes("15:00 後"), "the real rule stopped rendering");
  assert.ok(!t.includes("02"), `the empty row is still drawn with its number: ${JSON.stringify(t)}`);
});

test("an 入住須知 with no rules at all draws nothing", () => {
  assert.deepEqual(texts(draw("house_rules", { items: [] })), []);
});

test("a rule's detail is rendered once", () => {
  // The removed copy called cfgT(item, "detail") twice per row — once to decide
  // whether to draw the paragraph and once to fill it.
  const tree = draw("house_rules", { items: [{ label: { zh: "退房" }, detail: { zh: "11:00 前" } }] });
  assert.equal(
    texts(tree).filter((s) => s === "11:00 前").length,
    1,
    "the detail is rendered more than once",
  );
});

/* ── the copies stay gone ───────────────────────────────────────────────── */

test("neither renderer draws these three blocks itself again", () => {
  /* The defect was two implementations of each. A `case` that builds its own
     markup instead of naming the shared component has started a third. */
  for (const [file, assign] of [
    ["app/modules/content/PageBlocks.tsx", "el ="],
    ["app/modules/property/PropertyPageRenderer.tsx", "return"],
  ] as const) {
    const src = readCode(file);
    for (const [type, component] of [
      ["faq_accordion", "BlockFaqAccordion"],
      ["house_rules", "BlockHouseRules"],
      ["table", "BlockTable"],
    ] as const) {
      assert.match(
        src,
        new RegExp(`case "${type}":\\s*${assign}\\s*<${component}\\b`),
        `${file} no longer hands ${type} to ${component}`,
      );
    }
  }
  // …and the local copies are not merely unreferenced but gone.
  const pageBlocks = readCode("app/modules/content/PageBlocks.tsx");
  for (const name of ["function FaqAccordion", "function HouseRulesBlock", "function TableBlock"]) {
    assert.ok(!pageBlocks.includes(name), `${name} is back in PageBlocks — the two copies can drift again`);
  }
});

test("the rules for the removed copies' markup went with them", () => {
  // Dead CSS is how a removed component keeps looking maintained: two audits of
  // this stylesheet reported rules for classes nothing rendered as live defects.
  const css = readStyles("app/globals.css");
  for (const cls of ["page-block-faq", "page-block-table"]) {
    assert.ok(
      !new RegExp(`\\.${cls}(?![\\w-])`).test(css),
      `.${cls} is styled again, and nothing renders it`,
    );
  }
  // The rules that took over are still there.
  for (const cls of ["property-faq", "property-pricing"]) {
    assert.ok(new RegExp(`\\.${cls}(?![\\w-])`).test(css), `.${cls} lost its rules`);
  }
});

/* ── the villa map still follows the site language ──────────────────────── */

test("the villa contact map asks Google for the page's language", () => {
  /* Reported as a divergence — a content page added `hl` and the villa page did
     not — and it is not one: BlockContactInfo frames its map through MapEmbed,
     which localises the src itself. Measured on the running site,
     /stays/hejing/contact renders `hl=zh-TW` under the Chinese cookie and
     `hl=en` under the English one. Pinned here because "it already works" is
     the state that quietly stops being true: nothing else in the suite ties
     this component to a locale-aware frame. */
  const contact = readCode("app/modules/property/blocks/BlockContactInfo.tsx");
  assert.ok(
    !contact.includes("<iframe"),
    "BlockContactInfo frames the map itself again, so the hl parameter is its own problem once more",
  );
  const embeds = [...contact.matchAll(/<MapEmbed[\s\S]{0,400}?\/>/g)].map((m) => m[0]);
  assert.ok(embeds.length >= 1, "BlockContactInfo no longer draws its map through MapEmbed");
  for (const embed of embeds) {
    assert.match(embed, /locale=\{locale\}/, `a MapEmbed is mounted without the page locale: ${embed}`);
  }
  const mapEmbed = readCode("app/modules/MapEmbed.tsx");
  assert.match(
    mapEmbed,
    /mapSrcForLocale\(src, locale\)/,
    "MapEmbed stopped localising its src, so every map on the site is pinned to one language",
  );
});

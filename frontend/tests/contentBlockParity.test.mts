import assert from "node:assert/strict";
import * as blockStyle from "../app/modules/blockStyle.ts";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

import * as tr from "../app/modules/tr.ts";
import * as safeHtml from "../app/modules/safeHtml.ts";
import * as faqSchema from "../app/modules/faqSchema.ts";
import * as socialLinks from "../app/modules/socialLinks.ts";
import * as safeCss from "../app/modules/safeCss.ts";
import * as unknownBlock from "../app/modules/unknownBlock.ts";
import { sharedModule } from "./sharedModules.mts";

/**
 * A block drawn on a group content page shows what the same block shows on a
 * villa page.
 *
 * Several block types are drawn by two components: the property one, and a
 * thinner local copy inside PageBlocks that group content pages (/brand,
 * /journal, /contact) go through. The copies had drifted, and every gap looked
 * identical from the editor — the field was there, it saved, the admin's own
 * preview (which renders through the property component) showed it, and the
 * published page did not:
 *
 *   · FAQ 眉批 — read only by BlockFaqAccordion
 *   · 設施 眉批 / 標題 / 分類分組 — the local copy drew badges and nothing else
 *   · 聯絡資訊 交通指引 — read by the classic layout only, and /contact defaults
 *     to cards
 *
 * PageBlocks is compiled and called here, not grepped: the question is whether
 * the text reaches the markup.
 */

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

/** A component that is not under test renders as an inert marker. */
const stubComponent = (name: string) => ({ default: () => h("div", { "data-stub": name }) });

const blockPairs = compile("app/modules/blockPairs.tsx", {
  "./blockStyle": blockStyle,
  "./BlockWrapper": { default: ({ children }: { children: unknown }) => h("div", { className: "wrap" }, children) },
});

const featureBadges = compile("app/modules/property/blocks/BlockFeatureBadges.tsx", {
  "../../tr": tr,
  "../../i18n": {},
  react: {},
});

/* The villa components the content renderer now shares, compiled for real
   rather than stubbed. A stub would make every assertion below pass by
   rendering nothing, which is the opposite of what this file is for: the
   question is whether an editor's text reaches the markup on a group page, and
   only the component that actually draws it can answer that. */
const REACT_STUB = { useState: (init: unknown) => [init, () => {}] };
const faqAccordion = compile("app/modules/property/blocks/BlockFaqAccordion.tsx", {
  "../../faqSchema": faqSchema,
  "../../JsonLd": { default: ({ data }: { data: unknown }) => h("script", { type: "application/ld+json", "data-jsonld": JSON.stringify(data) }) },
  react: REACT_STUB,
  "../../i18n": {},
  "../../tr": tr,
  "../../safeHtml": safeHtml,
});
const houseRules = compile("app/modules/property/blocks/BlockHouseRules.tsx", {
  "../../i18n": {},
  "../../tr": tr,
});
const blockTable = compile("app/modules/property/blocks/BlockTable.tsx", {
  "../../i18n": {},
  "../../tr": tr,
});

const PAGE_BLOCK_STUBS: Record<string, unknown> = {
  // The map is the shared embed; what it frames is MapEmbed's own test.
  "../MapEmbed": { default: (p: Record<string, unknown>) => ({ type: "iframe", props: { src: p.src, children: [] } }) },
  "../property/blocks/BlockFaqAccordion": faqAccordion,
  "../property/blocks/BlockHouseRules": houseRules,
  "../property/blocks/BlockTable": blockTable,
  "../socialLinks": socialLinks,
  react: {},
  "lucide-react": { Mail: "Mail", MapPin: "MapPin", MessageCircle: "MessageCircle", Phone: "Phone" },
  "../safeCss": safeCss,
  "../BlockWrapper": { default: ({ children }: { children: unknown }) => h("div", { className: "wrap" }, children) },
  "../blockPairs": blockPairs,
  "../safeHtml": safeHtml,
  "../i18n": {},
  "../tr": tr,
  "../unknownBlock": unknownBlock,
  "../property/blocks/BlockFeatureBadges": featureBadges,
  "./ContactOffices": { default: () => h("div", { "data-stub": "offices" }) },
};
for (const id of [
  "../home/blocks/BlockFlow", "../home/blocks/BlockStays", "../home/blocks/BlockGallery",
  "../home/blocks/BlockPathways", "../home/blocks/BlockEditorial", "../home/blocks/BlockAbout",
  "../home/blocks/BlockNewsletter", "../home/blocks/BlockSearchBar",
  "../property/blocks/BlockFeatureList",
  "../property/blocks/BlockImageGallery", "../property/blocks/BlockRichText",
  "../property/blocks/BlockOembed", "./ContactFormBlock", "../property/blocks/BlockContactInfo",
  "../property/blocks/BlockHeroBanner", "../property/blocks/BlockRooms",
  "../property/blocks/BlockMap", "../property/blocks/BlockAttractions",
  "../property/blocks/BlockPartners",
  "../property/blocks/BlockVideoText", "../property/blocks/BlockFeatureHero",
  "../property/blocks/BlockAlternating",
]) PAGE_BLOCK_STUBS[id] = stubComponent(id);

const PageBlocks = compile("app/modules/content/PageBlocks.tsx", PAGE_BLOCK_STUBS).default as (
  p: Record<string, unknown>,
) => unknown;

/** Call every function component in the tree, so what comes back is markup. */
function expand(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(expand);
  if (!isEl(node)) return node;
  if (typeof node.type === "function") {
    return expand((node.type as (p: Record<string, unknown>) => unknown)(node.props));
  }
  return { type: node.type, props: { ...node.props, children: expand(node.props.children) } };
}

/** Every string rendered anywhere in the tree. */
function texts(node: unknown): string[] {
  const out: string[] = [];
  const collect = (n: unknown): void => {
    if (Array.isArray(n)) return n.forEach(collect);
    if (typeof n === "string") { if (n.trim()) out.push(n.trim()); return; }
    if (isEl(n)) collect(n.props.children);
  };
  collect(node);
  return out;
}

/** Class names present anywhere in the tree. */
function classes(node: unknown): string[] {
  const out: string[] = [];
  const visit = (n: unknown): void => {
    if (Array.isArray(n)) return n.forEach(visit);
    if (!isEl(n)) return;
    if (typeof n.props.className === "string") out.push(n.props.className);
    visit(n.props.children);
  };
  visit(node);
  return out;
}

const render = (type: string, config: Record<string, unknown>, locale: "zh" | "en" = "zh") =>
  expand(PageBlocks({ blocks: [{ id: "b1", type, config }], locale }));

test("交通指引 reaches the cards layout, which is what /contact uses", () => {
  const tree = render("contact_info", {
    layout: "cards",
    address: { zh: "台北市信義區", en: "Taipei" },
    directions: { zh: "捷運市政府站 3 號出口\n步行約 8 分鐘", en: "Exit 3\nEight minutes on foot" },
  });
  assert.ok(
    classes(tree).includes("property-contact-directions"),
    "the cards layout still drops 交通指引 — the field saves and the page shows nothing",
  );
  const t = texts(tree);
  assert.ok(t.includes("捷運市政府站 3 號出口"), "the first line of 交通指引 is missing");
  // Each line is its own paragraph, as on the villa page — not one run-on line.
  assert.ok(t.includes("步行約 8 分鐘"), "a typed line break in 交通指引 is swallowed");
});

test("FAQ 眉批 reaches a group content page", () => {
  const tree = render("faq_accordion", {
    eyebrow: { zh: "常見問題眉批", en: "FAQ eyebrow" },
    title: { zh: "常見問題", en: "FAQ" },
    items: [{ question: { zh: "可以帶寵物嗎", en: "Pets" }, answer: { zh: "可以", en: "Yes" } }],
  });
  assert.ok(texts(tree).includes("常見問題眉批"), "the FAQ 眉批 is dropped on content pages again");
});

test("設施區塊 keeps its 眉批, 標題 and 分類 grouping off the villa too", () => {
  const tree = render("feature_badges", {
    eyebrow: { zh: "設施眉批", en: "Amenities" },
    title: { zh: "館內設施", en: "Facilities" },
    items: [
      { label: { zh: "溫泉", en: "Onsen" }, category: { zh: "湯屋", en: "Bath" } },
      { label: { zh: "早餐", en: "Breakfast" }, category: { zh: "餐飲", en: "Dining" } },
    ],
  });
  const t = texts(tree);
  assert.ok(t.includes("設施眉批"), "設施 眉批 is dropped on content pages again");
  assert.ok(t.includes("館內設施"), "設施 標題 is dropped on content pages again");
  assert.ok(
    classes(tree).some((c) => c.includes("property-features--categorized")),
    "分類 no longer groups the badges on a content page",
  );
});

test("並排 reaches a group content page", () => {
  // The four keys were read only by the villa renderer; a content page stacked.
  const tree = expand(PageBlocks({
    blocks: [
      { id: "a", type: "table", config: { _pairNext: true, title: { zh: "甲", en: "A" }, rows: [["1"]] } },
      { id: "b", type: "table", config: { title: { zh: "乙", en: "B" }, rows: [["2"]] } },
    ],
    locale: "zh",
  }));
  assert.ok(
    classes(tree).includes("property-block-pair"),
    "與下一個區塊並排 still does nothing on a group content page",
  );
});

test("住宿搜尋列 draws on a group content page too", () => {
  /* The palette offers it on every group page and PageBlocks had no case for
     it, so on /brand or /journal it fell through to reportUnknownBlock and the
     section came out empty. The editor previews a content page through the
     PROPERTY renderer, which does have the case — so the block looked right in
     the admin and was blank in public, the worst version of this defect. */
  const tree = render("search", { title: { zh: "找住宿", en: "Find a stay" } });
  const stubs: string[] = [];
  const visit = (n: unknown): void => {
    if (Array.isArray(n)) return n.forEach(visit);
    if (!isEl(n)) return;
    if (typeof n.props["data-stub"] === "string") stubs.push(n.props["data-stub"] as string);
    visit(n.props.children);
  };
  visit(tree);
  assert.ok(
    stubs.some((s) => s.includes("BlockSearchBar")),
    "the search block renders nothing on a group content page",
  );
});

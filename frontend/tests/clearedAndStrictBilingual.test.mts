import assert from "node:assert/strict";
import * as blockStyle from "../app/modules/blockStyle.ts";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

import * as tr from "../app/modules/tr.ts";
import * as safeHtml from "../app/modules/safeHtml.ts";
import * as safeCss from "../app/modules/safeCss.ts";
import * as socialLinks from "../app/modules/socialLinks.ts";
import * as contactContext from "../app/modules/contactContext.ts";
import * as unknownBlock from "../app/modules/unknownBlock.ts";
import { seoTextForLocale } from "../app/modules/seo.ts";
import { readCode } from "./readCode.mts";
import { sharedModule } from "./sharedModules.mts";

/**
 * Fields that must mean the same thing on every kind of page, and must not
 * borrow the other language.
 *
 * Every case here is one control read two different ways by two renderers. The
 * editor cannot see the difference: the field is offered, it saves, the admin
 * preview (which draws through the PROPERTY renderer) shows the right thing,
 * and the published group page shows something else. tr.ts already carries the
 * readers that settle each of these — clearableT / eyebrowT for "cleared means
 * cleared", bilingualOr for "an English page never prints Chinese" — and the
 * bug in each case was a call site that had not moved onto them.
 */

/* ── compile-and-render harness ────────────────────────────────────────── */

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

/** Call every function component in the tree, so what comes back is markup. */
function expand(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(expand);
  if (!isEl(node)) return node;
  if (typeof node.type === "function") {
    return expand((node.type as (p: Record<string, unknown>) => unknown)(node.props));
  }
  return { type: node.type, props: { ...node.props, children: expand(node.props.children) } };
}

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

/** Every element of a given tag in the tree. */
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

const blockPairs = compile("app/modules/blockPairs.tsx", {
  "./blockStyle": blockStyle,
  "./BlockWrapper": { default: ({ children }: { children: unknown }) => h("div", null, children) },
});

/* faq_accordion and house_rules are drawn on a group page by the villa
   components now, so the real ones are compiled in rather than stubbed —
   `eyebrowT` reaching the markup is the whole assertion, and a stub renders no
   markup to look at. */
const faqAccordion = compile("app/modules/property/blocks/BlockFaqAccordion.tsx", {
  "../../faqSchema": { faqJsonLd: () => null },
  "../../JsonLd": { default: () => null },
  react: { useState: (init: unknown) => [init, () => {}] },
  "../../i18n": {},
  "../../tr": tr,
  "../../safeHtml": safeHtml,
});
const houseRules = compile("app/modules/property/blocks/BlockHouseRules.tsx", {
  "../../i18n": {},
  "../../tr": tr,
});

const PAGE_BLOCK_STUBS: Record<string, unknown> = {
  "../property/blocks/BlockFaqAccordion": faqAccordion,
  "../property/blocks/BlockHouseRules": houseRules,
  "../property/blocks/BlockTable": stub("../property/blocks/BlockTable"),
  "../socialLinks": socialLinks,
  "../contactContext": contactContext,
  react: {},
  "lucide-react": { Mail: "Mail", MapPin: "MapPin", MessageCircle: "MessageCircle", Phone: "Phone" },
  "../safeCss": safeCss,
  "../BlockWrapper": { default: ({ children }: { children: unknown }) => h("div", null, children) },
  "../blockPairs": blockPairs,
  "../safeHtml": safeHtml,
  "../i18n": {},
  "../tr": tr,
  "../unknownBlock": unknownBlock,
  "./ContactOffices": stub("offices"),
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

const drawGroupBlock = (type: string, config: Record<string, unknown>, locale: string) =>
  expand(PageBlocks({ blocks: [{ id: "b1", type, config }], locale }));

/* ── 1. An emptied 眉批 stays empty, and never becomes the other language ── */

/**
 * `cfgT` reads an empty string the same as a missing key and hands back the
 * other locale, so the same block cleared in the admin behaved two ways:
 * BlockFaqAccordion / BlockHouseRules / BlockContactInfo read the field through
 * `eyebrowT` and it disappeared on the villa page, while these three renderers
 * read it through `cfgT` and the group content page started showing the ENGLISH
 * eyebrow instead. `clearableT` in tr.ts was written to settle exactly this and
 * only half the call sites moved onto it.
 */
const EYEBROW_BLOCKS: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
  ["faq_accordion", { items: [{ question: { zh: "問" }, answer: { zh: "答" } }] }],
  ["house_rules", { items: [{ label: { zh: "規則" } }] }],
  ["contact_info", { phone: "02-1234-5678" }],
];

for (const [type, base] of EYEBROW_BLOCKS) {
  test(`${type}: clearing the Chinese 眉批 clears it, it does not print the English one`, () => {
    const cleared = drawGroupBlock(type, { ...base, eyebrow: { zh: "", en: "OUR STORY" } }, "zh");
    assert.ok(
      !texts(cleared).includes("OUR STORY"),
      `the emptied 眉批 came back as the English text: ${JSON.stringify(texts(cleared))}`,
    );
    // Nothing is left holding the space either.
    const rails = tags(cleared, "div").filter((el) => el.props.className === "eyebrow");
    assert.equal(rails.length, 0, "an empty eyebrow element is still drawn");
  });

  test(`${type}: a 眉批 that IS set still shows`, () => {
    const shown = drawGroupBlock(type, { ...base, eyebrow: { zh: "慢域", en: "SELECT" } }, "zh");
    assert.ok(texts(shown).includes("慢域"), `the 眉批 stopped rendering: ${JSON.stringify(texts(shown))}`);
  });

  test(`${type}: a block with no 眉批 key at all is unaffected`, () => {
    // Absent is not the same as cleared — eyebrowT still borrows there, which is
    // what keeps a half-translated block showing something.
    const borrowed = drawGroupBlock(type, { ...base, eyebrow: { zh: "慢域" } }, "en");
    assert.ok(texts(borrowed).includes("慢域"), "an untranslated 眉批 stopped falling back");
  });
}

/* ── 2. The two CTA buttons read strictly, like the submit button beside them ─ */

const ContactFormBlock = compile("app/modules/content/ContactFormBlock.tsx", {
  react: { useState: (init: unknown) => [init, () => {}] },
  "../socialLinks": socialLinks,
  "../contactContext": contactContext,
  "../safeHtml": safeHtml,
  "../i18n": {},
  "../tr": tr,
}).default as (p: Record<string, unknown>) => unknown;

/**
 * The file contradicted itself. The comment above `submit_label` says cfgT
 * borrows the other language and that "the correct English default below it
 * could never be reached" — and the two CTA buttons twenty lines down still
 * read `cfgT(config, "line_label", …) || (lang === "zh" ? … : …)`.
 */
test("a Chinese-only CTA label does not become the English button's text", () => {
  const config = {
    display: "cta",
    line: "@slowfield",
    cta_href: "/booking",
    line_label: { zh: "LINE 詢問" },
    cta_label: { zh: "填寫預約需求" },
  };
  const en = texts(expand(ContactFormBlock({ config, locale: "en" })));
  assert.ok(!en.includes("LINE 詢問"), `the Chinese LINE label reached the English page: ${JSON.stringify(en)}`);
  assert.ok(!en.includes("填寫預約需求"), `the Chinese CTA label reached the English page: ${JSON.stringify(en)}`);
  assert.ok(en.includes("Enquire on LINE"), `the English default is still unreachable: ${JSON.stringify(en)}`);
  assert.ok(en.includes("Booking request"), `the English default is still unreachable: ${JSON.stringify(en)}`);

  // …and the Chinese page keeps what the editor typed.
  const zh = texts(expand(ContactFormBlock({ config, locale: "zh" })));
  assert.ok(zh.includes("LINE 詢問") && zh.includes("填寫預約需求"), JSON.stringify(zh));
});

test("an English CTA label the editor DID write is used", () => {
  const zhAndEn = {
    display: "cta",
    line: "@slowfield",
    cta_href: "/booking",
    line_label: { zh: "LINE 詢問", en: "Chat on LINE" },
    cta_label: { zh: "填寫預約需求", en: "Request a stay" },
  };
  const en = texts(expand(ContactFormBlock({ config: zhAndEn, locale: "en" })));
  assert.ok(en.includes("Chat on LINE") && en.includes("Request a stay"), JSON.stringify(en));
});

test("the submit button is read the same way, and all three share one reader", () => {
  const en = texts(
    expand(ContactFormBlock({ config: { submit_label: { zh: "送出訊息" } }, locale: "en" })),
  );
  assert.ok(!en.includes("送出訊息"), `the Chinese submit label reached the English form: ${JSON.stringify(en)}`);
  assert.ok(en.includes("Send message"), JSON.stringify(en));

  const src = readCode("app/modules/content/ContactFormBlock.tsx");
  for (const key of ["submit_label", "line_label", "cta_label"]) {
    assert.ok(
      src.includes(`strictLabel(config, "${key}", lang)`),
      `${key} is back on a borrowing reader, so its default below it is unreachable`,
    );
  }
});

/* ── 3. SEO title / description: an English page never inherits Chinese ── */

/**
 * The group homepage wrote its own strict reader for this and left a comment
 * saying why ("cfgT would then borrow the Chinese half — leaving the English
 * homepage with a Chinese <title>"). The villa homepage, the villa sub-page
 * route and `pageSettingsSeo` — which five parent routes consume — did not
 * follow, so the fix covered exactly one page out of the whole site.
 */
test("an empty English SEO field falls through to the route's own default", () => {
  assert.equal(seoTextForLocale({ zh: "宜蘭包棟", en: "" }, "en", "Villa"), "Villa");
  assert.equal(seoTextForLocale({ zh: "宜蘭包棟" }, "en", "Villa"), "Villa");
  assert.equal(seoTextForLocale({ zh: "宜蘭包棟", en: "   " }, "en", "Villa"), "Villa");
  assert.equal(seoTextForLocale(undefined, "en", "Villa"), "Villa");
});

test("a value the editor DID write in each language is used as typed", () => {
  assert.equal(seoTextForLocale({ zh: "宜蘭包棟", en: "Yilan Villa" }, "en", "Villa"), "Yilan Villa");
  assert.equal(seoTextForLocale({ zh: "宜蘭包棟", en: "Yilan Villa" }, "zh", "Villa"), "宜蘭包棟");
  /* A per-locale half is taken whole. Running it through the combined-string
     splitter as well would cut "宜蘭包棟 Villa" down to "宜蘭包棟" on the
     Chinese page — the editor already told us which language this half is. */
  assert.equal(seoTextForLocale({ zh: "宜蘭包棟 Villa" }, "zh", "x"), "宜蘭包棟 Villa");
});

test("a legacy single-field value still resolves per language", () => {
  // One string carrying both languages — what the field held before the
  // bilingual editor existed. bilingualOr is the reader for that shape.
  assert.equal(seoTextForLocale("宜蘭包棟 · Yilan Villa", "en", "fallback"), "Yilan Villa");
  assert.equal(seoTextForLocale("宜蘭包棟 · Yilan Villa", "zh", "fallback"), "宜蘭包棟");
  // Chinese only: the English page takes its default rather than printing it.
  assert.equal(seoTextForLocale("宜蘭冬山湯泉草原包棟", "en", "fallback"), "fallback");
  assert.equal(seoTextForLocale("Yilan Villa", "en", "fallback"), "Yilan Villa");
});

test("the villa routes and pageSettingsSeo all read SEO text the same way", () => {
  /* Named rather than only exampled: what went wrong here was three call sites
     reaching for the generic reader, not one of them computing a wrong answer.
     The metadata is server-rendered from a database this suite does not have,
     so the call site is the thing that can be checked. */
  for (const [file, keys] of [
    ["app/property/[slug]/page.tsx", ["hpSeo.title", "hpSeo.description"]],
    ["app/property/[slug]/[...pageSlug]/page.tsx", ["pageSeo.title", "pageSeo.description"]],
  ] as const) {
    const src = readCode(file);
    for (const key of keys) {
      assert.ok(
        src.includes(`seoTextForLocale(${key}, locale)`),
        `${file} reads ${key} through a reader that borrows the other language`,
      );
      assert.ok(
        !src.includes(`cfgT(${key.split(".")[0]}, "${key.split(".")[1]}", locale)`),
        `${file} still has the borrowing read of ${key}`,
      );
    }
  }
  const seo = readCode("app/modules/seo.ts");
  assert.ok(
    seo.includes("title: seoTextForLocale(seo.title, locale)"),
    "pageSettingsSeo is back on pickT, which borrows the other locale",
  );
  assert.ok(
    seo.includes("description: seoTextForLocale(seo.description, locale)"),
    "pageSettingsSeo is back on pickT, which borrows the other locale",
  );
});

/* ── 4. A LINE id that will not build a link draws no link ─────────────── */

const ContactOffices = compile("app/modules/content/ContactOffices.tsx", {
  react: {},
  "lucide-react": { Building2: "Building2", ChevronDown: "ChevronDown", Mail: "Mail", MapPin: "MapPin", Phone: "Phone" },
  "../i18n": {},
  "../tr": tr,
  "../socialLinks": socialLinks,
  "../contactContext": contactContext,
}).default as (p: Record<string, unknown>) => unknown;

const BlockContactInfo = compile("app/modules/property/blocks/BlockContactInfo.tsx", {
  react: {},
  "../../safeHtml": safeHtml,
  "../../socialLinks": socialLinks,
  "../../i18n": {},
  "../../tr": tr,
  "../../MapEmbed": stub("map"),
  "./FeatureIcon": stub("icon"),
  "../../content/ContactOffices": { default: ContactOffices },
}).default as (p: Record<string, unknown>) => unknown;

/**
 * `lineUrl` returns "" for a handle it will not build a link from, and says in
 * its own docblock that this is so "the caller renders nothing rather than a
 * dead link". Three call sites rendered `<a href={lineUrl(line)}>` gated on the
 * raw value instead, so a LINE typed as an email address, with a space, or as a
 * QR-code URL produced `<a href="">` — which reloads the page the reader is
 * standing on. PageBlocks' own contact renderer already gated on the built URL.
 */
const UNLINKABLE = ["someone@example.com", "@my line", "來電洽詢", "ftp://x/y", "@a"];

for (const bad of UNLINKABLE) {
  test(`a LINE of ${JSON.stringify(bad)} draws no link on any contact surface`, () => {
    assert.equal(socialLinks.lineUrl(bad), "", "lineUrl started accepting this value");

    const surfaces: Array<[string, unknown]> = [
      ["BlockContactInfo cards", expand(BlockContactInfo({ locale: "zh", config: { line: bad } }))],
      ["BlockContactInfo classic", expand(BlockContactInfo({ locale: "zh", config: { layout: "classic", line: bad } }))],
      ["ContactOffices", expand(ContactOffices({ locale: "zh", offices: [{ name: "台北", line: bad }] }))],
      ["PageBlocks contact_info", drawGroupBlock("contact_info", { line: bad }, "zh")],
    ];
    for (const [where, tree] of surfaces) {
      for (const a of tags(tree, "a")) {
        assert.ok(a.props.href, `${where} rendered <a href=""> for ${JSON.stringify(bad)}`);
      }
    }
  });
}

test("a LINE that IS linkable is still linked, everywhere", () => {
  const href = socialLinks.lineUrl("@slowfield");
  assert.ok(href, "lineUrl stopped building a link for a plain handle");
  const surfaces: Array<[string, unknown]> = [
    ["BlockContactInfo cards", expand(BlockContactInfo({ locale: "zh", config: { line: "@slowfield" } }))],
    ["BlockContactInfo classic", expand(BlockContactInfo({ locale: "zh", config: { layout: "classic", line: "@slowfield" } }))],
    ["ContactOffices", expand(ContactOffices({ locale: "zh", offices: [{ name: "台北", line: "@slowfield" }] }))],
    ["PageBlocks contact_info", drawGroupBlock("contact_info", { line: "@slowfield" }, "zh")],
  ];
  for (const [where, tree] of surfaces) {
    assert.ok(
      tags(tree, "a").some((a) => a.props.href === href),
      `${where} no longer links a valid LINE handle`,
    );
  }
});

test("an unlinkable LINE does not leave the 聯絡我們 card open with nothing in it", () => {
  // The card is drawn when there is something to reach us by; the LINE row is
  // drawn from the built URL, so counting the raw value here left an empty list.
  const tree = expand(BlockContactInfo({ locale: "zh", config: { line: "someone@example.com" } }));
  assert.ok(
    !texts(tree).includes("聯絡我們"),
    "the 01 card is drawn with no rows inside it",
  );
});

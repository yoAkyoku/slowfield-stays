import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { readCode, readStyles, cssRules, splitSelectorList } from "./readCode.mts";
import { BLOCK_LABELS, BLOCK_HINTS } from "../app/admin/modules/blockCatalogue.ts";
import * as tr from "../app/modules/tr.ts";
import { sharedModule } from "./sharedModules.mts";

/**
 * 八、內容頁版型 — the three layouts that could not be expressed before.
 *
 * The other four the meeting listed already existed (大圖焦點, 圖文段落 with a
 * side image either way, and the three card blocks), and the editor has always
 * allowed any order — "版型 1＋2＋3＋4" was never the missing part. These three
 * were:
 *
 *   · 影片＋文字 — a video and its copy as ONE block, so they move together
 *   · 主題大圖＋下方小項目 — items that belong to the picture above them
 *   · 圖文交錯 — where the side comes from POSITION, not from stored state
 *
 * The third is the one with real behaviour, so it is executed here rather than
 * pattern-matched: hand-setting 圖片方向 on a run of 圖文段落 produces the same
 * picture today and silently breaks the moment a row is inserted or reordered,
 * which is exactly the defect this block exists to remove.
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

const BLOCK_IMPORTS = { "../../i18n": {}, "../../tr": tr };

const Alternating = compile(
  "app/modules/property/blocks/BlockAlternating.tsx", BLOCK_IMPORTS,
).default as (p: Record<string, unknown>) => unknown;

const FeatureHero = compile(
  "app/modules/property/blocks/BlockFeatureHero.tsx", BLOCK_IMPORTS,
).default as (p: Record<string, unknown>) => unknown;

/** Every className string anywhere in the tree. */
function classes(node: unknown): string[] {
  const out: string[] = [];
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (!isEl(n)) return;
    const cls = n.props.className;
    if (typeof cls === "string") out.push(cls);
    walk(n.props.children);
  };
  walk(node);
  return out;
}

function texts(node: unknown): string[] {
  const out: string[] = [];
  const walk = (n: unknown): void => {
    if (typeof n === "string" && n.trim()) { out.push(n); return; }
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (isEl(n)) walk(n.props.children);
  };
  walk(node);
  return out;
}

const rows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ image: `/i${i}.jpg`, title: { zh: `標題${i}`, en: `T${i}` }, body: { zh: `內文${i}`, en: `B${i}` } }));

const sides = (tree: unknown) =>
  classes(tree)
    .filter((c) => c.includes("alternating-row"))
    .map((c) => (c.includes("--img-left") ? "L" : c.includes("--img-right") ? "R" : "?"));

test("圖文交錯: the side alternates down the run", () => {
  const tree = Alternating({ locale: "zh", config: { items: rows(4) } });
  assert.deepEqual(sides(tree), ["R", "L", "R", "L"]);
});

test("圖文交錯: inserting a row cannot break the alternation", () => {
  /* The whole point over a hand-set run of 圖文段落. Each of those stores an
     absolute side, so inserting at the top leaves two pictures on the same side
     and nothing reports it. Here the side is derived, so the run stays correct
     no matter what happens to the list. */
  const four = rows(4);
  const inserted = [{ image: "/new.jpg", title: { zh: "插入" } }, ...four];
  assert.deepEqual(sides(Alternating({ locale: "zh", config: { items: inserted } })),
    ["R", "L", "R", "L", "R"], "an inserted first row did not re-flow the sides below it");

  const reordered = [four[2], four[0], four[1], four[3]];
  assert.deepEqual(sides(Alternating({ locale: "zh", config: { items: reordered } })),
    ["R", "L", "R", "L"], "reordering left a stored side behind");
});

test("圖文交錯: flip starts the run on the other side", () => {
  assert.deepEqual(sides(Alternating({ locale: "zh", config: { flip: true, items: rows(3) } })),
    ["L", "R", "L"]);
});

test("圖文交錯: an empty row is dropped, an empty block renders nothing", () => {
  const tree = Alternating({ locale: "zh", config: { items: [{}, { title: { zh: "有字" } }, {}] } });
  assert.equal(sides(tree).length, 1, "a row with neither picture nor words still drew a grid cell");
  assert.equal(Alternating({ locale: "zh", config: { items: [] } }), null);
  assert.equal(Alternating({ locale: "zh", config: {} }), null, "no items at all must not draw an empty section");
});

test("圖文交錯 and 主題大圖 are bilingual, like every other block", () => {
  const cfg = { items: rows(2) };
  assert.ok(texts(Alternating({ locale: "zh", config: cfg })).includes("標題0"));
  assert.ok(texts(Alternating({ locale: "en", config: cfg })).includes("T0"));
});

test("主題大圖＋小項目: the items sit inside the picture's own section", () => {
  /* Stacking 大圖焦點 and 圖示重點清單 gives the same two halves but two
     sections, each with its own padding and heading slot — so the items read as
     a separate section rather than as the contents of the one above. */
  const tree = FeatureHero({
    locale: "zh",
    config: { image: "/hero.jpg", title: { zh: "主題" }, items: [{ label: { zh: "一" } }, { label: { zh: "二" } }] },
  });
  const cls = classes(tree);
  assert.equal(cls.filter((c) => c.includes("section")).length, 1, "the items opened a second section");
  /* Token match on the ROOT element, not a substring anywhere in the tree:
     `.editorial-feature-media` on the <figure> contains this class name as a
     substring, so a looser check passed even with the shell removed. */
  const rootTokens = String((tree as { props: { className?: string } }).props.className ?? "").split(/\s+/);
  assert.ok(rootTokens.includes("editorial-feature"),
    "it does not reuse the 大圖焦點 shell, so it will not share the page measure");
  assert.ok(rootTokens.includes("is-centered"), "the shell is there but not its centred variant");
  assert.equal(cls.filter((c) => c === "feature-hero-item").length, 2);
});

test("主題大圖: a row with no title is dropped, an empty block renders nothing", () => {
  const tree = FeatureHero({ locale: "zh", config: { image: "/h.jpg", items: [{}, { label: { zh: "有" } }] } });
  assert.equal(classes(tree).filter((c) => c === "feature-hero-item").length, 1);
  assert.equal(FeatureHero({ locale: "zh", config: {} }), null);
});

test("影片＋文字 reuses the one safe embed pipeline", () => {
  /* A second embed path would be a second place deciding what markup a third
     party may inject. The standalone video block's pipeline — allow-list,
     Facebook-without-their-SDK, strict sanitiser — is imported, not restated. */
  const src = readCode("app/modules/property/blocks/BlockVideoText.tsx");
  assert.match(src, /import \{ OembedMedia \} from "\.\/BlockOembed"/,
    "the video block no longer reuses the shared embed component");
  assert.doesNotMatch(src, /<iframe/, "it builds an iframe of its own instead of going through the sanitiser");
  assert.doesNotMatch(src, /dangerouslySetInnerHTML/, "it injects provider markup directly");
  // The extraction must have left the standalone block using it too.
  assert.match(readCode("app/modules/property/blocks/BlockOembed.tsx"), /<OembedMedia/,
    "BlockOembed no longer renders through the extracted component — the two paths have split again");
});

test("影片＋文字: an unset placement is stacked, and a CTA needs a safe href", () => {
  const src = readCode("app/modules/property/blocks/BlockVideoText.tsx");
  assert.match(src, /rawSide === "left" \|\| rawSide === "right" \? rawSide : null/,
    "the placement falls through to a side again");
  assert.match(src, /isSafeUrl\(rawHref\)/, "a CTA href goes into the page without the allow-list");
});

test("all three are registered everywhere a block has to be registered", () => {
  /* The failure this guards is the one that keeps recurring here: a block the
     palette offers, that saves without error, that the admin preview draws, and
     that the published page renders as nothing. */
  const NEW = ["video_text", "feature_hero", "alternating"];
  const RENDERERS = [
    "app/modules/content/PageBlocks.tsx",
    "app/modules/home/HomepageBlocks.tsx",
    "app/modules/property/PropertyPageRenderer.tsx",
  ];
  const CONFIG_FORM = "app/admin/modules/BlockConfigForm.tsx";
  const EDITORS = [
    "app/admin/(dashboard)/homepage/HomepageBlockEditor.tsx",
    "app/admin/(dashboard)/sites/[id]/pages/[pageKey]/PropertyBlockEditor.tsx",
  ];
  for (const type of NEW) {
    assert.ok(BLOCK_LABELS[type], `${type} is not in the palette catalogue`);
    assert.ok(BLOCK_HINTS[type], `${type} has no palette hint`);
    for (const file of RENDERERS) {
      assert.ok(readCode(file).includes(`case "${type}"`), `${file} cannot draw ${type}`);
    }
    // Both editors render the one BlockConfigForm, whose table maps a type to its form.
    assert.ok(readCode(CONFIG_FORM).includes(`${type}: form(`), `BlockConfigForm offers ${type} with no settings form`);
    for (const file of EDITORS) {
      assert.ok(readCode(file).includes("<BlockConfigForm"), `${file} no longer renders the shared BlockConfigForm`);
    }
  }
});

test("the alternating run is capped at the shared measure", () => {
  /* Written after local QA caught what the test below did NOT: forbidding an
     invented width is not the same as requiring the shared one. `max-width:
     none` on the row passed that check and still let the run fill a 1318px
     section — measured 1145px wide against 960px for the blocks above and
     below it. The cap has to be asserted positively, and on the SECTION, which
     is the element that carries it. */
  const CSS = readStyles("app/globals.css");
  let capped = false;
  for (const chunk of CSS.split("}")) {
    const brace = chunk.indexOf("{");
    if (brace === -1) continue;
    const sels = chunk.slice(0, brace).split(",").map((x) => x.split(/\s+/).filter(Boolean).join(" "));
    if (!sels.includes(".alternating-section")) continue;
    const decls = chunk.slice(brace + 1);
    if (/max-width\s*:\s*var\(--block-measure/.test(decls) && /margin-inline\s*:\s*auto/.test(decls)) capped = true;
  }
  assert.ok(capped,
    ".alternating-section is not capped and centred on --block-measure; the rows escape the page axis again");
});

test("the new layouts inherit the page measure instead of inventing widths", () => {
  /* Three more hard-coded max-widths is how the edges stopped lining up in the
     first place. Two values are legitimate: `none`, which clears a cap the
     borrowed layout brought with it, and the shared `--index-measure`. A
     literal is not — that is a fourth width nobody will remember to update. */
  const CSS = readStyles("app/globals.css");
  /* Counted, because a `continue`-past-everything loop asserts nothing when the
     class names change and reads as a pass. Ten selectors matched and two
     declared a max-width when this was written. */
  let seen = 0;
  let checked = 0;
  for (const rule of cssRules(CSS)) {
    if (!/feature-hero|alternating|video-text/.test(rule.selector)) continue;
    seen += 1;
    const m = /(^|;)\s*max-width\s*:\s*([^;]+)/.exec(rule.body);
    if (!m) continue;
    checked += 1;
    const value = m[2].trim();
    assert.ok(
      value === "none" || value.includes("var(--block-measure"),
      `${rule.selector} sets max-width: ${value} — it must be none or the shared measure`,
    );
  }
  assert.ok(seen >= 8, `only ${seen} rules matched the new layouts — the class names moved`);
  assert.ok(checked >= 1, "no layout declares a max-width at all — this test now proves nothing");
});

test("a long body can have paragraphs", () => {
  /* 八、九點 both ask this block to carry 長篇文字, and the renderer puts the whole
     body in ONE <p>. Without this the blank line an author types collapses and
     the copy lands as a single wall — the field accepts the break, saves it,
     and the page silently ignores it. */
  const CSS = readStyles("app/globals.css");
  let found = false;
  for (const chunk of CSS.split("}")) {
    const brace = chunk.indexOf("{");
    if (brace === -1) continue;
    const sels = chunk.slice(0, brace).split(",").map((x) => x.split(/\s+/).filter(Boolean).join(" "));
    if (!sels.includes(".editorial-feature .property-rich-text-body p")) continue;
    if (/white-space\s*:\s*pre-line/.test(chunk.slice(brace + 1))) found = true;
  }
  assert.ok(found, "a blank line typed into the body collapses; long copy arrives as one wall of text");
});

/** The tag name of every heading element in the tree. */
function headings(node: unknown): string[] {
  const out: string[] = [];
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (!isEl(n)) return;
    if (typeof n.type === "string" && /^h[1-6]$/.test(n.type)) out.push(n.type);
    walk(n.props.children);
  };
  walk(node);
  return out;
}

test("item headings follow what is actually above them", () => {
  /* Both blocks make their own heading optional. A fixed h3 under a page with
     only an h1 tells a reader tabbing the outline that a level was skipped —
     the same defect the article card carries a note about. */
  const rowsCfg = { items: rows(2) };
  assert.deepEqual(headings(Alternating({ locale: "zh", config: rowsCfg })), ["h2", "h2"],
    "with no section heading the rows must start at h2");
  assert.deepEqual(
    headings(Alternating({ locale: "zh", config: { ...rowsCfg, heading: { zh: "標" } } })),
    ["h2", "h3", "h3"],
    "with a section heading the rows sit under it at h3");

  const items = [{ label: { zh: "一" } }, { label: { zh: "二" } }];
  assert.deepEqual(headings(FeatureHero({ locale: "zh", config: { items } })), ["h2", "h2"]);
  assert.deepEqual(
    headings(FeatureHero({ locale: "zh", config: { title: { zh: "主" }, items } })),
    ["h2", "h3", "h3"]);
});

test("the item type treatment matches BOTH heading levels", () => {
  /* The trap this codebase already documents: styled at h3 only, an h2 item
     falls through to `.section h2` — the 27-46px page-title scale, four times
     the size it should be. Nothing about the markup change reports it. */
  const CSS = readStyles("app/globals.css");
  for (const owner of [".feature-hero-item", ".alternating-row"]) {
    const matched = CSS.split("}").some((chunk) => {
      const brace = chunk.indexOf("{");
      if (brace === -1) return false;
      const sel = chunk.slice(0, brace);
      return sel.includes(owner) && /:is\(\s*h2\s*,\s*h3\s*\)/.test(sel);
    });
    assert.ok(matched, `${owner} styles only one heading level; the other falls through to the page-title scale`);
  }
});

test("the item type treatment outranks `.section h3`, not just exists", () => {
  /* Found by local QA, not by the test above: the rule was there, it matched,
     its font-family and margin applied — and the size still came out at 16px,
     identical to the body copy. `.section h3` is (0,1,1), sits LATER in the
     file, and resolves to `inherit` when the CMS type vars are unset. A
     one-class rule ties on specificity and loses on order.

     So the shape of the selector is the thing to assert: at least two classes
     before the heading. Asserting "a rule exists" cannot see this. */
  const CSS = readStyles("app/globals.css");
  for (const owner of ["feature-hero-item", "alternating-row"]) {
    const winners = CSS.split("}")
      .map((chunk) => chunk.slice(0, chunk.indexOf("{")))
      .filter((sel) => sel.includes(owner) && /:is\(\s*h2\s*,\s*h3\s*\)/.test(sel));
    assert.ok(winners.length > 0, `no heading rule for .${owner}`);
    for (const sel of winners) {
      const classCount = (sel.match(/\.[a-z][\w-]*/g) || []).length;
      assert.ok(
        classCount >= 2,
        `"${sel.trim()}" has ${classCount} class(es); it ties with \`.section h3\` and loses on source order, so the title renders at body size`,
      );
    }
  }
});

test("an unset CMS type scale still leaves a hierarchy", () => {
  /* Every site that has never opened the font panel has these vars unset, so
     the LAST fallback in the chain is what most pages actually render. It must
     be a real size: `inherit` there collapses the title into its own body copy,
     which is what the item titles did. */
  const CSS = readStyles("app/globals.css");
  for (const owner of ["feature-hero-item", "alternating-row"]) {
    let found = 0;
    for (const rule of cssRules(CSS)) {
      if (!rule.selector.includes(owner) || !/:is\(/.test(rule.selector)) continue;
      const fs = /(^|;)\s*font-size\s*:\s*([^;]+)/.exec(rule.body);
      /* Only the rules that actually SIZE the heading. The guarantee here is
         "whatever sets the size must not fall back to inherit", and a heading
         may legitimately be matched by a second rule that sets something else —
         the bleed layout overrides only `text-align`. Requiring a font-size on
         every matching rule made adding any other heading declaration fail for
         a reason that has nothing to do with the type scale. The `found` count
         below still fails if the sizing rule itself disappears. */
      if (!fs) continue;
      found += 1;
      assert.doesNotMatch(
        fs![2],
        /inherit\s*\)*\s*$/,
        `.${owner} falls back to inherit; with the type vars unset the title renders at body size`,
      );
    }
    /* Without this the loop asserts nothing the moment the selector is renamed,
       and a rename is exactly when this check matters. */
    assert.ok(found > 0, `no :is() heading rule found for .${owner} — re-anchor this test`);
  }
});

test("every content-page block shares one measure, and the cap actually wins", () => {
  /* `.alternating-section { max-width: var(--index-measure) }` was written and
     never applied: it is (0,1,0) and `.property-block-contained > .section` is
     (0,1,1), so the generic 1200px won. Measured on /brand at 1920 — editorial
     sections at 475..1435 (960) with 圖文交錯 and the gallery at 355..1555
     (1200), a five-block page alternating between two axes.

     The earlier test for this checked that the declaration EXISTS. A rule that
     exists and loses reads identically to one that works, which is why the
     defect survived it. */
  const CSS = readStyles("app/globals.css");
  for (const cls of ["alternating-section", "property-image-gallery"]) {
    const rules = cssRules(CSS).filter((r) =>
      r.selector.includes(`.property-block-contained > .section.${cls}`));
    assert.ok(
      rules.length > 0,
      `.${cls} has no rule that outranks \`.property-block-contained > .section\`, so its measure is decorative`,
    );
    assert.ok(
      rules.some((r) => /max-width:\s*var\(--block-measure/.test(r.body)),
      `.${cls} does not cap on the page measure where it can win`,
    );
  }
});

test("大圖焦點's picture spans the measure rather than the content box", () => {
  /* The block is named 大圖焦點 and rendered a 736px image inside a 960px
     section — narrower than the text blocks either side of it. It steps out of
     the section's own gutter so the picture meets the section edge while the
     prose below keeps its readable column. */
  const CSS = readStyles("app/globals.css");
  const rules = cssRules(CSS).filter((r) => splitSelectorList(r.selector).includes(".editorial-feature-media"));
  assert.ok(rules.length > 0, ".editorial-feature-media is gone — re-anchor this test");
  assert.ok(
    rules.some((r) => /margin:[^;]*calc\(-1 \* var\(--gutter\)\)/.test(r.body)),
    "the feature picture no longer steps out of the section gutter",
  );
});

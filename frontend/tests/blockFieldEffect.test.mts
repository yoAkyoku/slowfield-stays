import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readStyles, readCode } from "./readCode";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Every .tsx under a directory, recursively. */
function walkTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const f = join(dir, n);
    return statSync(f).isDirectory() ? walkTsx(f) : (f.endsWith(".tsx") ? [f] : []);
  });
}
import { safeLinkHref } from "../app/modules/safeHtml.ts";
import { staysVariantsFor } from "../app/modules/blockStyle.ts";

/**
 * Four block settings an audit found to be inert or mislabelled.
 *
 * The pattern behind all four is the same one this codebase keeps producing: a
 * field exists in the admin, saves without complaint, and the renderer either
 * throws the value away or does the opposite of what the field's own label
 * promises. Nothing errors, so nothing is noticed.
 *
 * The precedence tests below EXECUTE the source lines they extract rather than
 * pattern-matching them. A string search is how a test in this repo passed
 * against the wrong half of a file; running the real expression cannot match
 * the wrong place, and a rename makes the extraction fail loudly instead of
 * quietly asserting nothing.
 */

/** Block and JSX comments, plus whole-line `//` comments. Never touches a
 *  `//` inside a URL or a regex, which a to-end-of-line strip would eat. */
function stripComments(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");
}

function code(path: string): string {
  return stripComments(readFileSync(path, "utf8"));
}

const ATTRACTIONS = code("app/modules/property/blocks/BlockAttractions.tsx");
const MAP = code("app/modules/property/blocks/BlockMap.tsx");
const CONTACT_INFO = code("app/modules/property/blocks/BlockContactInfo.tsx");
const CONTACT_FORM = code("app/modules/content/ContactFormBlock.tsx");
const PARTNER_GRID = code("app/modules/property/blocks/PartnerGrid.tsx");

const declaration = (src: string, name: string): string | undefined =>
  src.split("\n").map((l) => l.trim()).find((l) => l.startsWith(`const ${name} = `));

/* ── 1. 周邊景點 → 連結（選填） ───────────────────────────────────────── */

test("the attraction link goes through the shared settings-field allow-list", () => {
  // http(s)-only silently dropped every internal target, and the card then
  // rendered as a <div> — unclickable, with nothing in the plain-text field to
  // say why. Linking an attraction to one of our own villas is the ordinary
  // case, not an edge one.
  const mapped = ATTRACTIONS.split("\n").map((l) => l.trim()).find((l) => l.startsWith("link:"));
  assert.ok(mapped, "the attraction item no longer maps a link field at all");
  assert.equal(
    mapped,
    "link: safeLinkHref(it.link),",
    "the attraction link is validated by something other than the shared allow-list",
  );
  assert.match(
    ATTRACTIONS,
    /import \{ safeLinkHref \} from "\.\.\/\.\.\/safeHtml"/,
    "safeLinkHref is used without being imported from the one module that defines it",
  );
});

test("that allow-list admits an internal target and still refuses a hostile one", () => {
  // The behaviour the block now inherits. Villa sites and the group share one
  // origin, so a javascript: href here would run with the reader's admin
  // cookie — widening the field must not widen that.
  for (const internal of ["/stays/hejing", "/stays/detail/x?from=attractions", "#rooms", "#周邊"]) {
    assert.equal(safeLinkHref(internal), internal, internal);
  }
  for (const external of ["https://www.example.com/x", "http://example.com"]) {
    assert.equal(safeLinkHref(external), external, external);
  }
  for (const hostile of [
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    // Reads as internal, leaves the site when clicked — phishing with our own
    // domain in front of it.
    "//evil.example/x",
    "/\\evil.example",
  ]) {
    assert.equal(safeLinkHref(hostile), "", hostile);
  }
});

test("only a link that leaves the site opens a new tab", () => {
  // A path on this site opening in a new tab strands the reader with a dead
  // back button, and rel=noopener on an internal link is noise.
  assert.ok(
    ATTRACTIONS.includes("const offsite = /^https?:\\/\\//i.test(it.link)"),
    "the attraction card no longer distinguishes an off-site link from an internal one",
  );
  const at = ATTRACTIONS.indexOf('target: "_blank"');
  assert.ok(at > -1, "the off-site attraction link no longer opens in a new tab");
  assert.ok(
    ATTRACTIONS.slice(Math.max(0, at - 120), at).includes("offsite ?"),
    "every attraction link opens in a new tab again, internal ones included",
  );
});

/* ── 2. 地圖 → 在 Google 地圖開啟 ────────────────────────────────────── */

test("the map's Open-in-Google-Maps link stays absolute-only", () => {
  /* Deliberately NOT widened alongside the attractions field. This link is
     labelled 在 Google 地圖開啟 / Open in Google Maps: its destination is
     somebody else's map by definition, so a relative path or an anchor here is
     a typo, and honouring one would produce a link whose own label lies about
     where it goes. Consistency is not a reason to loosen a field that is
     correctly strict. */
  assert.equal(
    declaration(MAP, "linkHref"),
    'const linkHref = typeof config.link === "string" && /^https?:\\/\\//.test(config.link) ? config.link : "";',
    "the map's external link no longer requires an absolute http(s) URL",
  );
  assert.ok(
    !MAP.includes("safeLinkHref"),
    "the map link was widened to the settings-field allow-list, which admits paths, anchors, tel: and mailto:",
  );
});

/* ── 3. LINE：區塊填了就用區塊的 ─────────────────────────────────────── */

/**
 * Run the component's own precedence lines against a config/siteLine pair.
 *
 * `result` is the variable the component reads afterwards. Extraction asserts
 * it found every declaration it expected, so renaming one fails here rather
 * than leaving an empty function that passes.
 */
function resolveLine(src: string, names: readonly string[], result: string) {
  const decls = names.map((n) => {
    const found = declaration(src, n);
    assert.ok(found, `the LINE precedence no longer declares ${n}`);
    return found;
  });
  const fn = new Function("config", "siteLine", `${decls.join("\n")}\nreturn ${result};`) as (
    config: Record<string, unknown>,
    siteLine?: string,
  ) => string;
  return fn;
}

const CASES: ReadonlyArray<readonly [string, Record<string, unknown>, string | undefined, string]> = [
  ["the block's own value wins on a villa page, where siteLine is always set", { line: "@villa" }, "@group", "@villa"],
  ["a blank block field falls back to the site setting", { line: "" }, "@group", "@group"],
  ["a whitespace-only block field is blank, not a value", { line: "   " }, "@group", "@group"],
  ["an absent block field falls back to the site setting", {}, "@group", "@group"],
  ["neither set resolves to nothing, so no dead link is rendered", {}, undefined, ""],
  ["the block value stands alone when the site has none", { line: "@villa" }, undefined, "@villa"],
  ["a non-string block value cannot shadow the site setting", { line: { zh: "@x" } }, "@group", "@group"],
];

for (const [file, src, names, result] of [
  ["BlockContactInfo", CONTACT_INFO, ["blockLine", "line"], "line"],
  ["ContactFormBlock", CONTACT_FORM, ["blockLine", "lineRaw"], "lineRaw"],
] as const) {
  test(`${file} honours 留空則用站群設定 rather than reversing it`, () => {
    const resolve = resolveLine(src, names, result);
    for (const [why, config, siteLine, expected] of CASES) {
      assert.equal(resolve(config, siteLine), expected, `${file}: ${why}`);
    }
  });
}

test("the prop that carries the site LINE no longer documents the old precedence", () => {
  // The comment was the only statement of intent either renderer had, and it
  // agreed with the bug rather than with the admin label.
  const raw = readCode("app/modules/content/ContactFormBlock.tsx");
  assert.ok(
    !/siteLine[\s\S]{0,200}takes priority over per-block/.test(raw),
    "the siteLine prop still documents itself as outranking the block's own field",
  );
});

/* ── 4. 合作品牌：Logo 牆只放 logo ───────────────────────────────────── */

test("the logo wall renders marks only, and that is the deliberate shape", () => {
  /* 代表照片 and 簡短說明 stay cards-only. Rendering them on the wall would
     make the two 版面 draw the same thing, which leaves the control with
     nothing to choose between; the editor who wants a photo and a sentence per
     partner already has the cards layout. The gap this leaves is in the block
     FORM, which offers both fields under either 版面 — that is where they
     should be hidden. */
  assert.ok(
    PARTNER_GRID.includes('layout === "cards" && (it.image || it.logo)'),
    "代表照片 is no longer gated on the cards layout",
  );
  assert.ok(
    PARTNER_GRID.includes('layout === "cards" && it.desc'),
    "簡短說明 is no longer gated on the cards layout",
  );
});

test("詳細說明 is available under both layouts, because it costs the wall no space", () => {
  assert.ok(
    PARTNER_GRID.includes("const expandable = Boolean(it.detail)"),
    "the disclosure no longer keys off 詳細說明 alone",
  );
  assert.ok(
    !PARTNER_GRID.includes('layout === "cards" && it.detail'),
    "詳細說明 was gated on a layout, so a logo-wall partner's copy is unreachable",
  );
});

test("the reason the wall cannot hold copy still holds in the stylesheet", () => {
  // The decision above rests on the wall being the denser grid: a 4:3 photo and
  // a sentence do not fit a tile sized for a mark. If that ever stops being
  // true, the decision deserves revisiting rather than silently outliving it.
  const css = readStyles("app/globals.css");
  // indexOf, not lastIndexOf: the last match of either selector is the mobile
  // override inside the media query, and comparing two overrides says nothing
  // about the layout the desktop reader sees.
  const floor = (selector: string) => {
    const at = css.indexOf(`${selector} {`);
    assert.ok(at > -1, `${selector} is gone`);
    const rule = css.slice(at, css.indexOf("}", at));
    const m = rule.match(/minmax\((\d+)px/);
    assert.ok(m, `${selector} no longer sets a column floor`);
    return Number(m[1]);
  };
  assert.ok(
    floor(".property-partners--logos .property-partners-grid") <
      floor(".property-partners--cards .property-partners-grid"),
    "the logo wall is no longer the denser grid, so 'a tile sized for a mark' no longer justifies dropping the photo and the copy",
  );
});

/**
 * Every renderer that consumes the site-level LINE must prefer the block's own.
 *
 * The precedence was inverted in three places, not one. Fixing the two obvious
 * renderers left a third — a local `ContactInfo` inside `PageBlocks.tsx` that
 * group content pages use instead of `BlockContactInfo` — so the same field
 * kept behaving differently depending on which kind of page it sat on. A list
 * of three filenames would not have caught that third copy, and will not catch
 * a fourth: this sweeps for the consumers instead.
 */
test("no renderer lets the site LINE shadow a block's own", () => {
  const files = walkTsx("app/modules");
  const offenders: string[] = [];

  for (const file of files) {
    const src = readFileSync(file, "utf8");
    // Only the files that RESOLVE the value. HomepageBlocks and
    // PropertyPageRenderer merely forward `siteLine` as a prop and have no
    // precedence to get wrong; requiring the pattern of them failed the test
    // for the wrong reason on the first run.
    if (!src.includes("siteLine") || !/config\.line|config\?\.line/.test(src)) continue;
    // The fixed shape: the block value is read and trimmed first, and the site
    // value appears only as the right-hand side of a fallback.
    const inverted = /\(\s*siteLine\s*&&\s*siteLine\.trim\(\)\s*\)\s*\|\|/.test(src);
    if (inverted) offenders.push(`${file} — site value is tried first`);
    const usesBlockFirst = /blockLine\s*\|\|\s*\(siteLine \?\? ""\)\.trim\(\)/.test(src);
    if (!usesBlockFirst) offenders.push(`${file} — no block-first fallback found`);
  }

  assert.deepEqual(offenders, [], offenders.join("\n"));
});

/**
 * A field is only offered where the renderer will draw it.
 *
 * 代表照片 and 簡短說明 sat on the partners form in both layouts, and the logo
 * wall renders neither — the editor typed, saved, and got nothing, with no way
 * to tell why (客戶: 檢查所有 block 的設置是否生效). The wall stays logo-only by
 * design; the form is what had to change.
 */
test("the partner photo and short copy are offered only on the cards layout", () => {
  const src = readCode("app/admin/modules/blockForms.tsx");
  const form = src.slice(src.indexOf("export function PartnersConfigForm"));
  const body = form.slice(0, form.indexOf("\n}\n"));

  // Regex literals, not `new RegExp("…[\\s\\S]…")`: built as a string through a
  // shell heredoc the escape collapsed a level and `[\s\S]` reached the engine
  // as the literal characters s and S, so the test failed against source that
  // was correct. A literal has no such layer.
  assert.match(body, /layout === "cards"[\s\S]{0,120}key: "image"/,
    'partners field "image" is offered on the logo wall, which never draws it');
  assert.match(body, /layout === "cards"[\s\S]{0,120}key: "desc"/,
    'partners field "desc" is offered on the logo wall, which never draws it');
  // detail is deliberately NOT guarded — it sits behind 了解更多 and costs the
  // wall no space, so both layouts keep it.
  assert.doesNotMatch(body, /layout === "cards"[\s\S]{0,120}key: "detail"/,
    "the expanded detail should stay available on both layouts");
});

test("the attractions link field says what it accepts", () => {
  // The silent drop went unnoticed because the control was a bare text box.
  const src = readCode("app/admin/modules/blockForms.tsx");
  const form = src.slice(src.indexOf("export function AttractionsConfigForm"));
  const body = form.slice(0, form.indexOf("\n}\n"));
  // The two facts an editor needs: an internal path is accepted at all, and the
  // two kinds of target behave differently when clicked.
  assert.match(body, /站內路徑/, "no Chinese guidance under the link field");
  assert.match(body, /站內連結在同分頁開啟/, "the Chinese note does not say where an internal link opens");
  assert.match(body, /a path on this site/, "no English guidance under the link field");
  assert.match(body, /same tab/, "the English note does not say where an internal link opens");
});

/**
 * 排版樣式 must be offered only where the renderer draws it.
 *
 * BlockStays has two branches — one over the stay catalogue, one over CMS
 * pages — and three of the six layouts are built in only one of them. Picked
 * against the other source the request fell through to the shared tail, which
 * put `home-collection--feature` / `--news` / `--index` on the row: three class
 * names with no rule anywhere in globals.css. The row then rendered exactly
 * like 網格, so the button looked selected and changed nothing.
 */
test("the layout list matches the branch that draws each layout", () => {
  const stays = staysVariantsFor(true);
  const pages = staysVariantsFor(false);
  // 精選大圖 is built from stays; 最新消息卡 and 編號列表 from pages.
  assert.ok(stays.includes("feature"), "the showcase is drawn from stays");
  assert.ok(!stays.includes("news") && !stays.includes("index"),
    "news/index are offered for stays, where no branch draws them");
  assert.ok(pages.includes("news") && pages.includes("index"));
  assert.ok(!pages.includes("feature"),
    "the showcase is offered for CMS pages, where no branch draws it");
  // The three that work everywhere.
  for (const shared of ["grid", "list", "compact"]) {
    assert.ok(stays.includes(shared) && pages.includes(shared), shared);
  }
});

test("every offered layout has a rule in the stylesheet", () => {
  // The actual defect: a class the renderer emits and the stylesheet has never
  // heard of. Checked against both sources so neither list can grow a layout
  // that has no design.
  const css = readStyles("app/globals.css");
  const missing: string[] = [];
  for (const variant of new Set([...staysVariantsFor(true), ...staysVariantsFor(false)])) {
    // grid/list/compact are drawn by .home-collection--<v>; feature, news and
    // index each render their own section instead.
    /* A class token, not a substring: `.home-collection--compact` is a
       substring of `.home-collection--compactZZZ`, so renaming the rule out of
       existence left this green. A class name ends at a rule boundary, never
       at a letter or a hyphen. */
    const hasRule = (cls: string) => {
      const at = css.indexOf(cls);
      if (at === -1) return false;
      // The character after the class name: a rule boundary, never a letter,
      // a digit or a hyphen — those would make it a different class.
      return !/[\w-]/.test(css[at + cls.length] ?? "");
    };
    const drawn =
      hasRule(`.home-collection--${variant}`)
      || (variant === "feature" && hasRule(".home-showcase-section"))
      || (variant === "news" && hasRule(".home-news-section"))
      || (variant === "index" && hasRule(".home-journal-index"));
    if (!drawn) missing.push(variant);
  }
  assert.deepEqual(missing, [], `offered with no styles: ${missing.join(", ")}`);
});

test("the renderer falls back rather than emitting a class with no styles", () => {
  const src = readCode("app/modules/home/blocks/BlockStays.tsx");
  assert.match(
    src,
    /staysVariantsFor\(isStays\)\.includes\(requestedVariant\) \? requestedVariant : "grid"/,
    "an unsupported layout still reaches the row class unchanged",
  );
});

test("the editor filters the layout buttons through the same helper", () => {
  // Two lists would drift. One helper cannot.
  const src = readCode("app/admin/modules/blockForms.tsx");
  assert.match(src, /STAYS_VARIANTS\.filter\(\(\[val\]\) => staysVariantsFor\(source === "stays"\)\.includes\(val\)\)/);
});

test("精選大圖 hides the controls it returns before reading", () => {
  // The showcase branch returns early, so 橫向滑動 and the tag controls below it
  // saved values nothing read.
  /* The tag half asserted the literal `{variant !== "feature" && (`, and went
     red when 編號列表 joined the same exclusion — the guarantee had widened, not
     broken. Assert which variants are excluded, not the expression that happens
     to express it. */
  const src = readCode("app/admin/modules/blockForms.tsx");
  assert.match(src, /variant === "feature" \? \(/, "the card-row control is not withheld on the showcase");
  const gate = src.match(/\{[^\n]*&& \(\n\s*<div className="hpb-field" role="group" aria-label=\{zh \? "卡片標籤與訪客篩選"/);
  assert.ok(gate, "the tag controls are no longer withheld from any variant");
  for (const v of ["feature", "index"]) {
    assert.ok(
      gate![0].includes(`"${v}"`),
      `the tag controls are still offered on ${v}, which draws no tags and excludes itself from the chip row`,
    );
  }
});

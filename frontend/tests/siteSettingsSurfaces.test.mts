import assert from "node:assert/strict";
import test from "node:test";
import { readCode, readStyles } from "./readCode";
import { footerNotice, noticeLines } from "../app/modules/consentNotice.ts";

/**
 * Site-level settings that saved without complaint and then did nothing.
 *
 * Companion to siteSettingsReach.test.mts, which covers the two CSS-variable
 * traps (a value derived once on `:root`, a variable with no reachable
 * fallback). These five are the other four shapes of the same defect, each
 * found by measuring rather than by reading:
 *
 *   * a control whose variables no rule on a whole ROUTE reads — 字級 moved
 *     zero elements on every CMS entry page, measured at --type-*: all
 *     twenty-four variables, against 40-odd on the group homepage;
 *   * a stored key with NO reader anywhere — seo_defaults.title;
 *   * a form field the payload reads that the form never renders, so the value
 *     is rewritten to a default on every save — is_template;
 *   * a key with exactly ONE reader when the control is offered for every site
 *     — footer_notice, villa footers only;
 *   * a control that reaches one site's furniture and not the other's —
 *     介面比例 and the villa footer.
 */

const CSS = readStyles("app/globals.css").replace(/\/\*[\s\S]*?\*\//g, (c) => " ".repeat(c.length));

/** Every `prop: …` declaration in the file, in source order, with its offset. */
function declarations(prop: string): Array<{ at: number; value: string }> {
  const re = new RegExp(`(^|[;{\\s])${prop}\\s*:\\s*([^;}]+)`, "g");
  const out: Array<{ at: number; value: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(CSS))) out.push({ at: m.index, value: m[2].trim() });
  return out;
}

/** Is `at` inside an at-rule's block? Brace depth, not selector text — see
 *  roleTypeCascade.test.mts for why the text test silently never fires. */
function insideAtRule(at: number): boolean {
  let depth = 0;
  let atDepth = 0;
  const re = /@media|@supports|@layer|\{|\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(CSS)) && m.index < at) {
    if (m[0] === "{") depth++;
    else if (m[0] === "}") {
      depth--;
      if (atDepth && depth < atDepth) atDepth = 0;
    } else atDepth = depth + 1;
  }
  return atDepth > 0;
}

/**
 * The LAST declaration of `prop` in a rule listing `selector` as a whole
 * selector, outside any at-rule — the one the browser actually obeys.
 *
 * Positional, never existential: a variable threaded into an earlier rule that
 * a later one overrides reads as correct in a diff and does nothing on the
 * page. That is how the type scale came to be inert on the entry pages.
 */
function lastWinningDeclaration(selector: string, prop: string): string | null {
  let winner: string | null = null;
  for (const { at, value } of declarations(prop)) {
    const open = CSS.lastIndexOf("{", at);
    if (open < 0) continue;
    const prevClose = CSS.lastIndexOf("}", open);
    const selectors = CSS.slice(prevClose + 1, open)
      .split(",")
      .map((s) => s.replace(/\s+/g, " ").trim());
    if (!selectors.includes(selector)) continue;
    if (insideAtRule(at)) continue;
    winner = value;
  }
  return winner;
}

/* ── 1. 字級 reaches the CMS entry page ──────────────────────────────────────
   /journal/<slug>, /news/<slug>, /page/<slug> and every other content detail
   route draw .article-title / .article-body / .article-related-title. All of
   them carried bare clamp()s, so the whole 字級
   panel — six levels × four properties — was inert on the pages that are
   almost entirely running text. The fallbacks below are the exact figures
   those rules used to hard-code, so an untouched site is unchanged. */

const ENTRY_PAGE: Array<[string, string, string, string]> = [
  // [selector, property, the variable it must read, the fallback it must keep]
  [".article-title", "font-size", "--type-h1-size", "clamp(30px, 5vw, 52px)"],
  [".article-title", "font-weight", "--type-h1-weight", "500"],
  [".article-title", "line-height", "--type-h1-line", "1.14"],
  [".article-title", "font-family", "--type-h1-family", "var(--font-title)"],
  /* `.article-lede` was here and has been removed along with its rule.
     ArticleDetail draws no lede element and `article-${content_type}` cannot
     spell that class, so these three rows asserted that a dead rule was
     correctly threaded — a guard that could never fail for the right reason. */
  [".article-body", "font-size", "--type-body-size", "clamp(16px, 1.5vw, 18px)"],
  [".article-body", "line-height", "--type-body-line", "1.85"],
  [".article-body", "font-family", "--type-body-family", "var(--font-body)"],
  [".article-related-title", "font-size", "--type-h2-size", "clamp(22px, 3vw, 30px)"],
  [".article-related-title", "font-weight", "--type-h2-weight", "500"],
  [".article-related-title", "font-family", "--type-h2-family", "var(--font-title)"],
];

for (const [selector, prop, variable, fallback] of ENTRY_PAGE) {
  test(`entry page: ${selector} ${prop} reads ${variable}`, () => {
    const winning = lastWinningDeclaration(selector, prop);
    assert.ok(winning, `no top-level ${prop} declaration for ${selector}`);
    assert.ok(
      winning!.includes(`var(${variable}`),
      `the last ${prop} on ${selector} is "${winning}" — 字級 cannot reach the CMS entry page`,
    );
    assert.ok(
      winning!.includes(fallback),
      `${selector} ${prop} no longer falls back to "${fallback}", so a site that never opened 字級 renders differently`,
    );
  });
}

/* ── 2. 介面比例 reaches the villa footer ─────────────────────────────────────
   版面 → 介面比例 says it sets "the size of icons, the footer and small print".
   The group .footer multiplied by it; .property-footer was a flat 13px, so at
   --ui-scale: 2 the group footer moved 41 elements and the villa footer moved
   two — both of them the shared newsletter input and button. */

test("介面比例 reaches the villa footer, not only the group one", () => {
  for (const selector of [".footer", ".property-footer"]) {
    const winning = lastWinningDeclaration(selector, "font-size");
    assert.ok(winning, `no top-level font-size declaration for ${selector}`);
    assert.ok(
      winning!.includes("var(--ui-scale"),
      `${selector} sizes itself as "${winning}" — 版面 → 介面比例 does not move it`,
    );
  }
});

test("the villa footer still draws 13px until the setting is moved", () => {
  // The point of calc() here is that nothing changes at scale 1; a rewritten
  // base figure would be a silent restyle of every villa footer.
  const winning = lastWinningDeclaration(".property-footer", "font-size");
  assert.match(String(winning), /calc\(13px \* var\(--ui-scale, 1\)\)/);
});

/* ── 3. 頁尾法律聲明 is rendered by BOTH footers ─────────────────────────────
   The field is in the site editor's 進階 / 法規 tab for every site and had
   exactly one reader, PropertyFooter — so on the group site it saved and no
   page ever showed it. `.footer-notice` was already listed in the stylesheet's
   interface-scale group with no element in the app to match it. */

test("footerNotice resolves the field the way the villa footer always did", () => {
  assert.equal(footerNotice({ zh: "中文", en: "English" }, "en"), "English");
  assert.equal(footerNotice({ zh: "中文", en: "English" }, "zh"), "中文");
  // Half-filled: better the other language than no notice at all — unlike the
  // consent copy above it, which has a bundled default to fall back on.
  assert.equal(footerNotice({ zh: "中文" }, "en"), "中文");
  assert.equal(footerNotice({ en: "English" }, "zh"), "English");
  // The legacy single field predates the zh/en split and is the only wording
  // the site has.
  assert.equal(footerNotice("plain", "en"), "plain");
  // Nothing set means no notice, not an empty paragraph.
  assert.equal(footerNotice(undefined, "zh"), "");
  assert.equal(footerNotice({}, "zh"), "");
});

test("the notice keeps the paragraphs it was typed as", () => {
  assert.deepEqual(noticeLines("one\r\n\r\n two \nthree"), ["one", "two", "three"]);
  assert.deepEqual(noticeLines(""), []);
});

test("both footers read footer_notice through the one resolver", () => {
  const group = readCode("app/(site)/layout.tsx");
  const villa = readCode("app/modules/property/PropertyFooter.tsx");
  for (const [name, src] of [["group", group], ["villa", villa]] as const) {
    assert.ok(
      src.includes("footerNotice("),
      `the ${name} footer no longer resolves settings.footer_notice`,
    );
    assert.ok(
      src.includes("noticeLines("),
      `the ${name} footer no longer splits the notice into paragraphs`,
    );
  }
  // …and the group footer has an element for it. The class was in the
  // stylesheet long before anything rendered it, so "the CSS is there" proves
  // nothing on its own.
  assert.ok(
    group.includes('className="footer-notice"'),
    "the group footer renders no element for the legal notice",
  );
});

test("the group notice has layout of its own, not only a font size", () => {
  // .footer-notice was carried in the interface-scale group with no other rule,
  // so the element would have rendered as unspaced full-width body text.
  const at = CSS.lastIndexOf("\n.footer-notice {");
  assert.ok(at > -1, "the .footer-notice layout rule is gone");
  const rule = CSS.slice(at, CSS.indexOf("}", at));
  for (const prop of ["padding", "max-width", "line-height"]) {
    assert.ok(rule.includes(`${prop}:`), `.footer-notice sets no ${prop}`);
  }
});

/* ── 4. SEO 設置 → Meta 標題 has a reader ────────────────────────────────────
   seo_defaults.description was the site-wide fallback description; its twin
   was written by the form, stored by the API and read by nothing at all, so
   every <title> on the site ignored the field above it. */

test("the site's Meta 標題 reaches the homepage title of a group site and a villa", () => {
  for (const path of ["app/(site)/page.tsx", "app/property/[slug]/page.tsx"]) {
    const src = readCode(path);
    assert.ok(
      src.includes("seo_defaults?.title"),
      `${path} ignores the site's SEO Meta 標題, so the field has no reader`,
    );
  }
});

test("a page's own SEO title still outranks the site default", () => {
  // The site-wide title is a FALLBACK. Putting it first would overwrite the
  // homepage's own seo.title on every site that set both.
  const group = readCode("app/(site)/page.tsx");
  assert.match(group, /title: strictHp\("title"\) \|\| seoTextForLocale\(site\.seo_defaults\?\.title, locale\)/);
  const villa = readCode("app/property/[slug]/page.tsx");
  assert.match(villa, /title: seoTextForLocale\(hpSeo\.title, locale\) \|\| seoTextForLocale\(site\.seo_defaults\?\.title, locale\)/);
});

/* ── 5. Saving the site editor does not demote a template ────────────────────
   sitePayload reads `is_template === "on"`, and the editor rendered no such
   field: every save of every tab wrote `false`. A 模板 site lost its badge and
   its place at the top of the site list, /admin/sites/new stopped offering it,
   and sitemap.ts started handing it to crawlers. */

test("the site editor carries is_template through the save", () => {
  const editor = readCode("app/admin/(dashboard)/sites/[id]/SitePageEditor.tsx");
  assert.match(
    editor,
    /name="is_template"/,
    "the editor posts no is_template, so sitePayload's `=== \"on\"` writes false on every save",
  );
  assert.match(
    editor,
    /site\?\.is_template && <input type="hidden" name="is_template" value="on" \/>/,
    "is_template is no longer carried forward from the site being edited",
  );
});

test("the field lives where a hidden tab cannot drop it", () => {
  /* Tabs 2 and 3 are `{tab === n && …}` — unmounted, and therefore absent from
     the FormData. A field the payload reads unconditionally has to sit in a
     panel that is only ever `display: none`, which is what the 基本資料 panel
     and its sibling hidden inputs are. Measured by position: the field must
     come before the first conditionally-mounted panel. */
  const editor = readCode("app/admin/(dashboard)/sites/[id]/SitePageEditor.tsx");
  const field = editor.indexOf('name="is_template"');
  const firstConditionalPanel = editor.indexOf("{tab === 2 && (");
  assert.ok(field > -1 && firstConditionalPanel > -1, "the editor's tab structure has changed");
  assert.ok(
    field < firstConditionalPanel,
    "is_template moved into a tab that is unmounted when another tab is open, so the save drops it again",
  );
});

test("every write path still carries it too", () => {
  /* These all PUT the whole site, so a path that forgets the flag clears it
     just as thoroughly as the editor did.

     The expression, not the word. `readCode(path).includes("is_template")` was
     the first version of this, and siteActions.ts names the key three times —
     once in a type, once in each payload — so deleting the payload line the
     editor feeds left the test green over the exact defect it is here for. */
  for (const [path, expression] of [
    // The site editor's own payload: the value it reads out of the FormData.
    ["app/admin/modules/siteActions.ts", 'is_template: formData.get("is_template") === "on"'],
    // The page-order autosave, and the two block editors, echo the stored value.
    ["app/admin/modules/siteActions.ts", "is_template: site.is_template ?? false"],
    ["app/admin/modules/homepageActions.ts", "is_template: site.is_template ?? false"],
    ["app/admin/modules/propertyPagesActions.ts", "is_template: site.is_template ?? false"],
  ] as Array<[string, string]>) {
    assert.ok(
      readCode(path).includes(expression),
      `${path} no longer sends \`${expression}\`, so saving through it clears the 模板 flag`,
    );
  }
});
